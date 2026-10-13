import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { initI18n } from '../../shared/i18n';
import { useNotifications } from '../../shared/notifications';
import { json, logIn, renderApp } from '../../test/app';
import { byProcess } from './dashboard/CockpitDashboard';
import type { ProcessStatistics } from './api';

const ENGINE = '/api/engine/engine/default';
const COCKPIT = '/api/cockpit/plugin/base/default';

const definition = (id: string, key: string, name: string, version: number) =>
  ({ id, key, name, version, tenantId: null }) as ProcessStatistics['definition'];

/** Invoice in two versions, an order process; one incident on invoice v1. */
const statistics: ProcessStatistics[] = [
  { id: 'invoice:1', instances: 3, failedJobs: 1, incidents: [{ incidentType: 'failedJob', incidentCount: 1 }], definition: definition('invoice:1', 'invoice', 'Invoice Receipt', 1) },
  { id: 'invoice:2', instances: 4, failedJobs: 0, incidents: [], definition: definition('invoice:2', 'invoice', 'Invoice Receipt', 2) },
  { id: 'order:1', instances: 2, failedJobs: 0, incidents: [], definition: definition('order:1', 'order', 'Order', 1) },
];

function fakeBackend() {
  let loggedIn = false;
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const [path, queryString] = url.split('?');
    const query = new URLSearchParams(queryString);
    if (path === '/api/admin/auth/user/default') {
      return loggedIn ? json({ userId: 'demo', authorizedApps: ['cockpit'] }) : json({}, 404);
    }
    if (path === '/api/admin/auth/user/default/login/cockpit' && method === 'POST') {
      loggedIn = true;
      return json({ userId: 'demo', authorizedApps: ['cockpit'] });
    }
    if (path === `${ENGINE}/user/demo/profile`) {
      return json({ id: 'demo', firstName: 'Demo', lastName: 'Demo' });
    }
    if (path === `${ENGINE}/process-definition/statistics`) {
      return json(statistics);
    }
    if (path === `${ENGINE}/task/count`) {
      return json({ count: query.has('assigned') ? 2 : query.has('withCandidateGroups') ? 5 : query.has('withoutCandidateGroups') ? 1 : 8 });
    }
    if (path === `${ENGINE}/process-definition/count`) {
      return json({ count: 2 });
    }
    if (path === `${ENGINE}/decision-definition/count` || path === `${ENGINE}/deployment/count`) {
      return json({ count: 6 });
    }
    if (path === `${COCKPIT}/process-definition/statistics-count`) {
      return json({ count: 2 });
    }
    if (path === `${COCKPIT}/process-definition/statistics`) {
      return json([
        { id: 'invoice:2', key: 'invoice', name: 'Invoice Receipt', version: 2, tenantId: null, suspensionState: 1, instances: 7, incidents: 1 },
        { id: 'order:1', key: 'order', name: 'Order', version: 1, tenantId: null, suspensionState: 2, instances: 2, incidents: 0 },
      ]);
    }
    return json({ message: `unexpected ${method} ${url}` }, 500);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeAll(() => initI18n('en'));
afterEach(() => {
  vi.unstubAllGlobals();
  useNotifications.setState({ notifications: [] });
});

describe('cockpit dashboard', () => {
  it('counts all versions of a process together', () => {
    expect(byProcess(statistics)).toEqual([
      { key: 'invoice', label: 'Invoice Receipt', instances: 7, incidents: 1 },
      { key: 'order', label: 'Order', instances: 2, incidents: 0 },
    ]);
  });

  it('shows running instances, incidents, human tasks and what is deployed', async () => {
    fakeBackend();
    renderApp('/app/react/cockpit/default/');
    await logIn();

    const running = within((await screen.findByRole('heading', { name: 'Running Process Instances' })).parentElement!);
    expect(await running.findByRole('link', { name: '9' })).toHaveAttribute('href', '/app/react/cockpit/default/processes');
    expect(running.getByTitle('Invoice Receipt: 7')).toBeInTheDocument();

    const tasks = within(screen.getByRole('heading', { name: 'Open Human Tasks' }).parentElement!);
    expect(await tasks.findByText('8')).toBeInTheDocument();
    expect(tasks.getByTitle('Assigned to 1 or more groups: 5')).toBeInTheDocument();
    expect(within(screen.getByRole('heading', { name: 'Deployments' }).parentElement!).getByText('6')).toBeInTheDocument();
  });
});

describe('cockpit processes', () => {
  it('lists the process definitions and sorts them in the URL', async () => {
    const fetchMock = fakeBackend();
    const history = renderApp('/app/react/cockpit/default/processes');
    const user = await logIn();

    expect(await screen.findByText('Invoice Receipt')).toBeInTheDocument();
    expect(screen.getByText('Suspended')).toBeInTheDocument();
    expect(screen.getByText('process definitions deployed')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Running Instances/ }));
    await waitFor(() => expect(history.location.search).toContain('sortBy=instances'));
    expect(
      fetchMock.mock.calls.some(([url]) => url.startsWith(`${COCKPIT}/process-definition/statistics?`) && url.includes('sortBy=instances&sortOrder=asc')),
    ).toBe(true);
  });
});
