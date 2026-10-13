import { useQuery } from '@tanstack/react-query';
import type { Sorting } from '../ui/ListTable';
import { request, type QueryParams } from './client';

/** Page size of the lists, as in the classic webapps. */
export const DEFAULT_PAGE_SIZE = 50;

export interface Page<T> {
  items: T[];
  count: number;
  /** false when the backend (e.g. an LDAP identity provider) could not sort; the page is unsorted then */
  sortable: boolean;
}

export interface PageRequest {
  /** the list resource, e.g. engineUrl(engine, '/user') */
  listUrl: string;
  /** its count, e.g. engineUrl(engine, '/user/count') */
  countUrl: string;
  query: QueryParams;
  /** 1-based */
  page: number;
  sorting?: Sorting;
  pageSize?: number;
}

/** One page of a list resource with the total count; retried unsorted when sorting fails. */
export async function fetchPage<T>({ listUrl, countUrl, query, page, sorting, pageSize = DEFAULT_PAGE_SIZE }: PageRequest): Promise<Page<T>> {
  const paging = { firstResult: (page - 1) * pageSize, maxResults: pageSize };
  const { count } = await request<{ count: number }>(countUrl, { query });
  try {
    const items = await request<T[]>(listUrl, { query: { ...query, ...paging, ...sorting } });
    return { items, count, sortable: true };
  } catch (error) {
    if (!sorting) {
      throw error;
    }
    const items = await request<T[]>(listUrl, { query: { ...query, ...paging } });
    return { items, count, sortable: false };
  }
}

/**
 * A page of a list; `scope` starts the cache key (e.g. ['admin-list', engine])
 * so a module can reload all of its lists at once.
 */
export function usePagedList<T>(scope: readonly unknown[], pageRequest: PageRequest) {
  const { listUrl, query, page, sorting, pageSize = DEFAULT_PAGE_SIZE } = pageRequest;
  return useQuery({
    queryKey: [...scope, listUrl, query, page, sorting, pageSize],
    placeholderData: (previous) => previous,
    queryFn: () => fetchPage<T>(pageRequest),
  });
}
