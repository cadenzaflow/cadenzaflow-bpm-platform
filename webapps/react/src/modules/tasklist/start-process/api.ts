import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { engineUrl, request, type QueryParams } from '../../../shared/api/client';

export interface StartableDefinition {
  id: string;
  key: string;
  name: string | null;
  version: number;
  tenantId: string | null;
}

export const START_PAGE_SIZE = 15;

/** Latest active definitions the user may start and that are meant for the Tasklist. */
const STARTABLE: QueryParams = {
  latest: true,
  active: true,
  startableInTasklist: true,
  startablePermissionCheck: true,
};

/** By name (or key), then tenant, like the AngularJS Tasklist. */
export function sortDefinitions(definitions: StartableDefinition[]): StartableDefinition[] {
  const label = (d: StartableDefinition) => (d.name || d.key).toLowerCase();
  return [...definitions].sort(
    (a, b) => label(a).localeCompare(label(b)) || (a.tenantId ?? '').localeCompare(b.tenantId ?? ''),
  );
}

export function useStartableDefinitions(engine: string, search: string, page: number, enabled: boolean) {
  return useQuery({
    queryKey: ['startable-definitions', engine, search, page],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const filter: QueryParams = { ...STARTABLE, nameLike: search ? `%${search}%` : undefined };
      const [definitions, count] = await Promise.all([
        request<StartableDefinition[]>(engineUrl(engine, '/process-definition'), {
          query: { ...filter, sortBy: 'name', sortOrder: 'asc', firstResult: (page - 1) * START_PAGE_SIZE, maxResults: START_PAGE_SIZE },
        }),
        request<{ count: number }>(engineUrl(engine, '/process-definition/count'), { query: filter }),
      ]);
      return { definitions: sortDefinitions(definitions), count: count.count };
    },
  });
}

/** For the ?processStart=<key>&processTenant=<id> link. */
export function useStartableDefinition(engine: string, key: string | undefined, tenantId: string | undefined) {
  return useQuery({
    queryKey: ['startable-definition', engine, key, tenantId],
    enabled: !!key,
    queryFn: async () =>
      (
        await request<StartableDefinition[]>(engineUrl(engine, '/process-definition'), {
          query: { ...STARTABLE, key, tenantIdIn: tenantId, maxResults: 1 },
        })
      )[0] ?? null,
  });
}
