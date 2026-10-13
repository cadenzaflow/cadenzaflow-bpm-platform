import { useMutation } from '@tanstack/react-query';
import { engineUrl, request } from '../../../shared/api/client';
import type { CriterionType } from '../../../shared/search/criteria';
import { useInvalidateAdmin, useMemberships, type User } from '../api';

/** Search criteria of the user list (user query of the engine REST API). */
export const USER_CRITERIA: CriterionType[] = [
  { key: 'id', label: 'PLUGIN_SEARCH_USER_ID', kind: 'property', operators: ['eq'] },
  { key: 'firstName', label: 'PLUGIN_SEARCH_USER_FIRSTNAME', kind: 'property', operators: ['eq', 'Like'] },
  { key: 'lastName', label: 'PLUGIN_SEARCH_USER_LASTNAME', kind: 'property', operators: ['eq', 'Like'] },
  { key: 'email', label: 'PLUGIN_SEARCH_USER_EMAIL', kind: 'property', operators: ['eq', 'Like'] },
  { key: 'memberOfGroup', label: 'PLUGIN_SEARCH_USER_GROUP_ID', kind: 'property', operators: ['eq'] },
  { key: 'memberOfTenant', label: 'PLUGIN_SEARCH_USER_TENANT_ID', kind: 'property', operators: ['eq'] },
];

const userUrl = (engine: string, userId: string, path = '') =>
  engineUrl(engine, `/user/${encodeURIComponent(userId)}${path}`);

export function useCreateUser(engine: string) {
  const invalidate = useInvalidateAdmin(engine);
  return useMutation({
    mutationFn: ({ profile, password }: { profile: User; password: string }) =>
      request<void>(engineUrl(engine, '/user/create'), { method: 'POST', json: { profile, credentials: { password } } }),
    onSuccess: invalidate,
  });
}

export function useUpdateProfile(engine: string, userId: string) {
  const invalidate = useInvalidateAdmin(engine);
  return useMutation({
    mutationFn: (profile: User) => request<void>(userUrl(engine, userId, '/profile'), { method: 'PUT', json: profile }),
    onSuccess: invalidate,
  });
}

/** authenticatedUserPassword: the password of the logged-in user, who may be someone else (an admin). */
export function useUpdateCredentials(engine: string, userId: string) {
  return useMutation({
    mutationFn: (credentials: { password: string; authenticatedUserPassword: string }) =>
      request<void>(userUrl(engine, userId, '/credentials'), { method: 'PUT', json: credentials }),
  });
}

export function useDeleteUser(engine: string, userId: string) {
  const invalidate = useInvalidateAdmin(engine);
  return useMutation({
    mutationFn: () => request<void>(userUrl(engine, userId), { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}

/** Unlocks a user that was locked after too many failed logins. */
export function useUnlockUser(engine: string, userId: string) {
  return useMutation({
    mutationFn: () => request<void>(userUrl(engine, userId, '/unlock'), { method: 'POST' }),
  });
}

/** Groups (PUT/DELETE /group/{id}/members/{userId}) or tenants (/tenant/{id}/user-members/{userId}) of a user. */
export function useUserMemberships(engine: string, userId: string, kind: 'group' | 'tenant') {
  return useMemberships(engine, (id) =>
    engineUrl(
      engine,
      kind === 'group'
        ? `/group/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`
        : `/tenant/${encodeURIComponent(id)}/user-members/${encodeURIComponent(userId)}`,
    ),
  );
}
