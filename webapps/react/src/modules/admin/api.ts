import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { engineUrl, request, type QueryParams } from '../../shared/api/client';

/** Page size of the Admin lists, as in the classic Admin. */
export const ADMIN_PAGE_SIZE = 50;

export interface Sorting {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface User {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

export interface Group {
  id: string;
  name: string | null;
  type: string | null;
}

export interface Tenant {
  id: string;
  name: string | null;
}

/**
 * What the current user may do with a resource: the `rel` names of the links
 * the engine REST API returns for OPTIONS, e.g. create, list, update, delete.
 */
export function useResourceAccess(engine: string, path: string) {
  return useQuery({
    queryKey: ['resource-access', engine, path],
    staleTime: 60_000,
    queryFn: async () => {
      const options = await request<{ links?: { rel: string }[] } | undefined>(engineUrl(engine, path), {
        method: 'OPTIONS',
      });
      return new Set((options?.links ?? []).map((link) => link.rel));
    },
  });
}

export interface Page<T> {
  items: T[];
  count: number;
  /** false when the identity provider (e.g. LDAP) could not sort; the page is unsorted then */
  sortable: boolean;
}

/** One page of a list resource such as /user, with the total count. */
export async function fetchPage<T>(
  engine: string,
  path: string,
  query: QueryParams,
  page: number,
  sorting: Sorting | undefined,
): Promise<Page<T>> {
  const paging = { firstResult: (page - 1) * ADMIN_PAGE_SIZE, maxResults: ADMIN_PAGE_SIZE };
  const { count } = await request<{ count: number }>(engineUrl(engine, `${path}/count`), { query });
  try {
    const items = await request<T[]>(engineUrl(engine, path), { query: { ...query, ...paging, ...sorting } });
    return { items, count, sortable: true };
  } catch (error) {
    if (!sorting) {
      throw error;
    }
    const items = await request<T[]>(engineUrl(engine, path), { query: { ...query, ...paging } });
    return { items, count, sortable: false };
  }
}

export function usePage<T>(engine: string, path: string, query: QueryParams, page: number, sorting?: Sorting) {
  return useQuery({
    queryKey: ['admin-list', engine, path, query, page, sorting],
    placeholderData: (previous) => previous,
    queryFn: () => fetchPage<T>(engine, path, query, page, sorting),
  });
}

/** All ids of a list query, e.g. the groups a user is member of (to leave them out when adding). */
export function useIds(engine: string, path: string, query: QueryParams) {
  return useQuery({
    queryKey: ['admin-ids', engine, path, query],
    queryFn: async () => new Set((await request<{ id: string }[]>(engineUrl(engine, path), { query })).map((item) => item.id)),
  });
}

/** After a change in the Admin: lists, memberships and profiles are reloaded. */
export function useInvalidateAdmin(engine: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      ['admin-list', 'admin-ids', 'admin-item', 'user-profile'].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key, engine] }),
      ),
    );
}

/**
 * Adds (PUT) or removes (DELETE) memberships, e.g. url = id =>
 * /group/{id}/members/{userId}; several are added one after the other.
 */
export function useMemberships(engine: string, url: (id: string) => string) {
  const invalidate = useInvalidateAdmin(engine);
  const add = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await request<void>(url(id), { method: 'PUT' });
      }
    },
    onSettled: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => request<void>(url(id), { method: 'DELETE' }),
    onSettled: invalidate,
  });
  return { add, remove };
}
