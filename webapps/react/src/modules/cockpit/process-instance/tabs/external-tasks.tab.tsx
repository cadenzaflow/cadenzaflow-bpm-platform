import { useMemo } from 'react';
import { Button } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { engineUrl } from '../../../../shared/api/client';
import { formatDateTime } from '../../../../shared/format';
import type { Column } from '../../../../shared/ui/ListTable';
import { SearchableList } from '../../../../shared/ui/SearchableList';
import type { InstanceTab, InstanceTabProps } from './registry';

/** An external task of the instance as the engine REST API lists it. */
interface ExternalTask {
  id: string;
  activityId: string;
  retries: number | null;
  workerId: string | null;
  lockExpirationTime: string | null;
  topicName: string;
  priority: number;
}

/** The open external tasks of the instance (or of the selected activities), with their workers and locks. */
function ExternalTasksTab({ engine, instance, activityIds, activityNames, onActivitySelect, search, onSearchChange }: InstanceTabProps) {
  const { t, i18n } = useTranslation('cockpit');
  const fixedQuery = useMemo(
    () => ({ processInstanceId: instance.id, activityIdIn: activityIds.length ? activityIds : undefined }),
    [instance.id, activityIds.join(',')],
  );

  const columns: Column<ExternalTask>[] = [
    { key: 'id', header: t('PLUGIN_EXT_EXTERNAL_TASK_ID'), render: (task) => task.id },
    {
      key: 'activity',
      header: t('PLUGIN_EXT_ACTIVITY'),
      render: (task) => (
        <Button kind="ghost" size="sm" className="cz-link-button" onClick={() => onActivitySelect(task.activityId)}>
          {activityNames.get(task.activityId) || task.activityId}
        </Button>
      ),
    },
    { key: 'retries', header: t('PLUGIN_EXT_RETRIES'), render: (task) => task.retries },
    { key: 'workerId', header: t('PLUGIN_EXT_WORKER_ID'), render: (task) => task.workerId },
    {
      key: 'lockExpirationTime',
      header: t('PLUGIN_EXT_LOCK_EXPIRATION_TIME'),
      render: (task) => task.lockExpirationTime && formatDateTime(task.lockExpirationTime, i18n.language),
    },
    { key: 'topic', header: t('PLUGIN_EXT_TOPIC'), render: (task) => task.topicName },
    { key: 'priority', header: t('PLUGIN_EXT_PRIORITY'), sortBy: 'taskPriority', render: (task) => task.priority },
  ];

  return (
    <SearchableList<ExternalTask>
      scope={['cockpit', engine, 'list']}
      listUrl={engineUrl(engine, '/external-task')}
      countUrl={engineUrl(engine, '/external-task/count')}
      method="POST"
      fixedQuery={fixedQuery}
      defaultSortBy="taskPriority"
      columns={columns}
      emptyText={t('PLUGIN_EXTERNAL_TASK_NO_EXTERNAL_TASK_FOR_THIS_PROCESS')}
      search={search}
      onSearchChange={onSearchChange}
    />
  );
}

export const tab: InstanceTab = {
  id: 'external-tasks-process-instance-runtime',
  label: 'PLUGIN_EXTERNAL_TASKS_LABEL',
  order: 60,
  component: ExternalTasksTab,
};
