import { useEffect, useState } from 'react';
import { ContainedList, ContainedListItem, InlineNotification, PaginationNav, SkeletonText } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { displayName, formatRelative } from '../../shared/format';
import { TASK_PAGE_SIZE, useFilterTasks } from './api';

interface TaskListProps {
  engine: string;
  filterId: string | undefined;
  selectedId: string | undefined;
  onSelect: (taskId: string) => void;
}

export function TaskList({ engine, filterId, selectedId, onSelect }: TaskListProps) {
  const { t, i18n } = useTranslation('tasklist');
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [filterId]);

  const tasks = useFilterTasks(engine, filterId, page);
  const pageCount = tasks.data ? Math.ceil(tasks.data.count / TASK_PAGE_SIZE) : 0;

  return (
    <section className="cz-tasklist__column cz-tasklist__tasks" aria-labelledby="cz-tasks-title">
      <ContainedList label={<span id="cz-tasks-title">{t('TASKS')}</span>} kind="on-page">
        {tasks.isPending && filterId && <SkeletonText paragraph lineCount={5} />}
        {tasks.isError && (
          <InlineNotification kind="error" lowContrast hideCloseButton subtitle={t('TASK_LIST_LOADING_FAILURE')} />
        )}
        {tasks.data?.tasks.length === 0 && <p className="cz-tasklist__empty">{t('NO_TASKS_IN_FILTER')}</p>}
        {tasks.data?.tasks.map((task) => {
          const definition = task.processDefinitionId
            ? tasks.data.processDefinitions.get(task.processDefinitionId)
            : undefined;
          return (
            <ContainedListItem
              key={task.id}
              className={task.id === selectedId ? 'cz-list-item--selected' : undefined}
              aria-current={task.id === selectedId ? 'true' : undefined}
              onClick={() => onSelect(task.id)}
            >
              <span className="cz-task-card">
                <span className="cz-task-card__name">{task.name || task.taskDefinitionKey}</span>
                {definition && (
                  <span className="cz-task-card__process">{definition.name || definition.key}</span>
                )}
                <span className="cz-task-card__meta">
                  <span title={t('CREATED_AT')}>{formatRelative(task.created, i18n.language)}</span>
                  <span>{task.assignee ? displayName(tasks.data.users.get(task.assignee), task.assignee) : t('UNASSIGNED')}</span>
                </span>
              </span>
            </ContainedListItem>
          );
        })}
      </ContainedList>
      {pageCount > 1 && (
        <PaginationNav
          className="cz-tasklist__pagination"
          totalItems={pageCount}
          page={page - 1}
          itemsShown={5}
          onChange={(index: number) => setPage(index + 1)}
        />
      )}
    </section>
  );
}
