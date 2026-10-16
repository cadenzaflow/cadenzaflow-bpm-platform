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
    if (url !== '/api/welcome/plugin/demo/static/app/plugin.js') {
      throw new Error(`unexpected ${url}`);
    }
    return {
      default: [
        plugin('demo-dashboard', 'welcome.dashboard'),
        plugin('demo-profile', 'welcome.profile'),
        plugin('demo-page', 'welcome.route', { properties: { path: '/demo-page' } }),
      ],
    };
  },
}));

function fakeBackend() {
  let loggedIn = false;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET';
      const [path] = url.split('?');
      if (path === '/api/admin/auth/user/default') {
        return loggedIn ? json({ userId: 'demo', authorizedApps: ['welcome'] }) : json({}, 404);
      }
      if (path === '/api/admin/auth/user/default/login/welcome' && method === 'POST') {
        loggedIn = true;
        return json({ userId: 'demo', authorizedApps: ['welcome'] });
      }
      if (path === `${ENGINE}/user/demo/profile`) {
        return json({ id: 'demo', firstName: 'Demo', lastName: 'Demo' });
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
  list.textContent = JSON.stringify({ welcome: [{ id: 'demo', location: '/api/welcome/plugin/demo/static/app' }] });
  document.body.appendChild(list);
});
afterEach(() => {
  document.getElementById('cadenzaflow-plugins')?.remove();
  vi.unstubAllGlobals();
});

describe('welcome plugins', () => {
  it('shows plugins below the applications and below the profile', async () => {
    fakeBackend();
    renderApp('/app/react/welcome/default/');
    await logIn();

    expect(await screen.findByText(`demo-dashboard {} ${ENGINE}`)).toBeInTheDocument();
    expect(screen.getByText(`demo-profile {} ${ENGINE}`)).toBeInTheDocument();
  });

  it('shows the page of a route plugin at its classic path', async () => {
    fakeBackend();
    renderApp('/app/react/welcome/default/#/demo-page');
    await logIn();

    expect(await screen.findByText(`demo-page {} ${ENGINE}`)).toBeInTheDocument();
    expect(screen.queryByText(`demo-dashboard {} ${ENGINE}`)).not.toBeInTheDocument();
  });
});
