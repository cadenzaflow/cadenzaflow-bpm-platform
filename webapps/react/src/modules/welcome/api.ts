import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { engineUrl, request } from '../../shared/api/client';
import { importClassicConfig } from '../../shared/classic-config';

/** A link of the Welcome page: label and description are i18n keys or plain text. */
export interface WelcomeLink {
  label: string;
  href: string;
  description?: string;
}

/** Without configured links, the Welcome page links the documentation (as the classic one). */
export const DEFAULT_LINKS: WelcomeLink[] = [
  { label: 'DOCUMENTATION', href: 'https://docs.cadenzaflow.org/manual/latest/webapps/', description: 'DOCUMENTATION_DESCRIPTION' },
];

const isLink = (value: unknown): value is WelcomeLink =>
  !!value && typeof (value as WelcomeLink).label === 'string' && typeof (value as WelcomeLink).href === 'string';

/** The links configured for the classic Welcome page (`links` in its config.js), or the default. */
export function useWelcomeLinks() {
  return useQuery({
    queryKey: ['welcome-links'],
    staleTime: Infinity,
    queryFn: async () => {
      const { links } = await importClassicConfig('welcome');
      return Array.isArray(links) ? links.filter(isLink) : DEFAULT_LINKS;
    },
  });
}

export interface Group {
  id: string;
  name: string | null;
}

const userUrl = (engine: string, userId: string, path: string) => engineUrl(engine, `/user/${encodeURIComponent(userId)}${path}`);

/** The groups the user is a member of. */
export function useMemberGroups(engine: string, userId: string, page: number, pageSize: number) {
  return useQuery({
    queryKey: ['welcome', engine, 'groups', userId, page],
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const [items, { count }] = await Promise.all([
        request<Group[]>(engineUrl(engine, '/group'), { query: { member: userId, firstResult: (page - 1) * pageSize, maxResults: pageSize } }),
        request<{ count: number }>(engineUrl(engine, '/group/count'), { query: { member: userId } }),
      ]);
      return { items, count };
    },
  });
}

export interface ProfileChanges {
  firstName: string;
  lastName: string;
  email: string;
}

/** Changes the user's own name and email; the header shows the new name. */
export function useUpdateProfile(engine: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: ProfileChanges) =>
      request<void>(userUrl(engine, userId, '/profile'), { method: 'PUT', json: { id: userId, ...changes } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user-profile', engine, userId] }),
  });
}

/** Changes the user's own password; the engine checks the current one. */
export function useChangePassword(engine: string, userId: string) {
  return useMutation({
    mutationFn: ({ current, password }: { current: string; password: string }) =>
      request<void>(userUrl(engine, userId, '/credentials'), {
        method: 'PUT',
        json: { password, authenticatedUserPassword: current },
      }),
  });
}
