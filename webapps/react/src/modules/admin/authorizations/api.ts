import { useMutation } from '@tanstack/react-query';
import { engineUrl, request } from '../../../shared/api/client';
import { useInvalidateAdmin } from '../api';

/** Page size of the authorization list, as in the classic Admin. */
export const AUTHORIZATION_PAGE_SIZE = 25;

export interface Authorization {
  id: string;
  /** 0 GLOBAL, 1 ALLOW (grant), 2 DENY (revoke) */
  type: number;
  permissions: string[];
  userId: string | null;
  groupId: string | null;
  resourceType: number;
  resourceId: string;
}

/** An authorization being created or changed. */
export interface AuthorizationDraft {
  id?: string;
  type: number;
  identityType: 'user' | 'group';
  identityId: string;
  permissions: string[];
  resourceType: number;
  resourceId: string;
}

export function toDraft(authorization: Authorization): AuthorizationDraft {
  return {
    id: authorization.id,
    type: authorization.type,
    identityType: authorization.userId ? 'user' : 'group',
    identityId: authorization.userId ?? authorization.groupId ?? '',
    permissions: authorization.permissions,
    resourceType: authorization.resourceType,
    resourceId: authorization.resourceId,
  };
}

/** POST /authorization/create for a new one, PUT /authorization/{id} for a changed one. */
export function useSaveAuthorization(engine: string) {
  const invalidate = useInvalidateAdmin(engine);
  return useMutation({
    mutationFn: (draft: AuthorizationDraft) => {
      const body = {
        type: draft.type,
        permissions: draft.permissions,
        resourceType: draft.resourceType,
        resourceId: draft.resourceId,
        [draft.identityType === 'user' ? 'userId' : 'groupId']: draft.identityId,
      };
      return draft.id
        ? request<void>(engineUrl(engine, `/authorization/${encodeURIComponent(draft.id)}`), { method: 'PUT', json: body })
        : request<void>(engineUrl(engine, '/authorization/create'), { method: 'POST', json: body });
    },
    onSettled: invalidate,
  });
}

export function useDeleteAuthorization(engine: string) {
  const invalidate = useInvalidateAdmin(engine);
  return useMutation({
    mutationFn: (id: string) => request<void>(engineUrl(engine, `/authorization/${encodeURIComponent(id)}`), { method: 'DELETE' }),
    onSettled: invalidate,
  });
}
