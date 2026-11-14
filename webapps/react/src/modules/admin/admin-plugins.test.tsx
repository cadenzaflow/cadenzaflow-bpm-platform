import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
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
    if (url !== '/api/admin/plugin/demo/static/app/plugin.js') {
      throw new Error(`unexpected ${url}`);
    }
    return {
      default: [
        plugin('demo-section', 'admin.dashboard.section', { label: 'Demo Section' }),
        plugin('demo-system', 'admin.system', { label: 'Demo System' }),
        plugin('demo-page', 'admin.route', { properties: { path: '/demo-page' } }),
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
        return loggedIn ? json({ userId: 'demo', authorizedApps: ['admin'] }) : json({}, 404);
      }
      if (path === '/api/admin/auth/user/default/login/admin' && method === 'POST') {
        loggedIn = true;
        return json({ userId: 'demo', authorizedApps: ['admin'] });
      }
      if (path === `${ENGINE}/user/demo/profile`) {
        return json({ id: 'demo', firstName: 'Demo', lastName: 'Demo' });
      }
      if (method === 'OPTIONS' && [`${ENGINE}/user`, `${ENGINE}/group`, `${ENGINE}/tenant`].includes(path)) {
        return json({ links: [{ rel: 'list' }, { rel: 'count' }, { rel: 'create' }] });
      }
      if (path === `${ENGINE}/authorization/check`) {
        return json({ authorized: true });
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
  list.textContent = JSON.stringify({ admin: [{ id: 'demo', location: '/api/admin/plugin/demo/static/app' }] });
  document.body.appendChild(list);
});
afterEach(() => {
  document.getElementById('cadenzaflow-plugins')?.remove();
  vi.unstubAllGlobals();
});

describe('admin plugins', () => {
  it('shows the sections of plugins on the dashboard, and their system sections in its system section', async () => {
    fakeBackend();
    renderApp('/app/react/admin/default/');
    await logIn();

    expect(await screen.findByRole('heading', { name: 'Demo Section' })).toBeInTheDocument();
    expect(screen.getByText(`demo-section {} ${ENGINE}`)).toBeInTheDocument();
    const system = screen.getByRole('heading', { name: 'System' }).closest('.cz-admin-dashboard__section') as HTMLElement;
    expect(within(system).getByRole('link', { name: 'Demo System' })).toHaveAttribute('href', expect.stringContaining('section=demo-system'));
  });

  it('shows the system sections of plugins after the built-in ones', async () => {
    fakeBackend();
    renderApp('/app/react/admin/default/system?section=demo-system');
    await logIn();

    expect(await screen.findByText(`demo-system {} ${ENGINE}`)).toBeInTheDocument();
    const sections = within(screen.getByRole('navigation', { name: 'System Settings' })).getAllByRole('link');
    expect(sections.at(-1)).toHaveTextContent('Demo System');
    expect(sections.at(-1)).toHaveAttribute('aria-current', 'page');
  });

  it('shows the page of a route plugin at its classic path', async () => {
    fakeBackend();
    renderApp('/app/react/admin/default/#/demo-page');
    await logIn();

    expect(await screen.findByText(`demo-page {} ${ENGINE}`)).toBeInTheDocument();
  });
});
