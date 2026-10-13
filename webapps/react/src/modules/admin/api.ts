import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { engineUrl, request, type QueryParams } from '../../shared/api/client';
import { DEFAULT_PAGE_SIZE, usePagedList } from '../../shared/api/paging';
import type { Sorting } from '../../shared/ui/ListTable';

/** Page size of the Admin lists, as in the classic Admin. */
export const ADMIN_PAGE_SIZE = DEFAULT_PAGE_SIZE;

export type { Sorting } from '../../shared/ui/ListTable';

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

export type { Page } from '../../shared/api/paging';

/** One page of a list resource such as /user of the engine REST API (count at /user/count). */
export function usePage<T>(
  engine: string,
  path: string,
  query: QueryParams,
  page: number,
  sorting?: Sorting,
  pageSize = ADMIN_PAGE_SIZE,
) {
  return usePagedList<T>(['admin-list', engine], {
    listUrl: engineUrl(engine, path),
    countUrl: engineUrl(engine, `${path}/count`),
    query,
    page,
    sorting,
    pageSize,
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

/** Whether the current user has a permission, e.g. ALL on resource type 4 (authorization). */
export function useAuthorizationCheck(engine: string, permissionName: string, resourceName: string, resourceType: number) {
  return useQuery({
    queryKey: ['resource-access', engine, 'check', permissionName, resourceName, resourceType],
    staleTime: 60_000,
    queryFn: async () =>
      (
        await request<{ authorized: boolean }>(engineUrl(engine, '/authorization/check'), {
          query: { permissionName, resourceName, resourceType },
        })
      ).authorized,
  });
}

/** Which Admin sections the current user may use; navigation and dashboard show the same. */
export function useAdminAccess(engine: string) {
  const users = useResourceAccess(engine, '/user');
  const groups = useResourceAccess(engine, '/group');
  const tenants = useResourceAccess(engine, '/tenant');
  const authorizations = useAuthorizationCheck(engine, 'ALL', 'authorization', 4);
  return {
    users: users.data,
    groups: groups.data,
    tenants: tenants.data,
    authorizations: !!authorizations.data,
  };
}
