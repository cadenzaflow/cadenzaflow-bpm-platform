import { Button, InlineNotification, SkeletonText, Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../shared/api/client';
import { useAuthentication } from '../../shared/auth/authentication';
import { displayName, formatDateTime } from '../../shared/format';
import { useAssignTask, useTask, type TaskDetails } from './api';
import { visibleTabs } from './task-tabs/registry';

interface TaskDetailProps {
  engine: string;
  taskId: string | undefined;
  tabId: string | undefined;
  onTabChange: (tabId: string) => void;
  onTaskCompleted: () => void;
}

export function TaskDetail({ engine, taskId, tabId, onTabChange, onTaskCompleted }: TaskDetailProps) {
  const { t } = useTranslation('tasklist');
  const task = useTask(engine, taskId);

  let content;
  if (!taskId) {
    content = <p className="cz-tasklist__empty">{t('SELECT_TASK_IN_LIST')}</p>;
  } else if (task.isPending) {
    content = <SkeletonText heading paragraph lineCount={4} />;
  } else if (task.isError) {
    const gone = task.error instanceof ApiError && task.error.status === 404;
    content = (
      <InlineNotification
        kind={gone ? 'info' : 'error'}
        lowContrast
        hideCloseButton
        subtitle={gone ? t('TASK_NOT_EXIST') : task.error.message}
      />
    );
  } else {
    content = (
      <TaskView
        engine={engine}
        details={task.data}
        tabId={tabId}
        onTabChange={onTabChange}
        onTaskCompleted={onTaskCompleted}
      />
    );
  }

  return (
    <section className="cz-tasklist__column cz-tasklist__detail" aria-label={t('TASK')}>
      {content}
    </section>
  );
}

type TaskViewProps = { engine: string; details: TaskDetails } & Pick<
  TaskDetailProps,
  'tabId' | 'onTabChange' | 'onTaskCompleted'
>;

function TaskView({ engine, details, tabId, onTabChange, onTaskCompleted }: TaskViewProps) {
  const { t, i18n } = useTranslation('tasklist');
  const { task, processDefinition } = details;
  const tabs = visibleTabs(task);
  const selectedIndex = Math.max(0, tabs.findIndex((tab) => tab.id === tabId));

  const fields: [string, string][] = [
    [t('PROCESS_DEFINITION'), processDefinition ? processDefinition.name || processDefinition.key : ''],
    [t('CREATED_AT'), formatDateTime(task.created, i18n.language)],
    [t('DUE_DATE'), formatDateTime(task.due, i18n.language)],
    [t('FOLLOW_UP_DATE'), formatDateTime(task.followUp, i18n.language)],
    [t('PRIORITY'), String(task.priority)],
  ];

  return (
    <article className="cz-task">
      <header className="cz-task__header">
        <h2 className="cz-task__name">{task.name || task.taskDefinitionKey}</h2>
        <Assignment engine={engine} details={details} />
      </header>
      <dl className="cz-task__fields">
        {fields
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="cz-task__field">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>
      {tabs.length > 0 && (
        <Tabs selectedIndex={selectedIndex} onChange={({ selectedIndex: index }) => onTabChange(tabs[index].id)}>
          <TabList aria-label={t('TASK')}>
            {tabs.map((tab) => (
              <Tab key={tab.id}>{t(tab.label)}</Tab>
            ))}
          </TabList>
          <TabPanels>
            {tabs.map((tab) => (
              <TabPanel key={tab.id}>
                <tab.component engine={engine} task={task} onTaskCompleted={onTaskCompleted} />
              </TabPanel>
            ))}
          </TabPanels>
        </Tabs>
      )}
    </article>
  );
}

function Assignment({ engine, details: { task, users } }: { engine: string; details: TaskDetails }) {
  const { t } = useTranslation('tasklist');
  const userId = useAuthentication(engine).data?.userId ?? null;
  const assign = useAssignTask(engine, task.id);

  return (
    <div className="cz-task__assignment">
      <span>
        {t('ASSIGNEE')}: {task.assignee ? displayName(users.get(task.assignee), task.assignee) : t('UNASSIGNED')}
      </span>
      {!task.assignee && userId && (
        <Button size="sm" kind="primary" disabled={assign.isPending} onClick={() => assign.mutate(userId)}>
          {t('CLAIM_TASK')}
        </Button>
      )}
      {task.assignee && task.assignee === userId && (
        <Button size="sm" kind="tertiary" disabled={assign.isPending} onClick={() => assign.mutate(null)}>
          {t('UNCLAIM_TASK')}
        </Button>
      )}
      {assign.isError && (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          subtitle={task.assignee ? t('UNCLAIM_ERROR') : t('CLAIM_ERROR')}
        />
      )}
    </div>
  );
}
