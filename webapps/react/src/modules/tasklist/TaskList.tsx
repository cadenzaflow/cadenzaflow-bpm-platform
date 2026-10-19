import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  ContainedList,
  ContainedListItem,
  InlineNotification,
  PaginationNav,
  Select,
  SelectItem,
  SkeletonText,
} from '@carbon/react';
import { Search, SortAscending, SortDescending } from '@carbon/icons-react';
import { useTranslation } from 'react-i18next';
import { displayName, formatDateTime, formatRelative } from '../../shared/format';
import { PluginPoint } from '../../shared/plugins/PluginPoint';
import { toQuery, type SearchState } from '../../shared/search/criteria';
import { CriteriaSearch } from '../../shared/search/CriteriaSearch';
import { focusFirst, useShortcut } from '../../shared/shortcuts';
import { TASK_PAGE_SIZE, useFilterTasks, type TaskFilter, type TaskVariable } from './api';
import { useTasklistShortcuts } from './shortcuts/shortcuts';
import { SORT_FIELDS, TASK_CRITERIA, type Sorting } from './task-search';

interface TaskListProps {
  engine: string;
  filter: TaskFilter | undefined;
  page: number;
  sorting: Sorting;
  search: SearchState;
  selectedId: string | undefined;
  onSelect: (taskId: string) => void;
  onPageChange: (page: number) => void;
  onSortingChange: (sorting: Sorting) => void;
  onSearchChange: (search: SearchState) => void;
}

function variableText(variable: TaskVariable, language: string): string {
  if (variable.value === null || variable.value === undefined) {
    return '';
  }
  return variable.type === 'Date' ? formatDateTime(String(variable.value), language) : String(variable.value);
}

export function TaskList({
  engine,
  filter,
  page,
  sorting,
  search,
  selectedId,
  onSelect,
  onPageChange,
  onSortingChange,
  onSearchChange,
}: TaskListProps) {
  const { t, i18n } = useTranslation('tasklist');
  const [searchOpen, setSearchOpen] = useState(search.criteria.length > 0);
  const [draft, setDraft] = useState(search);
  const section = useRef<HTMLElement>(null);
  const shortcuts = useTasklistShortcuts();
  useShortcut(shortcuts.focusList.key, () =>
    focusFirst(section.current, '.cds--contained-list-item__content'),
  );

  // apply the search while typing, without a request per key
  useEffect(() => {
    const timer = setTimeout(() => {
      if (JSON.stringify(draft) !== JSON.stringify(search)) {
        onSearchChange(draft);
      }
    }, 500);
    return () => clearTimeout(timer);
    // only the draft drives this; search is what it is compared with
  }, [draft]);

  const query = useMemo(() => ({ sorting: [sorting], ...toQuery(search, TASK_CRITERIA) }), [sorting, search]);
  const tasks = useFilterTasks(engine, filter, page, query);
  const pageCount = tasks.data ? Math.ceil(tasks.data.count / TASK_PAGE_SIZE) : 0;
  const labels = new Map((filter?.properties?.variables ?? []).map((v) => [v.name, v.label || v.name]));

  return (
    <section ref={section} className="cz-tasklist__column cz-tasklist__tasks" aria-labelledby="cz-tasks-title">
      <div className="cz-tasklist__toolbar">
        <Select
          id="cz-task-sort"
          size="sm"
          inline
          labelText={t('SORT_BY')}
          value={sorting.sortBy}
          onChange={(event) => onSortingChange({ ...sorting, sortBy: event.target.value })}
        >
          {SORT_FIELDS.map((field) => (
            <SelectItem key={field.key} value={field.key} text={t(field.label)} />
          ))}
        </Select>
        <Button
          kind="ghost"
          size="sm"
          hasIconOnly
          renderIcon={sorting.sortOrder === 'asc' ? SortAscending : SortDescending}
          iconDescription={t(sorting.sortOrder === 'asc' ? 'ASC' : 'DESC')}
          onClick={() => onSortingChange({ ...sorting, sortOrder: sorting.sortOrder === 'asc' ? 'desc' : 'asc' })}
        />
        <Button
          kind={searchOpen ? 'secondary' : 'ghost'}
          size="sm"
          renderIcon={Search}
          aria-expanded={searchOpen}
          onClick={() => setSearchOpen((open) => !open)}
        >
          {t('SEARCH')}
          {search.criteria.length > 0 && ` (${search.criteria.length})`}
        </Button>
        <PluginPoint module="tasklist" point="tasklist.header" engine={engine} className="cz-plugin-inline" />
      </div>
      {searchOpen && (
        <div className="cz-tasklist__search">
          <CriteriaSearch namespace="tasklist" types={TASK_CRITERIA} value={draft} onChange={setDraft} total={tasks.data?.count} />
        </div>
      )}
      <PluginPoint module="tasklist" point="tasklist.list" engine={engine} className="cz-tasklist__plugin" />
      <ContainedList label={<span id="cz-tasks-title">{t('TASKS')}</span>} kind="on-page">
        {tasks.isPending && filter && <SkeletonText paragraph lineCount={5} />}
        {tasks.isError && (
          <InlineNotification kind="error" lowContrast hideCloseButton subtitle={t('TASK_LIST_LOADING_FAILURE')} />
        )}
        {tasks.data?.tasks.length === 0 && <p className="cz-tasklist__empty">{t('NO_TASKS_IN_FILTER')}</p>}
        {tasks.data?.tasks.map((task) => {
          const definition = task.processDefinitionId
            ? tasks.data.processDefinitions.get(task.processDefinitionId)
            : undefined;
          const shown = task.variables.filter((variable) => labels.has(variable.name));
          return (
            <ContainedListItem
              key={task.id}
              className={task.id === selectedId ? 'cz-list-item--selected' : undefined}
              aria-current={task.id === selectedId ? 'true' : undefined}
              onClick={() => onSelect(task.id)}
            >
              <span className="cz-task-card">
                <span className="cz-task-card__name">{task.name || task.taskDefinitionKey}</span>
                {definition && <span className="cz-task-card__process">{definition.name || definition.key}</span>}
                {shown.length > 0 && (
                  <span className="cz-task-card__variables">
                    {shown.map((variable) => (
                      <span key={variable.name}>
                        <span className="cz-task-card__label">{labels.get(variable.name)}:</span>{' '}
                        {variableText(variable, i18n.language)}
                      </span>
                    ))}
                  </span>
                )}
                <PluginPoint module="tasklist" point="tasklist.card" engine={engine} props={{ taskId: task.id }} />
                <span className="cz-task-card__meta">
                  <span title={t('CREATION_DATE')}>{formatRelative(task.created, i18n.language)}</span>
                  <span>
                    {task.assignee ? displayName(tasks.data.users.get(task.assignee), task.assignee) : t('UNASSIGNED')}
                  </span>
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
          onChange={(index: number) => onPageChange(index + 1)}
        />
      )}
    </section>
  );
}
