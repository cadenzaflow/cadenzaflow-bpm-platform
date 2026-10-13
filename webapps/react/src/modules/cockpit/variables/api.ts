import { useMutation } from '@tanstack/react-query';
import { engineUrl, request } from '../../../shared/api/client';
import type { VariableValue } from '../../../shared/variables';
import { useInvalidateCockpit } from '../incidents/api';

/** A variable instance as the engine REST API lists it (values not deserialized). */
export interface VariableInstance {
  id: string;
  name: string;
  type: string;
  value: unknown;
  valueInfo?: Record<string, unknown>;
  processInstanceId: string;
  executionId: string;
  activityInstanceId: string;
  /** set for task-local variables */
  taskId: string | null;
}

const segment = encodeURIComponent;

/** The variable in its own scope: task-local variables on the task, all others on their execution. */
const localUrl = (engine: string, variable: VariableInstance, path = '') =>
  variable.taskId
    ? engineUrl(engine, `/task/${segment(variable.taskId)}/localVariables/${segment(variable.name)}${path}`)
    : engineUrl(engine, `/execution/${segment(variable.executionId)}/localVariables/${segment(variable.name)}${path}`);

/** Where the content of a binary variable is downloaded. */
export const dataUrl = (engine: string, variable: VariableInstance) => engineUrl(engine, `/variable-instance/${segment(variable.id)}/data`);

export function useSaveVariable(engine: string) {
  const invalidate = useInvalidateCockpit(engine);
  return useMutation({
    mutationFn: ({ variable, value }: { variable: VariableInstance; value: VariableValue }) =>
      request<void>(localUrl(engine, variable), { method: 'PUT', json: value }),
    onSettled: invalidate,
  });
}

export function useDeleteVariable(engine: string) {
  const invalidate = useInvalidateCockpit(engine);
  return useMutation({
    mutationFn: (variable: VariableInstance) => request<void>(localUrl(engine, variable), { method: 'DELETE' }),
    onSettled: invalidate,
  });
}

/** Replaces the content of a binary variable, keeping its type (Bytes or File). */
export function useUploadVariable(engine: string) {
  const invalidate = useInvalidateCockpit(engine);
  return useMutation({
    mutationFn: ({ variable, file }: { variable: VariableInstance; file: File }) => {
      const data = new FormData();
      data.append('data', file);
      data.append('valueType', variable.type);
      return request<void>(localUrl(engine, variable, '/data'), { method: 'POST', multipart: data });
    },
    onSettled: invalidate,
  });
}

/** Sets a variable on the process instance (adds it, or replaces one of the same name). */
export function useAddVariable(engine: string, processInstanceId: string) {
  const invalidate = useInvalidateCockpit(engine);
  return useMutation({
    mutationFn: ({ name, value }: { name: string; value: VariableValue }) =>
      request<void>(engineUrl(engine, `/process-instance/${segment(processInstanceId)}/variables/${segment(name)}`), {
        method: 'PUT',
        json: value,
      }),
    onSettled: invalidate,
  });
}
