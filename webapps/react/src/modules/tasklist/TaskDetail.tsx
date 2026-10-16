import { InlineNotification, SkeletonText, Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../shared/api/client';
import { formatDateTime } from '../../shared/format';
import { notify } from '../../shared/notifications';
import { PluginPoint, PluginView } from '../../shared/plugins/PluginPoint';
import { usePluginPoint } from '../../shared/plugins/plugins';
import { useTask, type TaskDetails } from './api';
import { useUpdateTask } from './task-meta/api';
import { AssigneeField } from './task-meta/AssigneeField';
import { CommentButton } from './task-meta/CommentButton';
import { DateField } from './task-meta/DateField';
import { GroupsField } from './task-meta/GroupsField';
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
  const pluginTabs = usePluginPoint('tasklist', 'tasklist.task.detail');
  // the built-in tabs, then those of plugins
  const tabs = [
    ...visibleTabs(task).map((tab) => ({ id: tab.id, label: tab.label, tab, plugin: undefined })),
    ...pluginTabs.map((plugin) => ({ id: plugin.id, label: plugin.label ?? plugin.id, tab: undefined, plugin })),
  ];
  const selectedIndex = Math.max(0, tabs.findIndex((tab) => tab.id === tabId));
  const update = useUpdateTask(engine, task);
  const saveDate = (field: 'due' | 'followUp') => (value: string | null) =>
    update.mutateAsync({ [field]: value }).catch((error: Error) => {
      notify({ kind: 'error', title: t('TASK_UPDATE_ERROR'), subtitle: error.message });
      throw error;
    });

  return (
    <article className="cz-task">
      <header className="cz-task__header">
        <h2 className="cz-task__name">{task.name || task.taskDefinitionKey}</h2>
        <AssigneeField engine={engine} details={details} />
      </header>
      <dl className="cz-task__fields">
        {processDefinition && (
          <div className="cz-task__field">
            <dt>{t('PROCESS_DEFINITION')}</dt>
            <dd>{processDefinition.name || processDefinition.key}</dd>
          </div>
        )}
        <div className="cz-task__field">
          <dt>{t('CREATED_AT')}</dt>
          <dd>{formatDateTime(task.created, i18n.language)}</dd>
        </div>
        <DateField
          id="cz-task-due"
          label={t('DUE_DATE')}
          value={task.due}
          setLabel={t('SET_DUE_DATE')}
          resetLabel={t('RESET_DUE_DATE')}
          disabled={update.isPending}
          onSave={saveDate('due')}
        />
        <DateField
          id="cz-task-follow-up"
          label={t('FOLLOW_UP_DATE')}
          value={task.followUp}
          setLabel={t('SET_FOLLOW_UP_DATE')}
          resetLabel={t('RESET_FOLLOW_UP_DATE')}
          disabled={update.isPending}
          onSave={saveDate('followUp')}
        />
        <div className="cz-task__field">
          <dt>{t('PRIORITY')}</dt>
          <dd>{task.priority}</dd>
        </div>
        <GroupsField engine={engine} taskId={task.id} />
      </dl>
      <div className="cz-task__actions">
        <CommentButton engine={engine} taskId={task.id} processInstanceId={task.processInstanceId} />
        <PluginPoint module="tasklist" point="tasklist.task.action" engine={engine} props={{ taskId: task.id }} className="cz-plugin-inline" />
      </div>
      {tabs.length > 0 && (
        <Tabs selectedIndex={selectedIndex} onChange={({ selectedIndex: index }) => onTabChange(tabs[index].id)}>
          <TabList aria-label={t('TASK')}>
            {tabs.map((tab) => (
              <Tab key={tab.id}>{t(tab.label)}</Tab>
            ))}
          </TabList>
          <TabPanels>
            {/* only the selected tab renders: hidden tabs would load their data, and
                a diagram drawn into a hidden panel has no size */}
            {tabs.map((entry, index) => (
              <TabPanel key={entry.id}>
                {index === selectedIndex && entry.tab && (
                  <entry.tab.component engine={engine} task={task} onTaskCompleted={onTaskCompleted} />
                )}
                {index === selectedIndex && entry.plugin && (
                  <PluginView plugin={entry.plugin} engine={engine} props={{ taskId: task.id }} />
                )}
              </TabPanel>
            ))}
          </TabPanels>
        </Tabs>
      )}
    </article>
  );
}
