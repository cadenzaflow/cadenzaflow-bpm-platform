import { useMemo, useState } from 'react';
import { Button, Checkbox, InlineNotification, Modal, PaginationNav, SkeletonText, Stack, Tag, TextInput } from '@carbon/react';
import { Pause, Play, SettingsAdjust } from '@carbon/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { engineUrl, request } from '../../../../shared/api/client';
import { DEFAULT_PAGE_SIZE, usePagedList } from '../../../../shared/api/paging';
import { elementNames } from '../../../../shared/diagram/bpmn-names';
import { notify } from '../../../../shared/notifications';
import { ListTable, type Column } from '../../../../shared/ui/ListTable';
import { SuspensionModal } from '../../components/SuspensionModal';
import { useInvalidateCockpit } from '../../incidents/api';
import { useProcessDefinitionXml } from '../api';
import type { DefinitionTab, DefinitionTabProps } from './registry';

interface JobDefinition {
  id: string;
  activityId: string;
  jobType: string;
  jobConfiguration: string;
  suspended: boolean;
  overridingJobPriority: number | null;
}

type Dialog = { kind: 'suspension' | 'priority'; jobDefinition: JobDefinition } | null;

/** The job definitions of the process (timers, async continuations, ...), filtered by the selected activities. */
function JobDefinitionsTab({ engine, definition, activityIds }: DefinitionTabProps) {
  const { t } = useTranslation('cockpit');
  const xml = useProcessDefinitionXml(engine, definition.id);
  const names = useMemo(() => elementNames(xml.data), [xml.data]);
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<Dialog>(null);
  const jobDefinitions = usePagedList<JobDefinition>(['cockpit', engine, 'list'], {
    listUrl: engineUrl(engine, '/job-definition'),
    countUrl: engineUrl(engine, '/job-definition/count'),
    query: { processDefinitionId: definition.id },
    page,
  });
  // as in the classic Cockpit, the selection filters the loaded page
  const shown = (jobDefinitions.data?.items ?? []).filter((job) => !activityIds.length || activityIds.includes(job.activityId));
  const pageCount = jobDefinitions.data ? Math.ceil(jobDefinitions.data.count / DEFAULT_PAGE_SIZE) : 0;

  const columns: Column<JobDefinition>[] = [
    {
      key: 'state',
      header: t('PLUGIN_JOBDEFINITION_STATE'),
      render: (job) => (
        <Tag size="sm" type={job.suspended ? 'gray' : 'green'}>
          {t(job.suspended ? 'PLUGIN_JOBDEFINITION_SUSPENDED' : 'PLUGIN_JOBDEFINITION_ACTIVE')}
        </Tag>
      ),
    },
    { key: 'activity', header: t('PLUGIN_JOBDEFINITION_ACTIVITY'), render: (job) => names.get(job.activityId) || job.activityId },
    { key: 'type', header: t('PLUGIN_JOBDEFINITION_TYPE'), render: (job) => job.jobType },
    { key: 'configuration', header: t('PLUGIN_JOBDEFINITION_CONFIGURATION'), render: (job) => job.jobConfiguration },
    { key: 'priority', header: t('PLUGIN_JOBDEFINITION_JOB_PRIORITY'), render: (job) => job.overridingJobPriority },
    {
      key: 'action',
      header: t('PLUGIN_JOBDEFINITION_ACTION'),
      render: (job) => (
        <>
          <Button
            kind="ghost"
            size="sm"
            hasIconOnly
            renderIcon={job.suspended ? Play : Pause}
            iconDescription={t(job.suspended ? 'PLUGIN_JOBDEFINITION_STATE_ACTION_TOOLTIP_1' : 'PLUGIN_JOBDEFINITION_STATE_ACTION_TOOLTIP_2')}
            onClick={() => setDialog({ kind: 'suspension', jobDefinition: job })}
          />
          <Button
            kind="ghost"
            size="sm"
            hasIconOnly
            renderIcon={SettingsAdjust}
            iconDescription={t('PLUGIN_JOBDEFINITION_ACTION_OVERRIDE_TOOLTIP_CHANGE')}
            onClick={() => setDialog({ kind: 'priority', jobDefinition: job })}
          />
        </>
      ),
    },
  ];

  return (
    <>
      {jobDefinitions.isPending && <SkeletonText paragraph lineCount={3} />}
      {jobDefinitions.isError && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={jobDefinitions.error.message} />}
      {jobDefinitions.data && shown.length === 0 && <p className="cz-list-empty">{t('PLUGIN_JOBDEFINITION_NO_JOB_DEFINITION')}</p>}
      {shown.length > 0 && <ListTable columns={columns} items={shown} rowKey={(job) => job.id} />}
      {pageCount > 1 && (
        <PaginationNav totalItems={pageCount} page={page - 1} itemsShown={7} onChange={(index: number) => setPage(index + 1)} />
      )}
      {dialog?.kind === 'suspension' && (
        <JobDefinitionSuspension engine={engine} jobDefinition={dialog.jobDefinition} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'priority' && (
        <JobPriority engine={engine} jobDefinition={dialog.jobDefinition} onClose={() => setDialog(null)} />
      )}
    </>
  );
}

interface DialogProps {
  engine: string;
  jobDefinition: JobDefinition;
  onClose: () => void;
}

/** Suspends or activates a job definition, with or without its jobs, now or later. */
function JobDefinitionSuspension({ engine, jobDefinition, onClose }: DialogProps) {
  const { t } = useTranslation('cockpit');
  const invalidate = useInvalidateCockpit(engine);
  const suspend = !jobDefinition.suspended;
  const update = useMutation({
    mutationFn: (body: { includeJobs: boolean; executionDate?: string }) =>
      request<void>(engineUrl(engine, `/job-definition/${encodeURIComponent(jobDefinition.id)}/suspended`), {
        method: 'PUT',
        json: { suspended: suspend, ...body },
      }),
    onSettled: invalidate,
  });
  return (
    <SuspensionModal
      title={t(suspend ? 'PLUGIN_JOBDEFINITION_STATE_ACTION_TOOLTIP_2' : 'PLUGIN_JOBDEFINITION_STATE_ACTION_TOOLTIP_1')}
      legend={t(suspend ? 'PLUGIN_JOBDEFINITION_LEGEND_SUSPEND' : 'PLUGIN_JOBDEFINITION_LEGEND_ACTIVE')}
      includeLabel={t('PLUGIN_JOBDEFINITION_INCLUDE_EXISTING_JOB')}
      submitLabel={t(suspend ? 'PLUGIN_JOBDEFINITION_SUSPEND' : 'PLUGIN_JOBDEFINITION_ACTIVATE')}
      closeLabel={t('PLUGIN_JOBDEFINITION_CLOSE')}
      labels={{
        execute: t('PLUGIN_JOBDEFINITION_EXECUTE'),
        immediately: t('PLUGIN_JOBDEFINITION_IMMEDIATELY'),
        delayed: t('PLUGIN_JOBDEFINITION_DELAYED'),
        scheduleAt: t('PLUGIN_JOBDEFINITION_SCHEDULE_AT'),
        invalidDate: `${t('PLUGIN_JOBDEFINITION_INVALID_DATE_VALUE')} ${t('PLUGIN_JOBDEFINITION_SUPPORTED_PATTERN')}`,
      }}
      busy={update.isPending}
      onClose={onClose}
      onSubmit={({ includeExisting, executionDate }) =>
        update.mutate(
          { includeJobs: includeExisting, executionDate },
          {
            onSuccess: () => {
              notify({
                kind: 'success',
                title: t('PLUGIN_JOBDEFINITION_STATE_STATUS'),
                subtitle: t(executionDate ? 'PLUGIN_JOBDEFINITION_STATE_MESSAGES_2' : 'PLUGIN_JOBDEFINITION_STATE_MESSAGES_1'),
              });
              onClose();
            },
            onError: (error) =>
              notify({
                kind: 'error',
                title: t('PLUGIN_JOBDEFINITION_STATE_STATUS'),
                subtitle: t(executionDate ? 'PLUGIN_JOBDEFINITION_STATE_ERR_2' : 'PLUGIN_JOBDEFINITION_STATE_ERR_1', { message: error.message }),
              }),
          },
        )
      }
    />
  );
}

/** Sets or clears the overriding priority of the jobs of a job definition. */
function JobPriority({ engine, jobDefinition, onClose }: DialogProps) {
  const { t } = useTranslation('cockpit');
  const invalidate = useInvalidateCockpit(engine);
  const [priority, setPriority] = useState(jobDefinition.overridingJobPriority?.toString() ?? '');
  const [includeJobs, setIncludeJobs] = useState(false);
  const clear = priority.trim() === '';
  const valid = clear || /^-?\d+$/.test(priority.trim());
  const update = useMutation({
    mutationFn: () =>
      request<void>(engineUrl(engine, `/job-definition/${encodeURIComponent(jobDefinition.id)}/jobPriority`), {
        method: 'PUT',
        json: clear ? { priority: null } : { priority: Number(priority.trim()), includeJobs },
      }),
    onSettled: invalidate,
  });
  return (
    <Modal
      open
      modalHeading={t('PLUGIN_JOBDEFINITION_ACTION_OVERRIDE_JP')}
      primaryButtonText={t(clear ? 'PLUGIN_JOBDEFINITION_ACTION_CLEAR' : 'PLUGIN_JOBDEFINITION_ACTION_OVERRIDE')}
      secondaryButtonText={t('PLUGIN_JOBDEFINITION_ACTION_CLOSE')}
      primaryButtonDisabled={!valid || update.isPending || (clear && jobDefinition.overridingJobPriority === null)}
      onRequestClose={onClose}
      onRequestSubmit={() =>
        update.mutate(undefined, {
          onSuccess: () => {
            notify({
              kind: 'success',
              title: t('PLUGIN_JOBDEFINITION_ACTION_STATUS_FINISHED'),
              subtitle: t(clear ? 'PLUGIN_JOBDEFINITION_ACTION_DIALOG_MSN_2' : 'PLUGIN_JOBDEFINITION_ACTION_DIALOG_MSN_1'),
            });
            onClose();
          },
          onError: (error) =>
            notify({
              kind: 'error',
              title: t('PLUGIN_JOBDEFINITION_ACTION_OVERRIDE_JP'),
              subtitle: t(clear ? 'PLUGIN_JOBDEFINITION_ACTION_DIALOG_ERR_2' : 'PLUGIN_JOBDEFINITION_ACTION_DIALOG_ERR_1', { message: error.message }),
            }),
        })
      }
    >
      <Stack gap={5}>
        <p>{t('PLUGIN_JOBDEFINITION_ACTION_OVERRIDE_TEXT')}</p>
        <TextInput
          id="cz-job-priority"
          labelText={t('PLUGIN_JOBDEFINITION_ACTION_PRIORITY')}
          helperText={t('PLUGIN_JOBDEFINITION_ACTION_PRIORITY_TOOLTIP')}
          value={priority}
          invalid={!valid}
          invalidText={t('PLUGIN_JOBDEFINITION_ACTION_INVALID_VALUE')}
          onChange={(event) => setPriority(event.target.value)}
        />
        <Checkbox
          id="cz-job-priority-include"
          labelText={t('PLUGIN_JOBDEFINITION_ACTION_INCLUDE_EXISTING_JOB')}
          helperText={t('PLUGIN_JOBDEFINITION_ACTION_INCLUDE_EXISTING_JOB_TOOLTIP')}
          disabled={clear}
          checked={includeJobs}
          onChange={(_, { checked }) => setIncludeJobs(checked)}
        />
      </Stack>
    </Modal>
  );
}

export const tab: DefinitionTab = {
  id: 'job-definition-table',
  label: 'PLUGIN_JOB_DEFINITION_LABEL',
  order: 40,
  component: JobDefinitionsTab,
};
