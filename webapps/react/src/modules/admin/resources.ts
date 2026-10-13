import { skipToken, useMutation, useQuery } from '@tanstack/react-query';
import { engineUrl, request } from '../../shared/api/client';
import type { CriterionType } from '../../shared/search/criteria';
import { useInvalidateAdmin, useMemberships, type Group, type Tenant } from './api';

/** Search criteria of the group list. */
export const GROUP_CRITERIA: CriterionType[] = [
  { key: 'id', label: 'PLUGIN_SEARCH_GROUPS_ID', kind: 'property', operators: ['eq'] },
  { key: 'name', label: 'PLUGIN_SEARCH_GROUPS_NAME', kind: 'property', operators: ['eq', 'Like'] },
  { key: 'type', label: 'PLUGIN_SEARCH_GROUPS_TYPE', kind: 'property', operators: ['eq'] },
  { key: 'member', label: 'PLUGIN_SEARCH_GROUPS_USER_ID', kind: 'property', operators: ['eq'] },
  { key: 'memberOfTenant', label: 'PLUGIN_SEARCH_GROUPS_TENANT_ID', kind: 'property', operators: ['eq'] },
];

/** Search criteria of the tenant list. */
export const TENANT_CRITERIA: CriterionType[] = [
  { key: 'id', label: 'PLUGIN_SEARCH_TENANTS_ID', kind: 'property', operators: ['eq'] },
  { key: 'name', label: 'PLUGIN_SEARCH_TENANTS_NAME', kind: 'property', operators: ['eq', 'Like'] },
  { key: 'userMember', label: 'PLUGIN_SEARCH_TENANTS_USER_ID', kind: 'property', operators: ['eq'] },
  { key: 'groupMember', label: 'PLUGIN_SEARCH_TENANTS_GROUP_ID', kind: 'property', operators: ['eq'] },
];

/**
 * Read, create, update and delete of groups (/group) and tenants (/tenant),
 * which work the same way in the engine REST API.
 */
export function useIdentityItem<T extends Group | Tenant>(engine: string, path: '/group' | '/tenant', id: string | undefined) {
  const invalidate = useInvalidateAdmin(engine);
  const url = (itemId: string) => engineUrl(engine, `${path}/${encodeURIComponent(itemId)}`);
  const item = useQuery({
    queryKey: ['admin-item', engine, path, id],
    queryFn: !id ? skipToken : () => request<T>(url(id)),
  });
  const create = useMutation({
    mutationFn: (value: T) => request<void>(engineUrl(engine, `${path}/create`), { method: 'POST', json: value }),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: (value: T) => request<void>(url(value.id), { method: 'PUT', json: value }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (itemId: string) => request<void>(url(itemId), { method: 'DELETE' }),
    onSuccess: invalidate,
  });
  return { item, create, update, remove };
}

/** Tenants of a group: PUT/DELETE /tenant/{tenantId}/group-members/{groupId}. */
export function useGroupTenants(engine: string, groupId: string) {
  return useMemberships(engine, (tenantId) =>
    engineUrl(engine, `/tenant/${encodeURIComponent(tenantId)}/group-members/${encodeURIComponent(groupId)}`),
  );
}
