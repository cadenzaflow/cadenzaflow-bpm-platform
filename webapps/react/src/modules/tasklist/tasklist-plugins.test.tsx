import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { initI18n } from '../../shared/i18n';
import { json, logIn, renderApp } from '../../test/app';

const ENGINE = '/api/engine/engine/default';

/** A plugin that writes what it got into its node. */
const plugin = (id: string, pluginPoint: string, extra: Record<string, unknown> = {}) => ({
  id,
  pluginPoint,
  ...extra,
  render: (node: HTMLElement, props: Record<string, unknown>) => {
    const { api, ...ids } = props as { api: { engineApi: string } };
    node.textContent = `${id} ${JSON.stringify(ids)} ${api.engineApi}`;
  },
});

// the plugin modules the server would deliver
vi.mock('../../shared/plugins/import-plugin', () => ({
  importPlugin: async (url: string) => {
    if (url !== '/api/tasklist/plugin/demo/static/app/plugin.js') {
      throw new Error(`unexpected ${url}`);
    }
    return {
      default: [
        plugin('demo-navbar', 'tasklist.navbar.action'),
        plugin('demo-header', 'tasklist.header'),
        plugin('demo-list', 'tasklist.list'),
        plugin('demo-card', 'tasklist.card'),
        plugin('demo-action', 'tasklist.task.action'),
        plugin('demo-tab', 'tasklist.task.detail', { label: 'Demo Tab' }),
        plugin('demo-page', 'tasklist.route', { properties: { path: '/demo-page' } }),
      ],
    };
  },
}));

const task = {
  id: 't1',
  name: 'Approve Invoice',
  assignee: null,
  created: '2026-10-13T08:49:55.851+0000',
  processDefinitionId: 'invoice:1',
  priority: 50,
  taskDefinitionKey: 'approveInvoice',
};
const invoice = { id: 'invoice:1', key: 'invoice', name: 'Invoice Receipt', version: 1 };

function fakeBackend() {
  let loggedIn = false;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET';
      const [path] = url.split('?');
      if (path === '/api/admin/auth/user/default') {
        return loggedIn ? json({ userId: 'demo', authorizedApps: ['tasklist'] }) : json({}, 404);
      }
      if (path === '/api/admin/auth/user/default/login/tasklist' && method === 'POST') {
        loggedIn = true;
        return json({ userId: 'demo', authorizedApps: ['tasklist'] });
      }
      if (path === `${ENGINE}/user/demo/profile`) {
        return json({ id: 'demo', firstName: 'Demo', lastName: 'Demo' });
      }
      if (path === `${ENGINE}/filter`) {
        return json([{ id: 'f1', name: 'My tasks', properties: {}, itemCount: 1 }]);
      }
      if (path === `${ENGINE}/filter/f1/list` && method === 'POST') {
        return json({ count: 1, _embedded: { task: [task], processDefinition: [invoice] } });
      }
      if (path === `${ENGINE}/task/t1`) {
        return json({ ...task, _embedded: { processDefinition: [invoice], user: [] } });
      }
      // the rest of the page is not under test
      return json({ message: `not in this test: ${method} ${url}` }, 404);
    }),
  );
}

beforeAll(() => initI18n('en'));
beforeEach(() => {
  const list = document.createElement('script');
  list.type = 'application/json';
  list.id = 'cadenzaflow-plugins';
  list.textContent = JSON.stringify({ tasklist: [{ id: 'demo', location: '/api/tasklist/plugin/demo/static/app' }] });
  document.body.appendChild(list);
});
afterEach(() => {
  document.getElementById('cadenzaflow-plugins')?.remove();
  vi.unstubAllGlobals();
});

describe('tasklist plugins', () => {
  it('shows plugins in the actions, above and in the task list, and at the task', async () => {
    fakeBackend();
    renderApp('/app/react/tasklist/default?filter=f1&task=t1&detailsTab=demo-tab');
    await logIn();

    expect(await screen.findByText(`demo-navbar {} ${ENGINE}`)).toBeInTheDocument();
    expect(screen.getByText(`demo-header {} ${ENGINE}`)).toBeInTheDocument();
    expect(screen.getByText(`demo-list {} ${ENGINE}`)).toBeInTheDocument();
    expect(await screen.findByText(`demo-card {"taskId":"t1"} ${ENGINE}`)).toBeInTheDocument();
    // the task: its actions, and the plugin's tab after the built-in tabs
    expect(await screen.findByText(`demo-action {"taskId":"t1"} ${ENGINE}`)).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent);
    expect(tabs.at(-1)).toBe('Demo Tab');
    expect(screen.getByRole('tab', { name: 'Demo Tab', selected: true })).toBeInTheDocument();
    expect(screen.getByText(`demo-tab {"taskId":"t1"} ${ENGINE}`)).toBeInTheDocument();
  });

  it('shows the page of a route plugin at its classic path', async () => {
    fakeBackend();
    renderApp('/app/react/tasklist/default#/demo-page');
    await logIn();

    expect(await screen.findByText(`demo-page {} ${ENGINE}`)).toBeInTheDocument();
    expect(screen.queryByText('My tasks')).not.toBeInTheDocument();
  });
});
