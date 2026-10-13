import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { engineUrl, request } from '../../../shared/api/client';
import type { TaskFilter } from '../api';

/** Resource type "Filter" of the engine's authorization API. */
const FILTER_RESOURCE = 5;
const GLOBAL = 0;
const GRANT = 1;

export interface Authorization {
  id: string;
  type: number;
  permissions: string[];
  userId: string | null;
  groupId: string | null;
  resourceType: number;
  resourceId: string;
}

/** Who may read the filter: everybody, and/or listed users and groups. */
export interface ReadPermissions {
  everybody: boolean;
  identities: { kind: 'user' | 'group'; id: string }[];
}

export interface FilterToSave {
  id?: string;
  resourceType: 'Task';
  name: string;
  query: Record<string, unknown>;
  properties: TaskFilter['properties'] & { showUndefinedVariable?: boolean };
}

export function toReadPermissions(authorizations: Authorization[]): ReadPermissions {
  const reads = authorizations.filter((a) => a.permissions.includes('READ') || a.permissions.includes('ALL'));
  return {
    everybody: reads.some((a) => a.type === GLOBAL && a.userId === '*'),
    identities: reads
      .filter((a) => a.type === GRANT)
      .map((a) => (a.userId ? { kind: 'user' as const, id: a.userId } : { kind: 'group' as const, id: a.groupId! })),
  };
}

export function useFilterAuthorizations(engine: string, filterId: string | undefined) {
  return useQuery({
    queryKey: ['filter-authorizations', engine, filterId],
    enabled: !!filterId,
    retry: false,
    queryFn: () =>
      request<Authorization[]>(engineUrl(engine, '/authorization'), {
        query: { resourceType: FILTER_RESOURCE, resourceId: filterId },
      }),
  });
}

const same = (a: Authorization, identity: { kind: 'user' | 'group'; id: string }) =>
  a.type === GRANT && (identity.kind === 'user' ? a.userId === identity.id : a.groupId === identity.id);

/**
 * Applies the wanted read permissions: creates missing grants, and takes READ
 * away from removed ones (deleting the authorization when nothing else is left).
 */
export async function applyReadPermissions(
  engine: string,
  filterId: string,
  current: Authorization[],
  wanted: ReadPermissions,
): Promise<void> {
  const create = (body: Record<string, unknown>) =>
    request(engineUrl(engine, '/authorization/create'), {
      method: 'POST',
      json: { resourceType: FILTER_RESOURCE, resourceId: filterId, permissions: ['READ'], ...body },
    });
  const withoutRead = async (authorization: Authorization) => {
    const permissions = authorization.permissions.filter((p) => p !== 'READ' && p !== 'ALL');
    const url = engineUrl(engine, `/authorization/${encodeURIComponent(authorization.id)}`);
    if (permissions.length === 0) {
      await request(url, { method: 'DELETE' });
    } else {
      await request(url, { method: 'PUT', json: { ...authorization, permissions } });
    }
  };

  const global = current.find((a) => a.type === GLOBAL && a.userId === '*');
  if (wanted.everybody && !global) {
    await create({ type: GLOBAL, userId: '*' });
  } else if (!wanted.everybody && global) {
    await withoutRead(global);
  }
  for (const identity of wanted.identities) {
    const existing = current.find((a) => same(a, identity));
    if (!existing) {
      await create({ type: GRANT, [identity.kind === 'user' ? 'userId' : 'groupId']: identity.id });
    } else if (!existing.permissions.includes('READ') && !existing.permissions.includes('ALL')) {
      await request(engineUrl(engine, `/authorization/${encodeURIComponent(existing.id)}`), {
        method: 'PUT',
        json: { ...existing, permissions: [...existing.permissions, 'READ'] },
      });
    }
  }
  for (const authorization of current) {
    const read = authorization.permissions.includes('READ') || authorization.permissions.includes('ALL');
    if (read && authorization.type === GRANT && !wanted.identities.some((identity) => same(authorization, identity))) {
      await withoutRead(authorization);
    }
  }
}

/** Creates or updates the filter, then its read permissions (when the user may change them). */
export function useSaveFilter(engine: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      filter,
      permissions,
    }: {
      filter: FilterToSave;
      permissions?: { current: Authorization[]; wanted: ReadPermissions };
    }) => {
      let id = filter.id;
      if (id) {
        await request(engineUrl(engine, `/filter/${encodeURIComponent(id)}`), { method: 'PUT', json: filter });
      } else {
        id = (await request<{ id: string }>(engineUrl(engine, '/filter/create'), { method: 'POST', json: filter })).id;
      }
      if (permissions) {
        await applyReadPermissions(engine, id, permissions.current, permissions.wanted);
      }
      return id;
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['task-filters', engine] }),
        queryClient.invalidateQueries({ queryKey: ['filter-tasks', engine] }),
        queryClient.invalidateQueries({ queryKey: ['filter-authorizations', engine] }),
      ]),
  });
}

export function useDeleteFilter(engine: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (filterId: string) =>
      request<void>(engineUrl(engine, `/filter/${encodeURIComponent(filterId)}`), { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['task-filters', engine] }),
  });
}
