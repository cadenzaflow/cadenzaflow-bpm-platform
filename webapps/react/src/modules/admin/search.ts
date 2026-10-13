import { parseCriteria, type Criterion } from '../../shared/search/criteria';
import type { Sorting } from './api';

/** State of an Admin list in the query string: ?searchQuery=[...]&page=2&sortBy=id&sortOrder=desc */
export interface AdminListSearch {
  searchQuery?: Criterion[];
  /** 1-based */
  page?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/** ?tab=profile on edit pages, as in the classic Admin */
export interface AdminEditSearch {
  tab?: string;
}

// the router parses JSON in the query string; accept both forms
const asJson = (value: unknown) => (typeof value === 'string' ? value : value ? JSON.stringify(value) : undefined);

export function validateListSearch(search: Record<string, unknown>): AdminListSearch {
  const page = Number(search.page);
  const criteria = parseCriteria(asJson(search.searchQuery));
  return {
    searchQuery: criteria.length ? criteria : undefined,
    page: Number.isInteger(page) && page > 1 ? page : undefined,
    sortBy: typeof search.sortBy === 'string' && search.sortBy ? search.sortBy : undefined,
    sortOrder: search.sortOrder === 'asc' || search.sortOrder === 'desc' ? search.sortOrder : undefined,
  };
}

export function validateEditSearch(search: Record<string, unknown>): AdminEditSearch {
  return { tab: typeof search.tab === 'string' && search.tab ? search.tab : undefined };
}

/** The sorting of the URL, or the list's default. */
export function sortingOf(search: AdminListSearch, defaultSortBy: string): Sorting {
  return { sortBy: search.sortBy ?? defaultSortBy, sortOrder: search.sortOrder ?? 'asc' };
}
