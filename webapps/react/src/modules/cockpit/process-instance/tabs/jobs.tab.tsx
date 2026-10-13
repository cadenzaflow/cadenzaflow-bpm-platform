import { useMemo, useState } from 'react';
import { Button } from '@carbon/react';
import { Pause, Play, Time } from '@carbon/icons-react';
import { useTranslation } from 'react-i18next';
import { engineUrl } from '../../../../shared/api/client';
import { formatDateTime } from '../../../../shared/format';
import { notify } from '../../../../shared/notifications';
import type { Column } from '../../../../shared/ui/ListTable';
import { SearchableList } from '../../../../shared/ui/SearchableList';
import { useJobActivity, useJobSuspension, type Job } from '../jobs/api';
import { DueDateModal } from '../jobs/DueDateModal';
import type { InstanceTab, InstanceTabProps } from './registry';

/** The activity of a job, which selects it like a click in the diagram. */
function JobActivity({ engine, job, names, onSelect }: { engine: string; job: Job; names: Map<string, string>; onSelect: (activityId: string) => void }) {
  const activity = useJobActivity(engine, job.jobDefinitionId);
  return activity.data ? (
    <Button kind="ghost" size="sm" className="cz-link-button" onClick={() => onSelect(activity.data)}>
      {names.get(activity.data) || activity.data}
    </Button>
  ) : null;
}

/** All jobs of the instance (timers, asynchronous continuations): suspended, resumed and rescheduled. */
function JobsTab({ engine, instance, activityNames, onActivitySelect, search, onSearchChange }: InstanceTabProps) {
  const { t, i18n } = useTranslation('cockpit');
  const suspension = useJobSuspension(engine);
  const [rescheduled, setRescheduled] = useState<Job | null>(null);
  const fixedQuery = useMemo(() => ({ processInstanceId: instance.id }), [instance.id]);
  const date = (value: string | null) => (value ? formatDateTime(value, i18n.language) : <span className="cz-null">null</span>);

  const toggleSuspension = (job: Job) =>
    suspension.mutate(
      { id: job.id, suspended: !job.suspended },
      {
        onSuccess: () => notify({ kind: 'success', title: t('PLUGIN_JOBS_SUCCESS'), subtitle: t('PLUGIN_JOBS_SUSPEND_SUCCESS') }),
        onError: (error) => notify({ kind: 'error', title: t('PLUGIN_JOBS_ERROR'), subtitle: `${t('PLUGIN_JOBS_SUSPEND_FAILURE')} ${error.message}` }),
      },
    );

  const columns: Column<Job>[] = [
    { key: 'id', header: t('PLUGIN_JOBS_ID'), sortBy: 'jobId', render: (job) => job.id },
    { key: 'dueDate', header: t('PLUGIN_JOBS_DATE'), sortBy: 'jobDueDate', render: (job) => date(job.dueDate) },
    { key: 'createTime', header: t('PLUGIN_JOBS_CREATION_DATE'), render: (job) => date(job.createTime) },
    { key: 'retries', header: t('PLUGIN_JOBS_RETRIES'), sortBy: 'jobRetries', render: (job) => job.retries },
    {
      key: 'activity',
      header: t('PLUGIN_JOBS_ACTIVITY'),
      render: (job) => <JobActivity engine={engine} job={job} names={activityNames} onSelect={onActivitySelect} />,
    },
    {
      key: 'failedActivity',
      header: t('PLGN_HIST_FAILING_ACTIVITY'),
      render: (job) => job.failedActivityId && (activityNames.get(job.failedActivityId) || job.failedActivityId),
    },
    {
      key: 'action',
      header: t('PLUGIN_JOBS_ACTION'),
      render: (job) => (
        <span className="cz-row-actions">
          <Button
            kind="ghost"
            size="sm"
            hasIconOnly
            renderIcon={job.suspended ? Play : Pause}
            iconDescription={t(job.suspended ? 'PLUGIN_JOBS_RESUME_TOOLTIP' : 'PLUGIN_JOBS_SUSPEND_TOOLTIP')}
            disabled={suspension.isPending}
            onClick={() => toggleSuspension(job)}
          />
          {job.dueDate && (
            <Button
              kind="ghost"
              size="sm"
              hasIconOnly
              renderIcon={Time}
              iconDescription={t('PLUGIN_JOB_RECALCULATE_TOOLTIP')}
              onClick={() => setRescheduled(job)}
            />
          )}
        </span>
      ),
    },
  ];

  return (
    <>
      <SearchableList<Job>
        scope={['cockpit', engine, 'list']}
        listUrl={engineUrl(engine, '/job')}
        countUrl={engineUrl(engine, '/job/count')}
        fixedQuery={fixedQuery}
        defaultSortBy="jobId"
        defaultSortOrder="desc"
        columns={columns}
        emptyText={t('PLUGIN_JOBS_NO_JOBS')}
        search={search}
        onSearchChange={onSearchChange}
      />
      {rescheduled && <DueDateModal engine={engine} job={rescheduled} onClose={() => setRescheduled(null)} />}
    </>
  );
}

export const tab: InstanceTab = {
  id: 'jobs-tab',
  label: 'PLUGIN_JOBS_LABEL',
  order: 50,
  component: JobsTab,
};
