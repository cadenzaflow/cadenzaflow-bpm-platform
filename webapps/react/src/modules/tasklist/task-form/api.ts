import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { engineUrl, request } from '../../../shared/api/client';
import type { Variables } from '../../../shared/variables';
import type { FormInfo } from './form-key';

const taskPath = (taskId: string) => `/task/${encodeURIComponent(taskId)}`;

export function useFormInfo(engine: string, taskId: string) {
  return useQuery({
    queryKey: ['task-form', engine, taskId],
    queryFn: () => request<FormInfo>(engineUrl(engine, `${taskPath(taskId)}/form`)),
  });
}

/** Variables visible to the task's form, values not deserialized (objects stay serialized). */
export function fetchFormVariables(engine: string, taskId: string, names?: string[]): Promise<Variables> {
  return request<Variables>(engineUrl(engine, `${taskPath(taskId)}/form-variables`), {
    query: { deserializeValues: false, variableNames: names?.join(',') },
  });
}

export function useBusinessKey(engine: string, processInstanceId: string | null) {
  return useQuery({
    queryKey: ['business-key', engine, processInstanceId],
    enabled: !!processInstanceId,
    staleTime: Infinity,
    queryFn: async () =>
      (
        await request<{ businessKey: string | null }>(
          engineUrl(engine, `/process-instance/${encodeURIComponent(processInstanceId!)}`),
        )
      ).businessKey,
  });
}

/**
 * Completes the task with the form's variables, then refreshes the lists.
 * The callbacks are part of the mutation (not of mutate()) so they also run
 * when the form is gone by the time the server answers.
 */
export function useCompleteTask(
  engine: string,
  taskId: string,
  callbacks: { onSuccess: () => void; onError: (error: Error) => void },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: Variables) =>
      request<void>(engineUrl(engine, `${taskPath(taskId)}/submit-form`), {
        method: 'POST',
        json: { variables },
      }),
    onSuccess: () => {
      callbacks.onSuccess();
      queryClient.removeQueries({ queryKey: ['task', engine, taskId] });
      queryClient.removeQueries({ queryKey: ['task-form', engine, taskId] });
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ['filter-tasks', engine] }),
        queryClient.invalidateQueries({ queryKey: ['task-filters', engine] }),
      ]);
    },
    onError: callbacks.onError,
  });
}
