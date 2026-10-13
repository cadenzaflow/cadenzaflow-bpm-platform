import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { createQueryClient } from '../app/query-client';
import { createAppRouter } from '../app/router';

/** A JSON response of a fake backend. */
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/** Renders the whole app at the URL (below the base path), with a fresh query cache. */
export function renderApp(url: string) {
  const history = createMemoryHistory({ initialEntries: [url] });
  const router = createAppRouter(history);
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return history;
}

/** Logs in as demo on the login page. */
export async function logIn(password = 'demo') {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Username'), 'demo');
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Log in' }));
  return user;
}
