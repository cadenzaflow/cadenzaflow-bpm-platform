import { useMutation, useQueryClient } from '@tanstack/react-query';
import { engineUrl, request } from '../../../shared/api/client';

export interface NewTask {
  name: string;
  assignee: string | null;
  tenantId: string | null;
  description: string | null;
}

/** Creates a task that belongs to no process (a standalone task), with the default priority. */
export function useCreateTask(engine: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (task: NewTask) =>
      request<void>(engineUrl(engine, '/task/create'), { method: 'POST', json: { ...task, priority: 50 } }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['task-filters', engine] }),
        queryClient.invalidateQueries({ queryKey: ['filter-tasks', engine] }),
      ]),
  });
}
