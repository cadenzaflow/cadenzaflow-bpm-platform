import type { Sorting } from '../ui/ListTable';
import { parseCriteria, type Criterion } from './criteria';

/** State of a list in the query string: ?searchQuery=[...]&page=2&sortBy=id&sortOrder=desc */
export interface ListSearch {
  searchQuery?: Criterion[];
  /** 1-based */
  page?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// the router parses JSON in the query string; accept both forms
const asJson = (value: unknown) => (typeof value === 'string' ? value : value ? JSON.stringify(value) : undefined);

export function validateListSearch(search: Record<string, unknown>): ListSearch {
  const page = Number(search.page);
  const criteria = parseCriteria(asJson(search.searchQuery));
  return {
    searchQuery: criteria.length ? criteria : undefined,
    page: Number.isInteger(page) && page > 1 ? page : undefined,
    sortBy: typeof search.sortBy === 'string' && search.sortBy ? search.sortBy : undefined,
    sortOrder: search.sortOrder === 'asc' || search.sortOrder === 'desc' ? search.sortOrder : undefined,
  };
}

/** The sorting of the URL, or the list's default. */
export function sortingOf(search: ListSearch, defaultSortBy: string, defaultSortOrder: 'asc' | 'desc' = 'asc'): Sorting {
  return { sortBy: search.sortBy ?? defaultSortBy, sortOrder: search.sortOrder ?? defaultSortOrder };
}
