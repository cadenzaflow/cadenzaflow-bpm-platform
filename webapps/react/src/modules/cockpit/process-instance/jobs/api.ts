import { useMutation, useQuery } from '@tanstack/react-query';
import { engineUrl, request } from '../../../../shared/api/client';
import { useInvalidateCockpit } from '../../incidents/api';

/** A job of the instance as the engine REST API lists it. */
export interface Job {
  id: string;
  jobDefinitionId: string | null;
  dueDate: string | null;
  createTime: string;
  retries: number;
  suspended: boolean;
  failedActivityId: string | null;
}

const jobUrl = (engine: string, id: string, path = '') => engineUrl(engine, `/job/${encodeURIComponent(id)}${path}`);

/** The activity of a job, from its job definition (the job itself does not say). */
export function useJobActivity(engine: string, jobDefinitionId: string | null) {
  return useQuery({
    queryKey: ['cockpit', engine, 'job-definition', jobDefinitionId],
    enabled: !!jobDefinitionId,
    staleTime: Infinity,
    queryFn: async () =>
      (await request<{ activityId: string }>(engineUrl(engine, `/job-definition/${encodeURIComponent(jobDefinitionId!)}`))).activityId,
  });
}

export function useJobSuspension(engine: string) {
  const invalidate = useInvalidateCockpit(engine);
  return useMutation({
    mutationFn: ({ id, suspended }: { id: string; suspended: boolean }) =>
      request<void>(jobUrl(engine, id, '/suspended'), { method: 'PUT', json: { suspended } }),
    onSettled: invalidate,
  });
}

/**
 * A new due date for a timer: recalculated from the job's creation time or
 * from now (expressions are evaluated again), or a given date, optionally
 * moving the following jobs too (cascade).
 */
export type DueDateChange = { kind: 'creation' | 'now' } | { kind: 'specific'; dueDate: string; cascade: boolean };

export function useChangeDueDate(engine: string) {
  const invalidate = useInvalidateCockpit(engine);
  return useMutation({
    mutationFn: ({ id, change }: { id: string; change: DueDateChange }) =>
      change.kind === 'specific'
        ? request<void>(jobUrl(engine, id, '/duedate'), { method: 'PUT', json: { duedate: change.dueDate, cascade: change.cascade } })
        : request<void>(jobUrl(engine, id, '/duedate/recalculate'), {
            method: 'POST',
            query: { creationDateBased: change.kind === 'creation' },
          }),
    onSettled: invalidate,
  });
}
