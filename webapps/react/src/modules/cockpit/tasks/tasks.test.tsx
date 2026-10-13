import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { initI18n } from '../../../shared/i18n';
import { json, logIn, renderApp } from '../../../test/app';

const ENGINE = '/api/engine/engine/default';

function fakeBackend() {
  let loggedIn = false;
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const [path] = url.split('?');
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
    if (path === `${ENGINE}/history/task/count` && method === 'POST') {
      const query = JSON.parse(String(init.body));
      return json({ count: query.assigned ? 9 : query.withCandidateGroups ? 4 : query.withoutCandidateGroups ? 1 : 14 });
    }
    if (path === `${ENGINE}/task/report/candidate-group-count`) {
      return json([
        { groupName: null, taskCount: 1 },
        { groupName: 'accounting', taskCount: 4 },
        { groupName: 'sales', taskCount: 1 },
      ]);
    }
    if (path === `${ENGINE}/group` && method === 'POST') {
      // only the accounting group may be read
      return json([{ id: 'accounting', name: 'Accounting' }]);
    }
    return json({ message: `unexpected ${method} ${url}` }, 500);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeAll(() => initI18n('en'));
afterEach(() => vi.unstubAllGlobals());

describe('cockpit human tasks', () => {
  it('counts the open tasks by assignment and by group', async () => {
    const fetchMock = fakeBackend();
    renderApp('/app/react/cockpit/default/tasks');
    await logIn();

    const byType = within((await screen.findByRole('heading', { name: 'Assignments by type' })).parentElement!);
    expect(await byType.findByText('9')).toBeInTheDocument();
    expect(within(byType.getByText('Total').closest('tr')!).getByText('14')).toBeInTheDocument();
    expect(within(byType.getByText('unassigned').closest('tr')!).getByText('1')).toBeInTheDocument();
    const bodies = fetchMock.mock.calls.filter(([url]) => url.startsWith(`${ENGINE}/history/task/count`)).map(([, init]) => JSON.parse(String(init?.body)));
    expect(bodies).toContainEqual({ unfinished: true, unassigned: true, withCandidateGroups: true });

    const byGroup = within(screen.getByRole('heading', { name: 'Assignments by group' }).parentElement!);
    expect(await byGroup.findByText('Accounting')).toBeInTheDocument();
    // without READ permission the id
    expect(byGroup.getByText('sales')).toBeInTheDocument();
    expect(byGroup.getByText('without group')).toBeInTheDocument();
    const groups = fetchMock.mock.calls.find(([url]) => url.startsWith(`${ENGINE}/group?`));
    expect(JSON.parse(String(groups?.[1]?.body))).toEqual({ idIn: ['accounting', 'sales'] });
  });
});
