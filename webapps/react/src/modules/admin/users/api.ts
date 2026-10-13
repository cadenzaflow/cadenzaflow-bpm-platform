import { useMutation, useQueryClient } from '@tanstack/react-query';
import { engineUrl, request } from '../../../shared/api/client';
import type { CriterionType } from '../../../shared/search/criteria';
import type { User } from '../api';

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

/** After a change: lists, memberships and profiles are reloaded. */
function useInvalidateUsers(engine: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      ['admin-list', 'admin-ids', 'user-profile'].map((key) => queryClient.invalidateQueries({ queryKey: [key, engine] })),
    );
}

export function useCreateUser(engine: string) {
  const invalidate = useInvalidateUsers(engine);
  return useMutation({
    mutationFn: ({ profile, password }: { profile: User; password: string }) =>
      request<void>(engineUrl(engine, '/user/create'), { method: 'POST', json: { profile, credentials: { password } } }),
    onSuccess: invalidate,
  });
}

export function useUpdateProfile(engine: string, userId: string) {
  const invalidate = useInvalidateUsers(engine);
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
  const invalidate = useInvalidateUsers(engine);
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

/**
 * Adds or removes memberships of a user, e.g.
 * PUT /group/{groupId}/members/{userId}, DELETE /tenant/{tenantId}/user-members/{userId}.
 */
export function useUserMemberships(engine: string, userId: string, kind: 'group' | 'tenant') {
  const invalidate = useInvalidateUsers(engine);
  const url = (id: string) =>
    engineUrl(
      engine,
      kind === 'group'
        ? `/group/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`
        : `/tenant/${encodeURIComponent(id)}/user-members/${encodeURIComponent(userId)}`,
    );
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
