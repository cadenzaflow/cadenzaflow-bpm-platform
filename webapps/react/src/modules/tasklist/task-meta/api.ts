import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { engineUrl, request } from '../../../shared/api/client';
import type { Task } from '../api';

const taskPath = (taskId: string) => `/task/${encodeURIComponent(taskId)}`;

export interface IdentityLink {
  type: string;
  userId: string | null;
  groupId: string | null;
}

/** After a change: the task, the lists (assignee, due date are shown there) and the history. */
function useRefresh(engine: string, taskId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['task', engine, taskId] }),
      queryClient.invalidateQueries({ queryKey: ['filter-tasks', engine] }),
      queryClient.invalidateQueries({ queryKey: ['task-filters', engine] }),
      queryClient.invalidateQueries({ queryKey: ['task-history', engine, taskId] }),
      queryClient.invalidateQueries({ queryKey: ['task-groups', engine, taskId] }),
    ]);
}

/** PUT /task/{id} replaces the task, so the current values go along with the change. */
export function useUpdateTask(engine: string, task: Task) {
  const refresh = useRefresh(engine, task.id);
  return useMutation({
    mutationFn: (changes: Partial<Pick<Task, 'due' | 'followUp'>>) =>
      request<void>(engineUrl(engine, taskPath(task.id)), { method: 'PUT', json: { ...task, ...changes } }),
    onSuccess: refresh,
  });
}

/** Sets the assignee to another user, or removes it (null). */
export function useSetAssignee(engine: string, taskId: string) {
  const refresh = useRefresh(engine, taskId);
  return useMutation({
    mutationFn: (userId: string | null) =>
      request<void>(engineUrl(engine, `${taskPath(taskId)}/assignee`), { method: 'POST', json: { userId } }),
    onSuccess: refresh,
  });
}

export async function userExists(engine: string, userId: string): Promise<boolean> {
  const users = await request<unknown[]>(engineUrl(engine, '/user'), { query: { id: userId, maxResults: 1 } });
  return users.length > 0;
}

/** Candidate groups of the task, with names where the user may read them. */
export function useTaskGroups(engine: string, taskId: string) {
  return useQuery({
    queryKey: ['task-groups', engine, taskId],
    queryFn: async () => {
      const links = await request<IdentityLink[]>(engineUrl(engine, `${taskPath(taskId)}/identity-links`), {
        query: { type: 'candidate' },
      });
      const ids = links.map((link) => link.groupId).filter((id): id is string => !!id);
      const names = new Map<string, string>();
      if (ids.length) {
        type Group = { id: string; name: string | null };
        // without READ permission on groups the ids are shown
        const groups = await request<Group[]>(engineUrl(engine, '/group'), { query: { idIn: ids.join(',') } }).catch(
          (): Group[] => [],
        );
        groups.forEach((group) => group.name && names.set(group.id, group.name));
      }
      return ids.map((id) => ({ id, name: names.get(id) ?? id }));
    },
  });
}

export function useChangeGroup(engine: string, taskId: string) {
  const refresh = useRefresh(engine, taskId);
  return useMutation({
    mutationFn: ({ groupId, remove }: { groupId: string; remove?: boolean }) =>
      request<void>(engineUrl(engine, `${taskPath(taskId)}/identity-links${remove ? '/delete' : ''}`), {
        method: 'POST',
        json: { groupId, type: 'candidate' },
      }),
    onSuccess: refresh,
  });
}

export function useAddComment(engine: string, taskId: string) {
  const refresh = useRefresh(engine, taskId);
  return useMutation({
    mutationFn: (message: string) =>
      request<void>(engineUrl(engine, `${taskPath(taskId)}/comment/create`), { method: 'POST', json: { message } }),
    onSuccess: refresh,
  });
}
