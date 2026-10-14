import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { initI18n } from '../../../shared/i18n';
import { json, logIn, renderApp } from '../../../test/app';
import { progressOf, validateBatchesSearch } from './search';

const ENGINE = '/api/engine/engine/default';

const running = {
  id: 'batch-1',
  type: 'instance-deletion',
  totalJobs: 4,
  batchJobsPerSeed: 100,
  invocationsPerBatchJob: 1,
  seedJobDefinitionId: 'seed-1',
  monitorJobDefinitionId: 'monitor-1',
  batchJobDefinitionId: 'jobdef-1',
  suspended: false,
  tenantId: null,
  createUserId: 'demo',
  startTime: '2026-10-13T08:00:00.000+0000',
  executionStartTime: '2026-10-13T08:00:01.000+0000',
  remainingJobs: 1,
  completedJobs: 3,
  failedJobs: 1,
};

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
      return json({ id: 'demo', firstName: 'Demo', lastName: 'User' });
    }
    if (path === `${ENGINE}/user` && query.get('idIn') === 'demo') {
      return json([{ id: 'demo', firstName: 'Demo', lastName: 'User' }]);
    }
    if (path === `${ENGINE}/batch/statistics/count`) {
      return json({ count: 1 });
    }
    if (path === `${ENGINE}/batch/statistics`) {
      return json([running]);
    }
    if (path === `${ENGINE}/history/batch/count`) {
      return json({ count: 1 });
    }
    if (path === `${ENGINE}/history/batch`) {
      return json([{ id: 'batch-0', type: 'set-job-retries', startTime: '2026-10-12T08:00:00.000+0000', endTime: '2026-10-12T08:01:00.000+0000' }]);
    }
    if (path === `${ENGINE}/job/count` && method === 'POST') {
      return json({ count: 1 });
    }
    if (path === `${ENGINE}/job` && method === 'POST') {
      return json([{ id: 'job-1', exceptionMessage: 'Process instance does not exist' }]);
    }
    if (path === `${ENGINE}/history/job-log/count`) {
      return json({ count: 2 });
    }
    if (path === `${ENGINE}/history/job-log`) {
      return json([
        { id: 'log-2', timestamp: '2026-10-13T08:00:03.000+0000', jobId: 'job-1', jobExceptionMessage: 'Process instance does not exist', jobDefinitionType: 'instance-deletion', jobDefinitionConfiguration: null, jobRetries: 0, hostname: 'engine-1', jobPriority: 0, creationLog: false, failureLog: true, successLog: false, deletionLog: false },
        { id: 'log-1', timestamp: '2026-10-13T08:00:01.000+0000', jobId: 'job-1', jobExceptionMessage: null, jobDefinitionType: 'instance-deletion', jobDefinitionConfiguration: null, jobRetries: 3, hostname: 'engine-1', jobPriority: 0, creationLog: true, failureLog: false, successLog: false, deletionLog: false },
      ]);
    }
    if ((path === `${ENGINE}/job/job-1/retries` || path === `${ENGINE}/job-definition/jobdef-1/retries`) && method === 'PUT') {
      return new Response(null, { status: 204 });
    }
    if (path === `${ENGINE}/batch/batch-1` && method === 'DELETE') {
      return new Response(null, { status: 204 });
    }
    return json({ message: `unexpected ${method} ${url}` }, 500);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeAll(() => initI18n('en'));
afterEach(() => vi.unstubAllGlobals());

describe('batches', () => {
  it('computes the progress once a job completed', () => {
    expect(progressOf({ completedJobs: 3, remainingJobs: 1 })).toBe(75);
    expect(progressOf({ completedJobs: 0, remainingJobs: 4 })).toBeUndefined();
    expect(validateBatchesSearch({ details: 'b', type: 'history', page: 2 })).toEqual({ searchQuery: undefined, details: 'b', type: 'history' });
    expect(validateBatchesSearch({ type: 'other' }).type).toBeUndefined();
  });

  it('lists running and ended batches and shows a running one with its failed jobs', async () => {
    const fetchMock = fakeBackend();
    const history = renderApp('/app/react/cockpit/default/batch');
    const user = await logIn();

    const row = within((await screen.findByRole('button', { name: 'batch-1' })).closest('tr')!);
    expect(await row.findByText('Demo User')).toBeInTheDocument();
    expect(row.getByText('75%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'batch-0' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'batch-1' }));
    await waitFor(() => expect(history.location.search).toBe('?details=batch-1&type=runtime'));
    expect(await screen.findByText('In Progress Batch Details')).toBeInTheDocument();
    expect(screen.getByText('1 (Failed 1)')).toBeInTheDocument();
    const failed = within((await screen.findByText('Process instance does not exist')).closest('tr')!);
    const jobs = fetchMock.mock.calls.find(([url, init]) => url.startsWith(`${ENGINE}/job?`) && init?.method === 'POST');
    expect(JSON.parse(String(jobs?.[1]?.body))).toEqual({
      jobDefinitionId: 'jobdef-1',
      withException: true,
      noRetriesLeft: true,
      sortBy: 'jobId',
      sortOrder: 'asc',
    });

    await user.click(failed.getByRole('button', { name: 'Increment Number of Retries for this Job' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url, init]) => url.endsWith('/job/job-1/retries') && init?.method === 'PUT')).toBe(true));

    await user.click(failed.getByRole('button', { name: 'Show full Log for this Job' }));
    const log = within(await screen.findByRole('dialog', { name: 'Job Log' }));
    expect(await log.findByText('Failed')).toBeInTheDocument();
    expect(log.getByText('Created')).toBeInTheDocument();
    expect(log.getByRole('link', { name: 'Process instance does not exist' })).toHaveAttribute('href', `${ENGINE}/history/job-log/log-2/stacktrace`);
  });

  it('deletes a running batch with its history', async () => {
    const fetchMock = fakeBackend();
    const history = renderApp('/app/react/cockpit/default/batch?details=batch-1&type=runtime');
    const user = await logIn();

    await user.click(await screen.findByRole('button', { name: 'Delete this Batch' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Delete Batch' }));
    await user.click(dialog.getByRole('radio', { name: 'Delete the historic batch and historic job logs, too' }));
    await user.click(dialog.getByRole('button', { name: 'Delete Batch' }));
    await waitFor(() => expect(history.location.search).toBe(''));
    const deleted = fetchMock.mock.calls.find(([url, init]) => url.startsWith(`${ENGINE}/batch/batch-1`) && init?.method === 'DELETE');
    expect(deleted?.[0]).toContain('cascade=true');
  });
});
