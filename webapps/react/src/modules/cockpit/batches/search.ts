import { validateListSearch, type ListSearch } from '../../../shared/search/list-search';
import type { BatchKind } from './api';

/**
 * State of the Batches page in the query string: the search of the running
 * batches and the selected batch (details) with where it was found (type).
 */
export interface BatchesSearch extends Pick<ListSearch, 'searchQuery'> {
  details?: string;
  type?: BatchKind;
}

export function validateBatchesSearch(search: Record<string, unknown>): BatchesSearch {
  return {
    searchQuery: validateListSearch(search).searchQuery,
    details: typeof search.details === 'string' && search.details ? search.details : undefined,
    type: search.type === 'runtime' || search.type === 'history' ? search.type : undefined,
  };
}

/** Completed jobs of all jobs, in percent; nothing before the first job completed. */
export function progressOf(batch: { completedJobs?: number; remainingJobs?: number }): number | undefined {
  const completed = batch.completedJobs ?? 0;
  const total = completed + (batch.remainingJobs ?? 0);
  return completed > 0 && total > 0 ? Math.round((100 * completed) / total) : undefined;
}
