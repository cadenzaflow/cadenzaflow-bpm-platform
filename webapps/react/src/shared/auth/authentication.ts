import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, adminUrl, engineUrl, request } from '../api/client';
import type { ModuleName } from '../config';

export interface Authentication {
  userId: string;
  authorizedApps: ModuleName[];
}

export interface UserProfile {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

export const authenticationKey = (engine: string) => ['authentication', engine] as const;

/** The logged-in user of the engine, or null when nobody is logged in (the API answers 404). */
export async function fetchAuthentication(engine: string): Promise<Authentication | null> {
  try {
    return await request<Authentication>(adminUrl(`/auth/user/${encodeURIComponent(engine)}`));
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 401)) {
      return null;
    }
    throw error;
  }
}

export function useAuthentication(engine: string) {
  return useQuery({
    queryKey: authenticationKey(engine),
    queryFn: () => fetchAuthentication(engine),
    staleTime: Infinity,
  });
}

export function useUserProfile(engine: string, userId: string | undefined) {
  return useQuery({
    queryKey: ['user-profile', engine, userId],
    queryFn: !userId
      ? skipToken
      : () => request<UserProfile>(engineUrl(engine, `/user/${encodeURIComponent(userId)}/profile`)),
    staleTime: Infinity,
  });
}

export interface Credentials {
  username: string;
  password: string;
}

/**
 * Logs in for the given module. The server answers 401 for wrong credentials
 * and 403 when the user may not use the module.
 */
export function useLogin(engine: string, module: ModuleName) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials: Credentials) =>
      request<Authentication>(adminUrl(`/auth/user/${encodeURIComponent(engine)}/login/${module}`), {
        method: 'POST',
        form: { username: credentials.username, password: credentials.password },
      }),
    // The server starts a new session on login; refetching (a GET) also
    // hands out the CSRF token of that new session.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: authenticationKey(engine) }),
  });
}

export function useLogout(engine: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => request<void>(adminUrl(`/auth/user/${encodeURIComponent(engine)}/logout`), { method: 'POST' }),
    onSettled: () => {
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== 'authentication' });
      queryClient.setQueryData(authenticationKey(engine), null);
    },
  });
}
