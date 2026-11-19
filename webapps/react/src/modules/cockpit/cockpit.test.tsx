import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { initI18n } from '../../shared/i18n';
import { toEngineDate } from '../../shared/variables';
import { useNotifications } from '../../shared/notifications';
import { json, logIn, renderApp } from '../../test/app';
import { byProcess } from './dashboard/CockpitDashboard';
import type { ProcessStatistics } from './api';
import type { ActivityInstance } from './process-instance/api';
import type { VariableInstance } from './variables/api';

// the settings of the classic cockpit/scripts/config.js, per test
const classicConfig = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('../../shared/classic-config', () => ({ importClassicConfig: async () => classicConfig.value }));

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

/**
 * Instance pi-1 of invoice:2: waiting in a user task, and in an async
 * continuation whose transition instance has the process instance's id.
 */
const activityTree: ActivityInstance = {
  id: 'pi-1',
  activityId: 'invoice:2',
  activityName: 'Invoice Receipt',
  activityType: 'processDefinition',
  executionIds: ['pi-1'],
  childActivityInstances: [
    { id: 'approveInvoice:ai-1', activityId: 'approveInvoice', activityName: 'Approve Invoice', activityType: 'userTask', executionIds: ['ex-2'] },
  ],
  childTransitionInstances: [
    {
      id: 'pi-1',
      executionId: 'pi-1',
      activityId: 'prepareTransfer',
      activityName: 'Prepare Bank Transfer',
      activityType: 'serviceTask',
      incidents: [{ id: 'inc-1', activityId: 'prepareTransfer' }],
    },
  ],
};

/** Variables of pi-1: a number and an object on the process instance and a file in the user task. */
const variables: VariableInstance[] = [
  { id: 'v-1', name: 'amount', type: 'Double', value: 30.5, processInstanceId: 'pi-1', executionId: 'pi-1', activityInstanceId: 'pi-1', taskId: null },
  {
    id: 'v-2',
    name: 'invoiceDocument',
    type: 'File',
    value: null,
    valueInfo: { filename: 'invoice.pdf', mimeType: 'application/pdf' },
    processInstanceId: 'pi-1',
    executionId: 'ex-2',
    activityInstanceId: 'approveInvoice:ai-1',
    taskId: null,
  },
  {
    id: 'v-3',
    name: 'order',
    type: 'Object',
    value: '{"id":1}',
    valueInfo: { objectTypeName: 'com.example.Order', serializationDataFormat: 'application/json' },
    processInstanceId: 'pi-1',
    executionId: 'pi-1',
    activityInstanceId: 'pi-1',
    taskId: null,
  },
];

/** An incident of the instance pi-1 itself: its own cause and root cause. */
const ownIncident = {
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
  causeIncidentActivityId: 'approveInvoice',
  rootCauseIncidentProcessInstanceId: 'pi-1',
  rootCauseIncidentActivityId: 'approveInvoice',
  rootCauseIncidentConfiguration: 'job-1',
  rootCauseIncidentMessage: 'Bean not found',
  annotation: null,
};

function fakeBackend(incidents: unknown[] = [ownIncident]) {
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
      return json(incidents);
    }
    if (path === `${ENGINE}/job/job-1/stacktrace`) {
      return new Response('java.lang.IllegalStateException: Bean not found', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    if ((path === `${ENGINE}/job/job-1/retries` || path === `${ENGINE}/incident/inc-1/annotation`) && method === 'PUT') {
      return new Response(null, { status: 204 });
    }
    if (path === `${ENGINE}/process-instance/pi-1` && method === 'GET') {
      return json({ id: 'pi-1', definitionId: 'invoice:2', businessKey: 'INV-1', suspended: false, ended: false, tenantId: null });
    }
    if ((path === `${ENGINE}/process-instance/pi-1/suspended` && method === 'PUT') || (path === `${ENGINE}/process-instance/pi-1` && method === 'DELETE')) {
      return new Response(null, { status: 204 });
    }
    if (path === `${ENGINE}/process-instance/pi-1/activity-instances`) {
      return json(activityTree);
    }
    if (path === `${ENGINE}/process-instance` && query.get('superProcessInstance') === 'pi-1') {
      return json([{ id: 'sub-1' }, { id: 'sub-2' }, { id: 'sub-3' }, { id: 'sub-4' }, { id: 'sub-5' }]);
    }
    if (path === `${ENGINE}/process-instance` && query.get('subProcessInstance') === 'pi-1') {
      return json([{ id: 'super-1', definitionId: 'order:1', businessKey: null, suspended: false, ended: false, tenantId: null }]);
    }
    if (path === `${ENGINE}/job/count` && query.get('withException') === 'true') {
      return json({ count: 2 });
    }
    if (path === `${ENGINE}/job` && query.get('withException') === 'true') {
      return json([
        { id: 'failed-1', executionId: 'pi-1', exceptionMessage: 'Bean not found' },
        { id: 'failed-2', executionId: 'ex-2', exceptionMessage: 'Timeout' },
      ]);
    }
    if (path === `${ENGINE}/job/failed-1/retries` && method === 'PUT') {
      return new Response(null, { status: 204 });
    }
    if (path === `${ENGINE}/job/failed-2/retries` && method === 'PUT') {
      return json({ message: 'job is locked' }, 500);
    }
    if (path === `${ENGINE}/job/count` && query.get('processInstanceId') === 'pi-1') {
      return json({ count: 1 });
    }
    if (path === `${ENGINE}/job` && query.get('processInstanceId') === 'pi-1') {
      return json([
        {
          id: 'job-1',
          jobDefinitionId: 'jd-1',
          dueDate: '2026-10-14T10:00:00.000+0000',
          createTime: '2026-10-14T09:00:00.000+0000',
          retries: 3,
          suspended: false,
          failedActivityId: null,
        },
      ]);
    }
    if (path === `${ENGINE}/job-definition` && query.get('processDefinitionId') === 'invoice:2') {
      return json([
        { id: 'jd-1', activityId: 'approveInvoice', jobType: 'async-continuation' },
        { id: 'jd-2', activityId: 'waitForPayment', jobType: 'timer-intermediate-transition' },
      ]);
    }
    if (path === `${ENGINE}/job-definition/jd-1/jobPriority` && method === 'PUT') {
      return new Response(null, { status: 204 });
    }
    if (path === `${ENGINE}/job-definition/jd-2/jobPriority` && method === 'PUT') {
      return json({ message: 'not allowed' }, 403);
    }
    if (path === `${ENGINE}/job-definition/jd-1`) {
      return json({ id: 'jd-1', activityId: 'waitForPayment' });
    }
    if (path.startsWith(`${ENGINE}/job/job-1/`) && (method === 'PUT' || method === 'POST')) {
      return new Response(null, { status: 204 });
    }
    if (path === `${ENGINE}/external-task/count` && method === 'POST') {
      return json({ count: 1 });
    }
    if (path === `${ENGINE}/external-task` && method === 'POST') {
      return json([
        { id: 'ext-1', activityId: 'prepareTransfer', retries: null, workerId: 'worker-1', lockExpirationTime: null, topicName: 'transfer', priority: 0 },
      ]);
    }
    if (path === `${ENGINE}/task/count` && method === 'POST') {
      return json({ count: 1 });
    }
    if (path === `${ENGINE}/task` && method === 'POST') {
      return json([
        {
          id: 'task-1',
          name: 'Approve Invoice',
          taskDefinitionKey: 'approveInvoice',
          executionId: 'ex-2',
          assignee: 'demo',
          owner: null,
          created: '2026-10-13T08:00:00.000+0000',
          due: null,
          followUp: null,
          priority: 50,
          delegationState: null,
        },
      ]);
    }
    if (path === `${ENGINE}/task/task-1/identity-links` && method === 'GET') {
      return json([
        { type: 'assignee', userId: 'demo', groupId: null },
        { type: 'candidate', userId: null, groupId: 'accounting' },
      ]);
    }
    if (path.startsWith(`${ENGINE}/task/task-1/`) && method === 'POST') {
      return new Response(null, { status: 204 });
    }
    if (path === `${ENGINE}/variable-instance/count` && method === 'POST') {
      return json({ count: variables.length });
    }
    if (path === `${ENGINE}/variable-instance` && method === 'POST') {
      return json(variables);
    }
    if (path === `${ENGINE}/variable-instance/v-3` && method === 'GET') {
      return json({ ...variables[2], value: { id: 1 } });
    }
    if (path.startsWith(`${ENGINE}/execution/pi-1/localVariables/`) && path.endsWith('/data') && method === 'POST') {
      return new Response(null, { status: 204 });
    }
    if (
      (path === `${ENGINE}/execution/pi-1/localVariables/amount` && (method === 'PUT' || method === 'DELETE')) ||
      (path === `${ENGINE}/process-instance/pi-1/variables/note` && method === 'PUT')
    ) {
      return new Response(null, { status: 204 });
    }
    if (path === `${COCKPIT}/process-instance/pi-1/called-process-instances` && method === 'POST') {
      return json([]);
    }
    if (path === `${COCKPIT}/process-instance/count` && method === 'POST') {
      return json({ count: 1 });
    }
    if (path === `${COCKPIT}/process-instance` && method === 'POST') {
      return json([
        { id: 'pi-1', businessKey: 'INV-1', startTime: '2026-10-13T08:00:00.000+0000', incidents: [], suspended: false },
        { id: 'pi-9', businessKey: 'INV-9', startTime: '2026-10-12T08:00:00.000+0000', incidents: [], suspended: true },
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
  classicConfig.value = {};
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
  it('shows the definitions as previews with their names and counts', async () => {
    fakeBackend();
    renderApp('/app/react/cockpit/default/processes');
    const user = await logIn();
    await screen.findByRole('link', { name: 'Invoice Receipt' });
    expect(screen.getByRole('table')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Previews' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    const tile = within(screen.getByRole('link', { name: 'Invoice Receipt' }).closest('li')!);
    expect(tile.getByRole('link', { name: 'Invoice Receipt' })).toHaveAttribute('href', '/app/react/cockpit/default/process-definition/invoice%3A2');
    expect(tile.getByText('7 Running Instances')).toBeInTheDocument();
    expect(tile.getByLabelText('Incidents')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'List' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('lists the process definitions and sorts them in the URL', async () => {
    const fetchMock = fakeBackend();
    const history = renderApp('/app/react/cockpit/default/processes');
    const user = await logIn();

    expect(await screen.findByText('Invoice Receipt')).toBeInTheDocument();
    expect(screen.getByText('Suspended')).toBeInTheDocument();
    // the state says whether a definition has incidents, as in the classic Cockpit
    expect(within(screen.getByText('Invoice Receipt').closest('tr')!).getByLabelText('With Incidents')).toBeInTheDocument();
    expect(within(screen.getByText('Order').closest('tr')!).queryByLabelText('With Incidents')).not.toBeInTheDocument();
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
    expect(within(screen.getByText('INV-9').closest('tr')!).getByText('Suspended')).toBeInTheDocument();
    expect(within(screen.getByText('INV-1').closest('tr')!).queryByText('Suspended')).not.toBeInTheDocument();
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

describe('cockpit job priority of all job definitions', () => {
  it('overrides the priority of every job definition and reports each one', async () => {
    const fetchMock = fakeBackend();
    renderApp('/app/react/cockpit/default/process-definition/invoice:2');
    const user = await logIn();

    await user.click(await screen.findByRole('button', { name: 'Change Overriding Job Priority for all Job Definitions' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Change Overriding Job Priority' }));
    await user.type(dialog.getByLabelText('Priority'), '10');
    await user.click(dialog.getByLabelText('Include Existing Jobs'));
    await user.click(await dialog.findByRole('button', { name: 'Override' }));

    expect(await dialog.findByText('Successful')).toBeInTheDocument();
    expect(dialog.getByText('Failed')).toBeInTheDocument();
    expect(within(dialog.getByText('Successful').closest('tr')!).getByText('async-continuation')).toBeInTheDocument();
    const puts = fetchMock.mock.calls.filter(([url, init]) => url.endsWith('/jobPriority') && init?.method === 'PUT');
    expect(puts.map(([url]) => url.split('/').at(-2))).toEqual(['jd-1', 'jd-2']);
    expect(puts.map(([, init]) => JSON.parse(String(init?.body)))).toEqual([
      { priority: 10, includeJobs: true },
      { priority: 10, includeJobs: true },
    ]);
    expect(await screen.findByText('Overriding the priority was not successful.')).toBeInTheDocument();
  });
});

describe('cockpit incidents', () => {
  it('lists the incidents of a definition, annotates and retries them', async () => {
    const fetchMock = fakeBackend();
    const history = renderApp('/app/react/cockpit/default/process-definition/invoice:2?tab=pd-incidents-tab');
    const user = await logIn();

    expect(await screen.findByRole('button', { name: 'Bean not found' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Failing Activity' })).toBeInTheDocument();
    const query = fetchMock.mock.calls.find(([url, init]) => url.startsWith(`${COCKPIT}/incident?`) && init?.method === 'POST');
    expect(JSON.parse(String(query?.[1]?.body))).toEqual({ processDefinitionIdIn: ['invoice:2'], sortBy: 'incidentType', sortOrder: 'asc' });

    // the open stack trace is in the URL, so a link shows it
    await user.click(screen.getByRole('button', { name: 'Bean not found' }));
    const stacktrace = within(await screen.findByRole('dialog', { name: 'View stacktrace' }));
    expect(await stacktrace.findByText(/java\.lang\.IllegalStateException/)).toBeInTheDocument();
    expect(history.location.search).toBe('?tab=pd-incidents-tab&incidentStacktrace=job-1');
    await user.click(stacktrace.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(history.location.search).toBe('?tab=pd-incidents-tab'));

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

  it('names no other instance for an incident of the instance itself', async () => {
    fakeBackend();
    renderApp('/app/react/cockpit/default/process-instance/pi-1?tab=incidents-tab');
    await logIn();

    const row = (await screen.findByRole('button', { name: 'Bean not found' })).closest('tr')!;
    expect(within(row).queryByRole('link')).not.toBeInTheDocument();
  });

  it('shows the message and the instances an incident of a called instance goes back to', async () => {
    // what the engine creates on the calling instance: no message of its own
    fakeBackend([
      {
        ...ownIncident,
        id: 'inc-2',
        incidentMessage: null,
        configuration: null,
        causeIncidentProcessInstanceId: 'pi-child',
        causeIncidentActivityId: 'callGrandchild',
        rootCauseIncidentProcessInstanceId: 'pi-grandchild',
        rootCauseIncidentActivityId: 'ship',
        rootCauseIncidentConfiguration: 'job-9',
        rootCauseIncidentMessage: 'Shipping failed',
      },
    ]);
    renderApp('/app/react/cockpit/default/process-instance/pi-1?tab=incidents-tab');
    await logIn();

    const row = within((await screen.findByRole('button', { name: 'Shipping failed' })).closest('tr')!);
    expect(row.getByRole('link', { name: 'pi-child' })).toHaveAttribute(
      'href',
      '/app/react/cockpit/default/process-instance/pi-child?tab=incidents-tab&activityIds=callGrandchild',
    );
    expect(row.getByRole('link', { name: 'pi-grandchild' })).toHaveAttribute(
      'href',
      '/app/react/cockpit/default/process-instance/pi-grandchild?tab=incidents-tab&activityIds=ship',
    );
    // the job to retry belongs to the called instance
    expect(row.queryByRole('button', { name: 'Increment Number of Retries' })).not.toBeInTheDocument();
  });
});

describe('cockpit process instance', () => {
  it('shows the details and filters the tabs by the activity instances picked in the tree', async () => {
    const fetchMock = fakeBackend();
    const history = renderApp('/app/react/cockpit/default/process-instance/pi-1?tab=incidents-tab');
    const user = await logIn();

    expect(await screen.findByText('INV-1')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'super-1' })).toHaveAttribute('href', '/app/react/cockpit/default/process-instance/super-1');
    const tree = within(await screen.findByRole('tree'));
    const node = (label: string) => tree.getByText(label).closest('[role="treeitem"]');
    expect(node('Invoice Receipt')).toHaveAttribute('aria-selected', 'true');

    await user.click(tree.getByText('Approve Invoice'));
    await waitFor(() => expect(history.location.search).toBe('?tab=incidents-tab&activityIds=approveInvoice&activityInstanceIds=approveInvoice%3Aai-1'));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            url.startsWith(`${COCKPIT}/incident?`) &&
            init?.body === JSON.stringify({ processInstanceIdIn: ['pi-1'], activityIdIn: ['approveInvoice'], sortBy: 'incidentType', sortOrder: 'asc' }),
        ),
      ).toBe(true),
    );

    // the transition instance shares the process instance's id, it still selects only itself
    await user.click(tree.getByText('Prepare Bank Transfer'));
    await waitFor(() => expect(history.location.search).toBe('?tab=incidents-tab&activityIds=prepareTransfer&activityInstanceIds=pi-1'));
    expect(node('Prepare Bank Transfer')).toHaveAttribute('aria-selected', 'true');
    expect(node('Invoice Receipt')).toHaveAttribute('aria-selected', 'false');

    await user.click(tree.getByText('Invoice Receipt'));
    await waitFor(() => expect(history.location.search).toBe('?tab=incidents-tab'));

    // the field above the tree keeps the instances with the name, in their scope
    await user.type(screen.getByRole('searchbox', { name: 'Filters activity instances that have the entered name.' }), 'bank');
    expect(tree.getByText('Prepare Bank Transfer')).toBeInTheDocument();
    expect(tree.getByText('Invoice Receipt')).toBeInTheDocument();
    expect(tree.queryByText('Approve Invoice')).not.toBeInTheDocument();
  });

  it('suspends and deletes the instance', async () => {
    const fetchMock = fakeBackend();
    const history = renderApp('/app/react/cockpit/default/process-instance/pi-1');
    const user = await logIn();

    await user.click(await screen.findByRole('button', { name: 'Suspend Process Instance' }));
    const suspend = within(await screen.findByRole('dialog', { name: 'Suspend Process Instance' }));
    await user.click(suspend.getByRole('button', { name: 'Suspend' }));
    expect(await screen.findByText('Updated the suspension state of the process instance.')).toBeInTheDocument();
    const put = fetchMock.mock.calls.find(([url]) => url.endsWith('/process-instance/pi-1/suspended'));
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ suspended: true });

    await user.click(screen.getByRole('button', { name: 'Delete Process Instance' }));
    const cancel = within(await screen.findByRole('dialog', { name: 'Delete running process instance' }));
    // the instances it called go with it: five by name, the rest counted
    expect(await cancel.findByText('If you delete this process instance the following sub process instances will also be deleted:')).toBeInTheDocument();
    expect(cancel.getByRole('link', { name: 'sub-5' })).toHaveAttribute('href', '/app/react/cockpit/default/process-instance/sub-5');
    expect(cancel.getByText('and 2 other process instances.')).toBeInTheDocument();
    await user.click(cancel.getByRole('checkbox', { name: 'Skip IO Mappings' }));
    await user.click(cancel.getByRole('button', { name: 'Delete Process Instance' }));
    await waitFor(() => expect(history.location.pathname).toBe('/app/react/cockpit/default/process-definition/invoice%3A2'));
    const deleted = fetchMock.mock.calls.find(([url, init]) => url.startsWith(`${ENGINE}/process-instance/pi-1?`) && init?.method === 'DELETE');
    expect(deleted?.[0]).toContain('skipCustomListeners=true&skipIoMappings=false');
  });
});

describe('cockpit process instance variables', () => {
  const variableQueries = (fetchMock: ReturnType<typeof fakeBackend>) =>
    fetchMock.mock.calls
      .filter(([url, init]) => url.startsWith(`${ENGINE}/variable-instance?`) && init?.method === 'POST')
      .map(([url, init]) => ({ url, body: JSON.parse(String(init?.body)) }));

  it('lists the variables of the instance or of the selected activity instances', async () => {
    const fetchMock = fakeBackend();
    const history = renderApp('/app/react/cockpit/default/process-instance/pi-1');
    const user = await logIn();

    expect(await screen.findByText('amount')).toBeInTheDocument();
    expect(screen.getByText('30.5')).toBeInTheDocument();
    expect(screen.getByText('invoice.pdf')).toBeInTheDocument();
    expect(variableQueries(fetchMock)[0].url).toContain('deserializeValues=false&firstResult=0&maxResults=50');
    expect(variableQueries(fetchMock)[0].body).toEqual({ processInstanceIdIn: ['pi-1'], sortBy: 'variableName', sortOrder: 'asc' });

    // the scope of a variable selects its activity instance
    await user.click(screen.getByRole('button', { name: 'Approve Invoice' }));
    await waitFor(() => expect(history.location.search).toBe('?activityIds=approveInvoice&activityInstanceIds=approveInvoice%3Aai-1'));
    await waitFor(() =>
      expect(variableQueries(fetchMock).at(-1)?.body).toEqual({
        processInstanceIdIn: ['pi-1'],
        activityInstanceIdIn: ['approveInvoice:ai-1'],
        sortBy: 'variableName',
        sortOrder: 'asc',
      }),
    );
  });

  it('changes, deletes and adds variables', async () => {
    const fetchMock = fakeBackend();
    renderApp('/app/react/cockpit/default/process-instance/pi-1');
    const user = await logIn();
    const row = within((await screen.findByText('amount')).closest('tr')!);

    await user.click(row.getByRole('button', { name: 'Change' }));
    const edit = within(await screen.findByRole('dialog', { name: 'Variable' }));
    const value = edit.getByLabelText('Variable Value*');
    await user.clear(value);
    await user.type(value, 'many');
    expect(edit.getByText('Only a Double value is allowed.')).toBeInTheDocument();
    expect(edit.getByRole('button', { name: 'Change' })).toBeDisabled();
    await user.clear(value);
    await user.type(value, '42');
    await user.click(edit.getByRole('button', { name: 'Change' }));
    expect(await screen.findByText("The variable 'amount' has been changed successfully.")).toBeInTheDocument();
    const put = fetchMock.mock.calls.find(([url, init]) => url.endsWith('/execution/pi-1/localVariables/amount') && init?.method === 'PUT');
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ type: 'Double', value: 42 });

    await user.click(row.getByRole('button', { name: 'Delete' }));
    const remove = within(await screen.findByRole('dialog', { name: 'Variable' }));
    expect(remove.getByText("Are you sure that you want to delete 'amount'")).toBeInTheDocument();
    await user.click(remove.getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url, init]) => url.endsWith('/execution/pi-1/localVariables/amount') && init?.method === 'DELETE')).toBe(true),
    );

    await user.click(screen.getByRole('button', { name: 'Add a new variable to Process Instance' }));
    const add = within(await screen.findByRole('dialog', { name: 'Add Variable to Process Instance' }));
    expect(add.getByRole('button', { name: 'Add' })).toBeDisabled();
    await user.type(add.getByLabelText('Variable Name*'), 'note');
    await user.type(add.getByLabelText('Variable Value*'), 'hello');
    await user.click(add.getByRole('button', { name: 'Add' }));
    await waitFor(() => {
      const added = fetchMock.mock.calls.find(([url]) => url.endsWith('/process-instance/pi-1/variables/note'));
      expect(JSON.parse(String(added?.[1]?.body))).toEqual({ type: 'String', value: 'hello' });
    });
  });

  it('sets a variable to null, makes it a file and changes an object as it is deserialized', async () => {
    const fetchMock = fakeBackend();
    renderApp('/app/react/cockpit/default/process-instance/pi-1');
    const user = await logIn();
    const row = (name: string) => within(screen.getByText(name).closest('tr')!);
    const sent = (path: string, method: string) => fetchMock.mock.calls.filter(([url, init]) => url.endsWith(path) && init?.method === method);
    await screen.findByText('amount');

    // null keeps the type
    await user.click(row('amount').getByRole('button', { name: 'Change' }));
    let edit = within(await screen.findByRole('dialog', { name: 'Variable' }));
    await user.click(edit.getByRole('checkbox', { name: 'Set value to "null"' }));
    expect(edit.queryByLabelText('Variable Value*')).not.toBeInTheDocument();
    await user.click(edit.getByRole('button', { name: 'Change' }));
    await waitFor(() => expect(sent('/execution/pi-1/localVariables/amount', 'PUT')).toHaveLength(1));
    expect(JSON.parse(String(sent('/execution/pi-1/localVariables/amount', 'PUT')[0][1]?.body))).toEqual({ type: 'Double', value: null });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Variable' })).not.toBeInTheDocument());

    // a binary type takes a file
    await user.click(row('amount').getByRole('button', { name: 'Change' }));
    edit = within(await screen.findByRole('dialog', { name: 'Variable' }));
    await user.selectOptions(edit.getByLabelText('Variable Type*'), 'File');
    expect(edit.getByRole('button', { name: 'Change' })).toBeDisabled();
    await user.upload(edit.getByLabelText('File', { selector: 'input' }), new File(['%PDF'], 'scan.pdf', { type: 'application/pdf' }));
    await user.click(edit.getByRole('button', { name: 'Change' }));
    await waitFor(() => expect(sent('/execution/pi-1/localVariables/amount/data', 'POST')).toHaveLength(1));
    const upload = sent('/execution/pi-1/localVariables/amount/data', 'POST')[0][1]?.body as FormData;
    expect(upload.get('valueType')).toBe('File');
    expect((upload.get('data') as File).name).toBe('scan.pdf');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Variable' })).not.toBeInTheDocument());

    // an object: the value the engine deserializes, sent back as JSON for its Java type
    await user.click(row('order').getByRole('button', { name: 'Change' }));
    edit = within(await screen.findByRole('dialog', { name: 'Variable' }));
    await user.click(edit.getByRole('tab', { name: 'Deserialized' }));
    const value = await edit.findByRole('textbox', { name: 'Deserialized' });
    expect(value).toHaveValue('{"id":1}');
    expect(edit.getByRole('button', { name: 'Change' })).toBeDisabled();
    await user.clear(value);
    await user.type(value, '{{"id":');
    expect(edit.getByRole('button', { name: 'Change' })).toBeDisabled();
    await user.type(value, '2}');
    await user.click(edit.getByRole('button', { name: 'Change' }));
    await waitFor(() => expect(sent('/execution/pi-1/localVariables/order/data', 'POST')).toHaveLength(1));
    const changed = sent('/execution/pi-1/localVariables/order/data', 'POST')[0][1]?.body as FormData;
    expect(changed.get('type')).toBe('com.example.Order');
    expect(await (changed.get('data') as Blob).text()).toBe('{"id":2}');
  });
});

describe('cockpit process instance user tasks', () => {
  it('lists the user tasks, changes the assignee and the candidate groups', async () => {
    const fetchMock = fakeBackend();
    renderApp('/app/react/cockpit/default/process-instance/pi-1?tab=user-tasks-tab');
    const user = await logIn();

    const row = within((await screen.findByRole('link', { name: 'task-1' })).closest('tr')!);
    expect(screen.getByRole('link', { name: 'task-1' })).toHaveAttribute('href', '/app/react/tasklist/default?task=task-1');
    // the activity instance of the task's execution
    expect(row.getByRole('button', { name: 'Approve Invoice' })).toBeInTheDocument();
    const query = fetchMock.mock.calls.find(([url, init]) => url.startsWith(`${ENGINE}/task?`) && init?.method === 'POST');
    expect(JSON.parse(String(query?.[1]?.body))).toEqual({ processInstanceId: 'pi-1', sortBy: 'created', sortOrder: 'desc' });

    await user.click(row.getByRole('button', { name: 'Assignee' }));
    const assignee = row.getByRole('textbox', { name: 'Assignee' });
    await user.clear(assignee);
    await user.type(assignee, 'john{Enter}');
    expect(await screen.findByText("The assignee of the user task 'Approve Invoice' has been set to 'john' successfully")).toBeInTheDocument();
    const assigned = fetchMock.mock.calls.find(([url]) => url.endsWith('/task/task-1/assignee'));
    expect(JSON.parse(String(assigned?.[1]?.body))).toEqual({ userId: 'john' });

    await user.click(row.getByRole('button', { name: "Manage group(s) for 'Approve Invoice'" }));
    const groups = within(await screen.findByRole('dialog', { name: 'Manage groups' }));
    expect(await groups.findByText('accounting')).toBeInTheDocument();
    expect(groups.queryByText('demo')).not.toBeInTheDocument();
    await user.type(groups.getByRole('textbox', { name: 'Add a group' }), 'sales{Enter}');
    await waitFor(() => {
      const added = fetchMock.mock.calls.find(([url, init]) => url.endsWith('/task/task-1/identity-links') && init?.method === 'POST');
      expect(JSON.parse(String(added?.[1]?.body))).toEqual({ groupId: 'sales', type: 'candidate' });
    });
    await user.click(groups.getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      const removed = fetchMock.mock.calls.find(([url]) => url.endsWith('/task/task-1/identity-links/delete'));
      expect(JSON.parse(String(removed?.[1]?.body))).toEqual({ groupId: 'accounting', type: 'candidate' });
    });
  });
});

describe('cockpit process instance jobs and external tasks', () => {
  it('suspends a job and sets the due date of a timer', async () => {
    const fetchMock = fakeBackend();
    renderApp('/app/react/cockpit/default/process-instance/pi-1?tab=jobs-tab');
    const user = await logIn();

    const row = within((await screen.findByText('job-1')).closest('tr')!);
    // the activity comes from the job definition
    expect(await row.findByRole('button', { name: 'waitForPayment' })).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => url.startsWith(`${ENGINE}/job?`) && url.includes('sortBy=jobId&sortOrder=desc'))).toBe(true);

    await user.click(row.getByRole('button', { name: 'Suspend' }));
    expect(await screen.findByText('The suspension state of the job has been updated successfully.')).toBeInTheDocument();
    const suspended = fetchMock.mock.calls.find(([url]) => url.endsWith('/job/job-1/suspended'));
    expect(JSON.parse(String(suspended?.[1]?.body))).toEqual({ suspended: true });

    await user.click(row.getByRole('button', { name: 'Change due date for this Job.' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Change timer due date' }));
    expect(dialog.getByRole('button', { name: 'Change' })).toBeDisabled();
    await user.click(dialog.getByRole('radio', { name: 'Set a specific date' }));
    const date = dialog.getByRole('textbox', { name: 'Schedule at' });
    await user.clear(date);
    await user.type(date, '2026-12-01T10:00');
    await user.click(dialog.getByRole('button', { name: 'Change' }));
    expect(await screen.findByText('Due date was set successfully.')).toBeInTheDocument();
    const dueDate = fetchMock.mock.calls.find(([url]) => url.endsWith('/job/job-1/duedate'));
    expect(JSON.parse(String(dueDate?.[1]?.body))).toEqual({ duedate: toEngineDate(new Date(2026, 11, 1, 10, 0)), cascade: true });
  });

  it('lists the external tasks of the selected activities', async () => {
    const fetchMock = fakeBackend();
    renderApp('/app/react/cockpit/default/process-instance/pi-1?tab=external-tasks-process-instance-runtime&activityIds=prepareTransfer');
    await logIn();

    expect(await screen.findByText('worker-1')).toBeInTheDocument();
    const query = fetchMock.mock.calls.find(([url, init]) => url.startsWith(`${ENGINE}/external-task?`) && init?.method === 'POST');
    expect(JSON.parse(String(query?.[1]?.body))).toEqual({
      processInstanceId: 'pi-1',
      activityIdIn: ['prepareTransfer'],
      sortBy: 'taskPriority',
      sortOrder: 'asc',
    });
  });
});

describe('cockpit process instance bulk retry', () => {
  it('retries the selected failed jobs and reports each one', async () => {
    const fetchMock = fakeBackend();
    renderApp('/app/react/cockpit/default/process-instance/pi-1');
    const user = await logIn();

    await user.click(await screen.findByRole('button', { name: 'Increment Number of Retries of Failed Jobs' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Increment Number of Retries' }));
    // both fit on one page, so both start selected; the scope is the innermost activity instance of the job's execution
    expect(await dialog.findByRole('button', { name: 'Retry (2 jobs)' })).toBeEnabled();
    expect(dialog.getByText('Prepare Bank Transfer')).toBeInTheDocument();
    expect(dialog.getByText('Approve Invoice')).toBeInTheDocument();

    await user.click(dialog.getByRole('button', { name: 'Retry (2 jobs)' }));
    expect(await screen.findByText('Incrementing the number of retries finished with failures.')).toBeInTheDocument();
    const summary = within(await screen.findByRole('dialog', { name: 'Increment Number of Retries' }));
    expect(within(summary.getByText('failed-1').closest('tr')!).getByText('Successful')).toBeInTheDocument();
    expect(within(summary.getByText('failed-2').closest('tr')!).getByText('Failed')).toBeInTheDocument();
    const retried = fetchMock.mock.calls.find(([url]) => url.endsWith('/job/failed-1/retries'));
    expect(JSON.parse(String(retried?.[1]?.body))).toEqual({ retries: 1 });
  });
});

describe('cockpit with the settings of the classic config.js', () => {
  it('names the app, formats dates and leaves out the activity statistics', async () => {
    classicConfig.value = {
      app: { name: 'Operations', vendor: 'Company' },
      dateFormat: { normal: '[on] DD.MM.YYYY' },
      runtimeActivityInstanceMetrics: { display: false },
    };
    const fetchMock = fakeBackend();
    renderApp('/app/react/cockpit/default/process-definition/invoice:2');
    await logIn();

    expect(await screen.findByText('INV-1')).toBeInTheDocument();
    expect(screen.getByText('Company')).toBeInTheDocument();
    expect(screen.getByText('Operations')).toBeInTheDocument();
    expect(document.title).toBe('Company Operations');
    expect(screen.getByText('on 13.10.2026')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => url.startsWith(`${ENGINE}/process-definition/invoice%3A2/statistics`))).toBe(false);
  });

  it('starts the delete options as config.js says and hides those it hides', async () => {
    classicConfig.value = { skipCustomListeners: { default: false, hidden: true }, skipIoMappings: { default: true } };
    const fetchMock = fakeBackend();
    renderApp('/app/react/cockpit/default/process-instance/pi-1');
    const user = await logIn();

    await user.click(await screen.findByRole('button', { name: 'Delete Process Instance' }));
    const cancel = within(await screen.findByRole('dialog', { name: 'Delete running process instance' }));
    expect(cancel.queryByRole('checkbox', { name: 'Skip Custom Listeners' })).not.toBeInTheDocument();
    expect(cancel.getByRole('checkbox', { name: 'Skip IO Mappings' })).toBeChecked();
    await user.click(cancel.getByRole('button', { name: 'Delete Process Instance' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url, init]) => url.startsWith(`${ENGINE}/process-instance/pi-1?`) && init?.method === 'DELETE')).toBe(true),
    );
    const deleted = fetchMock.mock.calls.find(([url, init]) => url.startsWith(`${ENGINE}/process-instance/pi-1?`) && init?.method === 'DELETE');
    expect(deleted?.[0]).toContain('skipCustomListeners=false&skipIoMappings=true');
  });
});
