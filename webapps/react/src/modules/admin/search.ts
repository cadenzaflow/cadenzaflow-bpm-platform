import { sortingOf, validateListSearch, type ListSearch } from '../../shared/search/list-search';

/** State of an Admin list in the query string (see shared/search/list-search). */
export type AdminListSearch = ListSearch;
export { sortingOf, validateListSearch };

/** ?tab=profile on edit pages, as in the classic Admin */
export interface AdminEditSearch {
  tab?: string;
}

export function validateEditSearch(search: Record<string, unknown>): AdminEditSearch {
  return { tab: typeof search.tab === 'string' && search.tab ? search.tab : undefined };
}
