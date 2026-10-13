import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, engineUrl, request } from '../../../shared/api/client';

/** How often running batches are refreshed, as in the classic Cockpit. */
export const REFRESH_INTERVAL = 5000;

/** A batch with its job statistics (running) or from the history (ended). */
export interface Batch {
  id: string;
  type: string;
  totalJobs?: number;
  batchJobsPerSeed?: number;
  invocationsPerBatchJob?: number;
  seedJobDefinitionId?: string;
  monitorJobDefinitionId?: string;
  batchJobDefinitionId?: string;
  suspended?: boolean;
  tenantId?: string | null;
  createUserId?: string | null;
  startTime?: string | null;
  executionStartTime?: string | null;
  endTime?: string | null;
  /** running batches only */
  remainingJobs?: number;
  completedJobs?: number;
  failedJobs?: number;
}

export type BatchKind = 'runtime' | 'history';

/** A failed job of a batch. */
export interface BatchJob {
  id: string;
  exceptionMessage: string | null;
}

/** An entry of a job's log. */
export interface JobLog {
  id: string;
  timestamp: string;
  jobId: string;
  jobExceptionMessage: string | null;
  jobDefinitionType: string | null;
  jobDefinitionConfiguration: string | null;
  jobRetries: number;
  hostname: string | null;
  jobPriority: number;
  creationLog: boolean;
  failureLog: boolean;
  successLog: boolean;
  deletionLog: boolean;
}

const segment = encodeURIComponent;

/** Full names of the users who started batches; ids where a user may not be read. */
export function useUserNames(engine: string, ids: string[]) {
  const unique = [...new Set(ids)].sort();
  return useQuery({
    queryKey: ['cockpit', engine, 'user-names', unique],
    staleTime: 60_000,
    queryFn: !unique.length
      ? skipToken
      : async () => {
          type User = { id: string; firstName: string | null; lastName: string | null };
          const users = await request<User[]>(engineUrl(engine, '/user'), { query: { idIn: unique.join(','), maxResults: unique.length } }).catch(
            (): User[] => [],
          );
          return new Map(users.map((user) => [user.id, [user.firstName, user.lastName].filter(Boolean).join(' ') || user.id]));
        },
  });
}

/**
 * One batch: running (with statistics) or, once it ended (or when asked
 * for), from the history; `kind` says which it turned out to be.
 */
export function useBatch(engine: string, id: string | undefined, kind: BatchKind | undefined) {
  return useQuery({
    queryKey: ['cockpit', engine, 'batch', id, kind],
    refetchInterval: (query) => (query.state.data?.kind === 'runtime' ? REFRESH_INTERVAL : false),
    queryFn: !id
      ? skipToken
      : async (): Promise<{ batch: Batch; kind: BatchKind }> => {
          if (kind !== 'history') {
            const [running] = await request<Batch[]>(engineUrl(engine, '/batch/statistics'), { query: { batchId: id, maxResults: 1 } }).catch(
              (): Batch[] => [],
            );
            if (running) {
              return { batch: running, kind: 'runtime' };
            }
          }
          return { batch: await request<Batch>(engineUrl(engine, `/history/batch/${segment(id)}`)), kind: 'history' };
        },
  });
}

/** "First Last" of the user who started a batch; the id when the user has no name or is gone. */
export function useUserName(engine: string, userId: string | null | undefined) {
  return useQuery({
    queryKey: ['cockpit', engine, 'user-name', userId],
    staleTime: 60_000,
    queryFn: !userId
      ? skipToken
      : async () => {
          try {
            const profile = await request<{ firstName: string | null; lastName: string | null }>(engineUrl(engine, `/user/${segment(userId)}/profile`));
            return [profile.firstName, profile.lastName].filter(Boolean).join(' ') || userId;
          } catch (error) {
            if (error instanceof ApiError && error.status === 404) {
              return userId;
            }
            throw error;
          }
        },
  });
}

function useInvalidateBatches(engine: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['cockpit', engine] });
}

export function useBatchSuspension(engine: string) {
  const invalidate = useInvalidateBatches(engine);
  return useMutation({
    mutationFn: ({ id, suspended }: { id: string; suspended: boolean }) =>
      request<void>(engineUrl(engine, `/batch/${segment(id)}/suspended`), { method: 'PUT', json: { suspended } }),
    onSettled: invalidate,
  });
}

/**
 * Deletes a running batch (optionally with its history: cascade) or an ended
 * one from the history. The lists reload afterwards without holding the
 * result back: the deleted batch is gone, its selection has to go first.
 */
export function useDeleteBatch(engine: string) {
  const invalidate = useInvalidateBatches(engine);
  return useMutation({
    mutationFn: ({ id, kind, cascade }: { id: string; kind: BatchKind; cascade: boolean }) =>
      kind === 'runtime'
        ? request<void>(engineUrl(engine, `/batch/${segment(id)}`), { method: 'DELETE', query: { cascade: cascade || undefined } })
        : request<void>(engineUrl(engine, `/history/batch/${segment(id)}`), { method: 'DELETE' }),
    onSettled: () => void invalidate(),
  });
}

/** One more retry for every failed job of the batch (its batch job definition), or for one job. */
export function useBatchRetry(engine: string) {
  const invalidate = useInvalidateBatches(engine);
  return useMutation({
    mutationFn: (target: { jobDefinitionId: string } | { jobId: string }) =>
      'jobDefinitionId' in target
        ? request<void>(engineUrl(engine, `/job-definition/${segment(target.jobDefinitionId)}/retries`), { method: 'PUT', json: { retries: 1 } })
        : request<void>(engineUrl(engine, `/job/${segment(target.jobId)}/retries`), { method: 'PUT', json: { retries: 1 } }),
    onSettled: invalidate,
  });
}

export function useDeleteJob(engine: string) {
  const invalidate = useInvalidateBatches(engine);
  return useMutation({
    mutationFn: (jobId: string) => request<void>(engineUrl(engine, `/job/${segment(jobId)}`), { method: 'DELETE' }),
    onSettled: invalidate,
  });
}
