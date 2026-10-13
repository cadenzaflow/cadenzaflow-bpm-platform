import { parseCriteria, type Criterion } from '../../shared/search/criteria';
import { parseSorting, type Sorting } from './task-search';

/**
 * The Tasklist is a single page; its state lives in the query string so a
 * selected filter, task and tab can be bookmarked and shared:
 * ?filter=<filterId>&task=<taskId>&detailsTab=<tab id>
 * ?processStart=<key>&processTenant=<id> opens the start form of a process
 * (same parameters as the AngularJS Tasklist); page, sorting and search of
 * the task list are kept there as well.
 */
export interface TasklistSearch {
  filter?: string;
  task?: string;
  detailsTab?: string;
  processStart?: string;
  processTenant?: string;
  /** task list page, 1-based */
  page?: number;
  /** [{"sortBy":"created","sortOrder":"desc"}], the AngularJS format */
  sorting?: Sorting[];
  searchQuery?: Criterion[];
  /** 'any': a task matches when any criterion does */
  searchMatch?: 'any';
}

const optionalString = (value: unknown) => (typeof value === 'string' && value ? value : undefined);
// the router parses JSON in the query string; accept both forms
const asJson = (value: unknown) => (typeof value === 'string' ? value : value ? JSON.stringify(value) : undefined);

export function validateTasklistSearch(search: Record<string, unknown>): TasklistSearch {
  const page = Number(search.page);
  const criteria = parseCriteria(asJson(search.searchQuery));
  return {
    filter: optionalString(search.filter),
    task: optionalString(search.task),
    detailsTab: optionalString(search.detailsTab),
    processStart: optionalString(search.processStart),
    processTenant: optionalString(search.processTenant),
    page: Number.isInteger(page) && page > 1 ? page : undefined,
    sorting: search.sorting === undefined ? undefined : [parseSorting(asJson(search.sorting))],
    searchQuery: criteria.length ? criteria : undefined,
    searchMatch: search.searchMatch === 'any' ? 'any' : undefined,
  };
}
