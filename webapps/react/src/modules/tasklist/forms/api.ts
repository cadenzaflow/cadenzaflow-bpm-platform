import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { engineUrl, request } from '../../../shared/api/client';
import type { Variables } from '../../../shared/variables';
import type { FormInfo } from './form-key';
import { targetUrls, type FormTarget } from './target';

const targetKey = (target: FormTarget) =>
  target.kind === 'task' ? ['task', target.taskId] : ['start', target.processDefinitionId];

export function useFormInfo(engine: string, target: FormTarget) {
  return useQuery({
    queryKey: ['form-info', engine, ...targetKey(target)],
    queryFn: () => request<FormInfo>(targetUrls(engine, target).formInfo),
  });
}

/** Variables visible to the form, values not deserialized (objects stay serialized). */
export function fetchFormVariables(engine: string, target: FormTarget, names?: string[]): Promise<Variables> {
  return request<Variables>(targetUrls(engine, target).formVariables, {
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
 * Submits the form: completes the task, or starts the process (with an
 * optional business key). Then the task lists are refreshed. The callbacks
 * are part of the mutation (not of mutate()) so they also run when the form
 * is gone by the time the server answers.
 */
export function useSubmitForm(
  engine: string,
  target: FormTarget,
  callbacks: { onSuccess: (result: unknown) => void; onError: (error: Error) => void },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ variables, businessKey }: { variables: Variables; businessKey?: string }) =>
      request<unknown>(targetUrls(engine, target).submit, {
        method: 'POST',
        json: target.kind === 'start' && businessKey ? { variables, businessKey } : { variables },
      }),
    onSuccess: (result) => {
      callbacks.onSuccess(result);
      if (target.kind === 'task') {
        queryClient.removeQueries({ queryKey: ['task', engine, target.taskId] });
        queryClient.removeQueries({ queryKey: ['form-info', engine, 'task', target.taskId] });
      }
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: ['filter-tasks', engine] }),
        queryClient.invalidateQueries({ queryKey: ['task-filters', engine] }),
      ]);
    },
    onError: callbacks.onError,
  });
}
