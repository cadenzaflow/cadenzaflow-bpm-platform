import { useMemo, useState } from 'react';
import { Button, Checkbox, InlineNotification, Modal, Stack, TextInput } from '@carbon/react';
import { CheckmarkFilled, ErrorFilled, SettingsAdjust } from '@carbon/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { engineUrl, request } from '../../../shared/api/client';
import { elementNames } from '../../../shared/diagram/bpmn-names';
import { notify } from '../../../shared/notifications';
import { ListTable, type Column } from '../../../shared/ui/ListTable';
import { useInvalidateCockpit } from '../incidents/api';
import { useProcessDefinitionXml } from './api';

interface JobDefinition {
  id: string;
  activityId: string;
  jobType: string;
}

const PAGE = 2000;

/** All job definitions of a process definition, page by page. */
async function allJobDefinitions(engine: string, processDefinitionId: string): Promise<JobDefinition[]> {
  const result: JobDefinition[] = [];
  for (let first = 0; ; first += PAGE) {
    const query = new URLSearchParams({ processDefinitionId, firstResult: String(first), maxResults: String(PAGE) });
    const page = await request<JobDefinition[]>(engineUrl(engine, `/job-definition?${query}`));
    result.push(...page);
    if (page.length < PAGE) {
      return result;
    }
  }
}

/**
 * Sets or clears the overriding job priority of every job definition of the
 * process definition, and reports the outcome per job definition (the
 * classic Cockpit's bulk action).
 */
export function BulkJobPriority({ engine, processDefinitionId }: { engine: string; processDefinitionId: string }) {
  const { t } = useTranslation('cockpit');
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        kind="tertiary"
        size="md"
        hasIconOnly
        renderIcon={SettingsAdjust}
        iconDescription={t('BULK_OVERRIDE_TOOLTIP_CHANGE_OVRR')}
        tooltipPosition="left"
        onClick={() => setOpen(true)}
      />
      {open && <BulkJobPriorityModal engine={engine} processDefinitionId={processDefinitionId} onClose={() => setOpen(false)} />}
    </>
  );
}

type Outcome = 'SUCCESS' | 'FAILED';

function BulkJobPriorityModal({ engine, processDefinitionId, onClose }: { engine: string; processDefinitionId: string; onClose: () => void }) {
  const { t } = useTranslation('cockpit');
  const invalidate = useInvalidateCockpit(engine);
  const xml = useProcessDefinitionXml(engine, processDefinitionId);
  const names = useMemo(() => elementNames(xml.data), [xml.data]);
  const jobDefinitions = useQuery({
    queryKey: ['cockpit', engine, 'all-job-definitions', processDefinitionId],
    queryFn: () => allJobDefinitions(engine, processDefinitionId),
  });
  const [priority, setPriority] = useState('');
  const [includeJobs, setIncludeJobs] = useState(false);
  const [performing, setPerforming] = useState(false);
  const [outcomes, setOutcomes] = useState<Map<string, Outcome> | null>(null);
  const clear = priority.trim() === '';
  const valid = clear || /^-?\d+$/.test(priority.trim());
  const none = jobDefinitions.data?.length === 0;

  const submit = async () => {
    const definitions = jobDefinitions.data ?? [];
    setPerforming(true);
    const results = await Promise.allSettled(
      definitions.map((definition) =>
        request<void>(engineUrl(engine, `/job-definition/${encodeURIComponent(definition.id)}/jobPriority`), {
          method: 'PUT',
          json: clear ? { priority: null } : { priority: Number(priority.trim()), includeJobs },
        }),
      ),
    );
    const next = new Map<string, Outcome>(definitions.map((definition, index) => [definition.id, results[index].status === 'fulfilled' ? 'SUCCESS' : 'FAILED']));
    const failed = [...next.values()].includes('FAILED');
    setOutcomes(next);
    setPerforming(false);
    void invalidate();
    notify({
      kind: failed ? 'error' : 'success',
      title: t('BULK_OVERRIDE_STATUS_FINISHED'),
      subtitle: t(failed ? (clear ? 'BULK_OVERRIDE_ERROR_2' : 'BULK_OVERRIDE_ERROR_1') : clear ? 'BULK_OVERRIDE_CLEARING_MESSAGE' : 'BULK_OVERRIDE_MESSAGE'),
    });
  };

  const columns: Column<JobDefinition>[] = [
    { key: 'activity', header: t('BULK_OVERRIDE_ACTIVITY'), render: (definition) => names.get(definition.activityId) || definition.activityId },
    { key: 'type', header: t('BULK_OVERRIDE_TYPE'), render: (definition) => definition.jobType },
    {
      key: 'status',
      header: t('BULK_OVERRIDE_STATUS'),
      render: (definition) =>
        outcomes?.get(definition.id) === 'SUCCESS' ? (
          <span className="cz-outcome">
            <CheckmarkFilled aria-hidden="true" /> {t('BULK_OVERRIDE_SUCCESSFUL')}
          </span>
        ) : (
          <span className="cz-outcome cz-outcome--failed">
            <ErrorFilled aria-hidden="true" /> {t('BULK_OVERRIDE_FAILED')}
          </span>
        ),
    },
  ];

  return (
    <Modal
      open
      modalHeading={t('BULK_OVERRIDE_CHANGE_JOB_TEXT')}
      primaryButtonText={outcomes || none ? t('BULK_OVERRIDE_OK') : t(clear ? 'BULK_OVERRIDE_CLEAR' : 'BULK_OVERRIDE_OVERRIDE')}
      secondaryButtonText={outcomes || none ? undefined : t('BULK_OVERRIDE_CLOSE')}
      primaryButtonDisabled={!(outcomes || none) && (!valid || performing || !jobDefinitions.data)}
      onRequestClose={onClose}
      onRequestSubmit={() => (outcomes || none ? onClose() : void submit())}
    >
      {outcomes ? (
        <ListTable columns={columns} items={jobDefinitions.data ?? []} rowKey={(definition) => definition.id} />
      ) : none ? (
        <InlineNotification kind="info" lowContrast hideCloseButton subtitle={t('BULK_OVERRIDE_NO_JOB_DEFINITIONS')} />
      ) : (
        <Stack gap={5}>
          {jobDefinitions.isError && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={jobDefinitions.error.message} />}
          <p>{t('BULK_OVERRIDE_CHANGE_JOB_LEGEND')}</p>
          <TextInput
            id="cz-bulk-job-priority"
            labelText={t('BULK_OVERRIDE_PRIORITY')}
            helperText={t('PLUGIN_JOBDEFINITION_ACTION_PRIORITY_TOOLTIP')}
            value={priority}
            invalid={!valid}
            invalidText={t('PLUGIN_JOBDEFINITION_ACTION_INVALID_VALUE')}
            onChange={(event) => setPriority(event.target.value)}
          />
          <Checkbox
            id="cz-bulk-job-priority-include"
            labelText={t('BULK_OVERRIDE_INCLUDE_EXISTING_JOB')}
            helperText={t('PLUGIN_JOBDEFINITION_ACTION_INCLUDE_EXISTING_JOB_TOOLTIP')}
            disabled={clear}
            checked={includeJobs}
            onChange={(_, { checked }) => setIncludeJobs(checked)}
          />
          <p>{t('BULK_OVERRIDE_DO_YOU_REALLY')}</p>
        </Stack>
      )}
    </Modal>
  );
}
