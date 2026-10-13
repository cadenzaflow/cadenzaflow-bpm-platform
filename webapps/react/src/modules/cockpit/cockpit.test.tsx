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
    if (path === `${ENGINE}/process-definition/invoice%3A2`) {
      return json({ ...statistics[1].definition, versionTag: null, historyTimeToLive: 30, deploymentId: 'd2', suspended: false });
    }
    if (path === `${ENGINE}/process-definition/invoice%3A2/xml`) {
      // no diagram in jsdom
      return json({ message: 'no diagram' }, 404);
    }
    if (path === `${ENGINE}/process-definition/invoice%3A2/statistics`) {
      return json([{ id: 'approveInvoice', instances: 4, failedJobs: 0, incidents: [] }]);
    }
    if (path === `${ENGINE}/process-definition` && query.get('key') === 'invoice') {
      return json([statistics[1].definition, statistics[0].definition]);
    }
    if (path === `${ENGINE}/process-instance/count`) {
      return json({ count: query.has('processDefinitionId') ? 4 : 7 });
    }
    if (path === `${COCKPIT}/incident/count` && method === 'POST') {
      return json({ count: 1 });
    }
    if (path === `${COCKPIT}/incident` && method === 'POST') {
      return json([
        {
          id: 'inc-1',
          processDefinitionId: 'invoice:2',
          processInstanceId: 'pi-1',
          incidentTimestamp: '2026-10-13T08:00:00.000+0000',
          incidentType: 'failedJob',
          activityId: 'approveInvoice',
          failedActivityId: 'approveInvoice',
          incidentMessage: 'Bean not found',
          configuration: 'job-1',
          causeIncidentProcessInstanceId: 'pi-1',
          rootCauseIncidentProcessInstanceId: 'pi-1',
          rootCauseIncidentConfiguration: 'job-1',
          annotation: null,
        },
      ]);
    }
    if ((path === `${ENGINE}/job/job-1/retries` || path === `${ENGINE}/incident/inc-1/annotation`) && method === 'PUT') {
      return new Response(null, { status: 204 });
    }
    if (path === `${COCKPIT}/process-instance/count` && method === 'POST') {
      return json({ count: 1 });
    }
    if (path === `${COCKPIT}/process-instance` && method === 'POST') {
      return json([{ id: 'pi-1', businessKey: 'INV-1', startTime: '2026-10-13T08:00:00.000+0000', incidents: [], suspensionState: 1 }]);
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

describe('cockpit process definition', () => {
  it('shows the details and the instances of the selected activities', async () => {
    const fetchMock = fakeBackend();
    renderApp('/app/react/cockpit/default/process-definition/invoice:2?activityIds=approveInvoice');
    await logIn();

    expect(await screen.findByText('INV-1')).toBeInTheDocument();
    expect(screen.getByLabelText('Definition Version:')).toHaveValue('invoice:2');
    expect(await screen.findByText('current version: 4')).toBeInTheDocument();
    expect(screen.getByText('all versions: 7')).toBeInTheDocument();

    const query = fetchMock.mock.calls.find(([url, init]) => url.startsWith(`${COCKPIT}/process-instance?`) && init?.method === 'POST');
    expect(query?.[0]).toContain('firstResult=0&maxResults=50');
    expect(JSON.parse(String(query?.[1]?.body))).toEqual({
      processDefinitionId: 'invoice:2',
      activityIdIn: ['approveInvoice'],
      sortBy: 'startTime',
      sortOrder: 'desc',
    });
  });
});

describe('cockpit incidents', () => {
  it('lists the incidents of a definition, annotates and retries them', async () => {
    const fetchMock = fakeBackend();
    renderApp('/app/react/cockpit/default/process-definition/invoice:2?tab=pd-incidents-tab');
    const user = await logIn();

    expect(await screen.findByRole('button', { name: 'Bean not found' })).toBeInTheDocument();
    const query = fetchMock.mock.calls.find(([url, init]) => url.startsWith(`${COCKPIT}/incident?`) && init?.method === 'POST');
    expect(JSON.parse(String(query?.[1]?.body))).toEqual({ processDefinitionIdIn: ['invoice:2'], sortBy: 'incidentType', sortOrder: 'asc' });

    await user.click(screen.getByRole('button', { name: 'Annotation' }));
    const annotation = within(await screen.findByRole('dialog', { name: 'Annotation' }));
    await user.type(annotation.getByRole('textbox'), 'Known problem');
    await user.click(annotation.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url, init]) => url.endsWith('/incident/inc-1/annotation') && init?.body === '{"annotation":"Known problem"}')).toBe(true),
    );

    await user.click(screen.getByRole('button', { name: 'Increment Number of Retries' }));
    const retry = within(await screen.findByRole('dialog', { name: 'Increment Number of Retries' }));
    await user.click(retry.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Incrementing the number of retries finished successfully.')).toBeInTheDocument();
    const put = fetchMock.mock.calls.find(([url]) => url.endsWith('/job/job-1/retries'));
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ retries: 1 });
  });
});
