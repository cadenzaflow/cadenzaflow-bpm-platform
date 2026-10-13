import { useEffect, useState } from 'react';
import { Button } from '@carbon/react';
import { Add, Play } from '@carbon/icons-react';
import { getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { FilterList } from './FilterList';
import { TaskList } from './TaskList';
import { TaskDetail } from './TaskDetail';
import { useTaskFilters, type TaskFilter } from './api';
import { FilterModal } from './filters/FilterModal';
import type { TasklistSearch } from './search';
import { DEFAULT_SORTING } from './task-search';
import { StartProcessModal } from './start-process/StartProcessModal';
import './tasklist.scss';

const route = getRouteApi('/tasklist/$engine');

/** Filters | tasks of the selected filter | selected task. */
export function TasklistPage() {
  const { t } = useTranslation('tasklist');
  const { engine } = route.useParams();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const filters = useTaskFilters(engine);
  const [startOpen, setStartOpen] = useState(false);
  // undefined: closed, null: new filter
  const [editedFilter, setEditedFilter] = useState<TaskFilter | null | undefined>(undefined);

  const update = (changes: Partial<TasklistSearch>) =>
    navigate({ search: (previous: TasklistSearch) => ({ ...previous, ...changes }) });

  // Without ?filter the first filter (highest priority) is selected.
  const firstFilterId = filters.data?.[0]?.id;
  useEffect(() => {
    if (!search.filter && firstFilterId) {
      navigate({ search: (previous: TasklistSearch) => ({ ...previous, filter: firstFilterId }), replace: true });
    }
  }, [search.filter, firstFilterId, navigate]);

  return (
    <div className="cz-tasklist">
      <FilterList
        filters={filters}
        selectedId={search.filter}
        onSelect={(filter) => update({ filter, task: undefined, page: undefined })}
        onEdit={setEditedFilter}
        actions={
          <>
            <Button kind="ghost" size="sm" renderIcon={Play} onClick={() => setStartOpen(true)}>
              {t('START_PROCESS')}
            </Button>
            <Button kind="ghost" size="sm" renderIcon={Add} onClick={() => setEditedFilter(null)}>
              {t('FILTER_CREATE')}
            </Button>
          </>
        }
      />
      <TaskList
        engine={engine}
        filter={filters.data?.find((filter) => filter.id === search.filter)}
        page={search.page ?? 1}
        sorting={search.sorting?.[0] ?? DEFAULT_SORTING}
        search={{ criteria: search.searchQuery ?? [], matchAny: search.searchMatch === 'any' }}
        selectedId={search.task}
        onSelect={(task) => update({ task })}
        onPageChange={(page) => update({ page: page > 1 ? page : undefined })}
        onSortingChange={(sorting) => update({ sorting: [sorting], page: undefined })}
        onSearchChange={({ criteria, matchAny }) =>
          update({
            searchQuery: criteria.length ? criteria : undefined,
            searchMatch: matchAny ? 'any' : undefined,
            page: undefined,
          })
        }
      />
      <TaskDetail
        engine={engine}
        taskId={search.task}
        tabId={search.detailsTab}
        onTabChange={(detailsTab) => update({ detailsTab })}
        onTaskCompleted={() => update({ task: undefined })}
      />
      {editedFilter !== undefined && (
        <FilterModal
          engine={engine}
          filter={editedFilter}
          onClose={() => setEditedFilter(undefined)}
          onSaved={(filter) => {
            setEditedFilter(undefined);
            update({ filter, task: undefined, page: undefined });
          }}
          onDeleted={() => {
            setEditedFilter(undefined);
            update({ filter: undefined, task: undefined, page: undefined });
          }}
        />
      )}
      <StartProcessModal
        engine={engine}
        open={startOpen || !!search.processStart}
        definitionKey={search.processStart}
        tenantId={search.processTenant}
        onSelect={(definition) =>
          update({ processStart: definition?.key, processTenant: definition?.tenantId ?? undefined })
        }
        onClose={() => {
          setStartOpen(false);
          update({ processStart: undefined, processTenant: undefined });
        }}
      />
    </div>
  );
}
