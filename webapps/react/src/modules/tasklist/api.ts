import { keepPreviousData, skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { engineUrl, request } from '../../shared/api/client';

export interface TaskFilter {
  id: string;
  name: string;
  owner: string | null;
  query?: Record<string, unknown>;
  properties: {
    priority?: number;
    color?: string;
    description?: string;
    /** refresh the task list every 10 seconds */
    refresh?: boolean;
    /** variables shown on the task cards */
    variables?: { name: string; label: string }[];
  };
  itemCount?: number;
}

export interface Task {
  id: string;
  name: string | null;
  assignee: string | null;
  owner: string | null;
  created: string;
  due: string | null;
  followUp: string | null;
  priority: number;
  description: string | null;
  processDefinitionId: string | null;
  processInstanceId: string | null;
  taskDefinitionKey: string;
  formKey: string | null;
  tenantId: string | null;
  suspended: boolean;
}

export interface ProcessDefinition {
  id: string;
  key: string;
  name: string | null;
  version: number;
}

export interface UserRef {
  id: string;
  firstName: string | null;
  lastName: string | null;
}

/** A variable the filter shows on the task cards (embedded by the HAL list). */
export interface TaskVariable {
  name: string;
  type: string;
  value: unknown;
}

/** One page of a filter's tasks plus the resources the API embeds for them. */
export interface TaskPage {
  tasks: (Task & { variables: TaskVariable[] })[];
  count: number;
  processDefinitions: Map<string, ProcessDefinition>;
  users: Map<string, UserRef>;
}

/** A task with its process definition and the users it refers to (assignee, owner). */
export interface TaskDetails {
  task: Task;
  processDefinition: ProcessDefinition | undefined;
  users: Map<string, UserRef>;
}

interface HalTask extends Task {
  _links?: unknown;
  _embedded?: {
    processDefinition?: ProcessDefinition[];
    user?: UserRef[];
  };
}

interface HalTaskList {
  count: number;
  _embedded: {
    task?: (Task & { _embedded?: { variable?: TaskVariable[] } | null })[];
    processDefinition?: ProcessDefinition[];
    assignee?: UserRef[];
  };
}

export const TASK_PAGE_SIZE = 15;

const byId = <T extends { id: string }>(items: T[] = []) => new Map(items.map((item) => [item.id, item]));

/** Filters ordered like the AngularJS Tasklist: by priority, then by name. */
export function sortFilters(filters: TaskFilter[]): TaskFilter[] {
  return [...filters].sort(
    (a, b) =>
      (a.properties?.priority ?? 0) - (b.properties?.priority ?? 0) || (a.name ?? '').localeCompare(b.name ?? ''),
  );
}

export function useTaskFilters(engine: string) {
  return useQuery({
    queryKey: ['task-filters', engine],
    queryFn: async () =>
      sortFilters(
        await request<TaskFilter[]>(engineUrl(engine, '/filter'), {
          query: { resourceType: 'Task', itemCount: true },
        }),
      ),
  });
}

/** Extends the filter's own query: search criteria and sorting. */
export interface TaskListQuery {
  sorting: { sortBy: string; sortOrder: string }[];
  [criterion: string]: unknown;
}

const DEFAULT_QUERY: TaskListQuery = { sorting: [{ sortBy: 'created', sortOrder: 'desc' }] };

/** One page of the filter's tasks, with process definitions, assignees and the filter's variables embedded (HAL). */
export async function fetchFilterTasks(
  engine: string,
  filterId: string,
  page: number,
  query: TaskListQuery = DEFAULT_QUERY,
): Promise<TaskPage> {
  const result = await request<HalTaskList>(engineUrl(engine, `/filter/${encodeURIComponent(filterId)}/list`), {
    method: 'POST',
    accept: 'application/hal+json',
    query: { firstResult: (page - 1) * TASK_PAGE_SIZE, maxResults: TASK_PAGE_SIZE },
    // like the AngularJS Tasklist: suspended tasks are not listed
    json: { ...query, active: true },
  });
  return {
    tasks: (result._embedded?.task ?? []).map(({ _embedded, ...task }) => ({
      ...(task as Task),
      variables: _embedded?.variable ?? [],
    })),
    count: result.count,
    processDefinitions: byId(result._embedded?.processDefinition),
    users: byId(result._embedded?.assignee),
  };
}

export function useFilterTasks(
  engine: string,
  filter: TaskFilter | undefined,
  page: number,
  query: TaskListQuery,
) {
  return useQuery({
    queryKey: ['filter-tasks', engine, filter?.id, page, query],
    placeholderData: keepPreviousData,
    // the AngularJS Tasklist refreshed such filters every 10 seconds
    refetchInterval: filter?.properties?.refresh ? 10_000 : false,
    queryFn: !filter ? skipToken : () => fetchFilterTasks(engine, filter.id, page, query),
  });
}

export async function fetchTask(engine: string, taskId: string): Promise<TaskDetails> {
  const { _links, _embedded, ...task } = await request<HalTask>(engineUrl(engine, `/task/${encodeURIComponent(taskId)}`), {
    accept: 'application/hal+json',
  });
  return {
    task,
    processDefinition: _embedded?.processDefinition?.[0],
    users: byId(_embedded?.user),
  };
}

export function useTask(engine: string, taskId: string | undefined) {
  return useQuery({
    queryKey: ['task', engine, taskId],
    queryFn: !taskId ? skipToken : () => fetchTask(engine, taskId),
  });
}

/** Claims the task for the given user, or unclaims it when userId is null. */
export function useAssignTask(engine: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string | null) =>
      userId
        ? request<void>(engineUrl(engine, `/task/${encodeURIComponent(taskId)}/claim`), {
            method: 'POST',
            json: { userId },
          })
        : request<void>(engineUrl(engine, `/task/${encodeURIComponent(taskId)}/unclaim`), { method: 'POST' }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['task', engine, taskId] }),
        queryClient.invalidateQueries({ queryKey: ['filter-tasks', engine] }),
        queryClient.invalidateQueries({ queryKey: ['task-filters', engine] }),
      ]),
  });
}
