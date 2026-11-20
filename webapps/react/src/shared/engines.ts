import { useQuery } from '@tanstack/react-query';
import { enginesUrl, request } from './api/client';

/**
 * The names of the process engines of the server. The server tells them
 * without a login, as it does for the engine selection of the AngularJS webapps.
 */
export function useEngines() {
  return useQuery({
    queryKey: ['engines'],
    queryFn: async () => (await request<{ name: string }[]>(enginesUrl())).map((engine) => engine.name),
    staleTime: Infinity,
    // the selection is an extra: without the list the webapp works as with one engine
    retry: false,
  });
}
