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
  query: QueryParams | Record<string, unknown>;
  /** 1-based */
  page: number;
  sorting?: Sorting;
  pageSize?: number;
  /** POST: query and sorting in the body (lists, e.g. variables), paging in the URL */
  method?: 'GET' | 'POST';
  /** more URL parameters of the list request, e.g. deserializeValues */
  listQuery?: QueryParams;
}

/** One page of a list resource with the total count; retried unsorted when sorting fails. */
export async function fetchPage<T>({
  listUrl,
  countUrl,
  query,
  page,
  sorting,
  pageSize = DEFAULT_PAGE_SIZE,
  method = 'GET',
  listQuery,
}: PageRequest): Promise<Page<T>> {
  const paging = { ...listQuery, firstResult: (page - 1) * pageSize, maxResults: pageSize };
  const list = (withSorting: Sorting | undefined) =>
    method === 'POST'
      ? request<T[]>(listUrl, { method, query: paging, json: { ...query, ...withSorting } })
      : request<T[]>(listUrl, { query: { ...(query as QueryParams), ...paging, ...withSorting } });
  const { count } = await (method === 'POST'
    ? request<{ count: number }>(countUrl, { method, json: query })
    : request<{ count: number }>(countUrl, { query: query as QueryParams }));
  try {
    return { items: await list(sorting), count, sortable: true };
  } catch (error) {
    if (!sorting) {
      throw error;
    }
    return { items: await list(undefined), count, sortable: false };
  }
}

/**
 * A page of a list; `scope` starts the cache key (e.g. ['admin-list', engine])
 * so a module can reload all of its lists at once.
 */
export function usePagedList<T>(scope: readonly unknown[], pageRequest: PageRequest) {
  const { listUrl, query, page, sorting, pageSize = DEFAULT_PAGE_SIZE, method, listQuery } = pageRequest;
  return useQuery({
    queryKey: [...scope, listUrl, method, query, listQuery, page, sorting, pageSize],
    placeholderData: (previous) => previous,
    queryFn: () => fetchPage<T>(pageRequest),
  });
}
