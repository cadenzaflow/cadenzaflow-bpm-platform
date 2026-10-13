import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from '../shared/api/client';

export function createQueryClient(): QueryClient {
  // A 401 means the session ended (timeout, logout in another tab): refetch
  // the authentication so the shell shows the login page.
  const onError = (error: Error) => {
    if (error instanceof ApiError && error.status === 401) {
      queryClient.invalidateQueries({ queryKey: ['authentication'] });
    }
  };

  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        // Client errors (4xx) do not go away by retrying.
        retry: (failureCount, error) => !(error instanceof ApiError && error.status < 500) && failureCount < 2,
        refetchOnWindowFocus: false,
      },
    },
  });
  return queryClient;
}
