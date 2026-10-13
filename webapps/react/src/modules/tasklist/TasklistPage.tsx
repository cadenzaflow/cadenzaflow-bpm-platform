import { useEffect } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { FilterList } from './FilterList';
import { TaskList } from './TaskList';
import { TaskDetail } from './TaskDetail';
import { useTaskFilters } from './api';
import type { TasklistSearch } from './search';
import './tasklist.scss';

const route = getRouteApi('/tasklist/$engine');

/** Filters | tasks of the selected filter | selected task. */
export function TasklistPage() {
  const { engine } = route.useParams();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const filters = useTaskFilters(engine);

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
        onSelect={(filter) => update({ filter, task: undefined })}
      />
      <TaskList
        engine={engine}
        filterId={search.filter}
        selectedId={search.task}
        onSelect={(task) => update({ task })}
      />
      <TaskDetail
        engine={engine}
        taskId={search.task}
        tabId={search.detailsTab}
        onTabChange={(detailsTab) => update({ detailsTab })}
        onTaskCompleted={() => update({ task: undefined })}
      />
    </div>
  );
}
