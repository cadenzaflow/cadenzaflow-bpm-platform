import { useMemo, useState } from 'react';
import { Button } from '@carbon/react';
import { Group, User } from '@carbon/icons-react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { engineUrl } from '../../../../shared/api/client';
import { formatDateTime } from '../../../../shared/format';
import type { Column } from '../../../../shared/ui/ListTable';
import { SearchableList } from '../../../../shared/ui/SearchableList';
import type { LinkKey, UserTask } from '../user-tasks/api';
import { AssigneeCell } from '../user-tasks/AssigneeCell';
import { IdentityLinksModal } from '../user-tasks/IdentityLinksModal';
import type { InstanceTab, InstanceTabProps } from './registry';

/** The open user tasks of the instance (or of the selected activity instances): assignee and candidates can be changed. */
function UserTasksTab({
  engine,
  instance,
  activityInstanceIds,
  activityInstanceNames,
  executionActivityInstances,
  onActivityInstanceSelect,
  search,
  onSearchChange,
}: InstanceTabProps) {
  const { t, i18n } = useTranslation('cockpit');
  const [links, setLinks] = useState<{ taskId: string; linkKey: LinkKey } | null>(null);
  const fixedQuery = useMemo(
    () => ({ processInstanceId: instance.id, activityInstanceIdIn: activityInstanceIds.length ? activityInstanceIds : undefined }),
    [instance.id, activityInstanceIds.join(',')],
  );
  const date = (value: string | null) => (value ? formatDateTime(value, i18n.language) : null);
  const label = (task: UserTask) => {
    const activityInstanceId = executionActivityInstances.get(task.executionId);
    return (activityInstanceId && activityInstanceNames.get(activityInstanceId)) || task.name || task.id;
  };

  const columns: Column<UserTask>[] = [
    {
      key: 'activity',
      header: t('PLUGIN_USER_TASKS_ACTIVITY'),
      sortBy: 'nameCaseInsensitive',
      render: (task) => {
        const activityInstanceId = executionActivityInstances.get(task.executionId);
        return activityInstanceId ? (
          <Button kind="ghost" size="sm" className="cz-link-button" onClick={() => onActivityInstanceSelect(activityInstanceId)}>
            {label(task)}
          </Button>
        ) : (
          label(task)
        );
      },
    },
    { key: 'assignee', header: t('PLUGIN_USER_TASKS_ASSIGNEE'), sortBy: 'assignee', render: (task) => <AssigneeCell engine={engine} task={task} label={label(task)} /> },
    { key: 'owner', header: t('PLUGIN_USER_TASKS_OWNER'), render: (task) => task.owner },
    { key: 'created', header: t('PLUGIN_USER_TASKS_CREATED_DATE'), sortBy: 'created', render: (task) => date(task.created) },
    { key: 'due', header: t('PLUGIN_USER_TASKS_DUE_DATE'), sortBy: 'dueDate', render: (task) => date(task.due) },
    { key: 'followUp', header: t('PLUGIN_USER_TASKS_FOLLOW_UP_DATE'), sortBy: 'followUpDate', render: (task) => date(task.followUp) },
    { key: 'priority', header: t('PLUGIN_USER_TASKS_PRIORITY'), sortBy: 'priority', render: (task) => task.priority },
    { key: 'delegationState', header: t('PLUGIN_USER_TASKS_DELEGATION_STATE'), render: (task) => task.delegationState },
    {
      key: 'id',
      header: t('PLUGIN_USER_TASKS_TASK_ID'),
      sortBy: 'id',
      render: (task) => (
        <Link to="/tasklist/$engine" params={{ engine }} search={{ task: task.id }} title={t('PLUGIN_USER_TASKS_LINK_TO_TASKLIST')}>
          {task.id}
        </Link>
      ),
    },
    {
      key: 'action',
      header: t('PLUGIN_USER_TASKS_ACTION'),
      render: (task) => (
        <span className="cz-row-actions">
          <Button
            kind="ghost"
            size="sm"
            hasIconOnly
            renderIcon={Group}
            iconDescription={t('PLUGIN_USER_TASKS_MANAGE_GROUP_TOOLTIP', { value: task.name || task.id })}
            onClick={() => setLinks({ taskId: task.id, linkKey: 'groupId' })}
          />
          <Button
            kind="ghost"
            size="sm"
            hasIconOnly
            renderIcon={User}
            iconDescription={t('PLUGIN_USER_TASKS_MANAGE_USER_TOOLTIP', { value: task.name || task.id })}
            onClick={() => setLinks({ taskId: task.id, linkKey: 'userId' })}
          />
        </span>
      ),
    },
  ];

  return (
    <>
      <SearchableList<UserTask>
        scope={['cockpit', engine, 'list']}
        listUrl={engineUrl(engine, '/task')}
        countUrl={engineUrl(engine, '/task/count')}
        method="POST"
        fixedQuery={fixedQuery}
        defaultSortBy="created"
        defaultSortOrder="desc"
        columns={columns}
        emptyText={t('PLUGIN_USER_TASKS_NO_USER_TASKS')}
        search={search}
        onSearchChange={onSearchChange}
      />
      {links && <IdentityLinksModal engine={engine} taskId={links.taskId} linkKey={links.linkKey} onClose={() => setLinks(null)} />}
    </>
  );
}

export const tab: InstanceTab = {
  id: 'user-tasks-tab',
  label: 'PLUGIN_USER_TASKS_LABEL',
  order: 40,
  component: UserTasksTab,
};
