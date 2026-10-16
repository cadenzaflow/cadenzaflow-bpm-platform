import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffect, type ReactNode } from 'react';
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

const logout = vi.hoisted(() => vi.fn());
const loginResult = vi.hoisted(() => vi.fn());

// the plugin modules the server would deliver
vi.mock('../../shared/plugins/import-plugin', () => ({
  importPlugin: async (url: string) => {
    if (url !== '/api/cockpit/plugin/demo/static/app/plugin.js') {
      throw new Error(`unexpected ${url}`);
    }
    return {
      default: [
        plugin('demo-tab', 'cockpit.processInstance.runtime.tab', { label: 'Demo Tab' }),
        plugin('demo-action', 'cockpit.processInstance.runtime.action'),
        plugin('demo-nav', 'cockpit.navigation'),
        plugin('demo-page', 'cockpit.route', { properties: { path: '/demo-page' } }),
        plugin('demo-report', 'cockpit.report', { label: 'Demo' }),
        { id: 'demo-logout', pluginPoint: 'cockpit.logout', logout },
        plugin('demo-login', 'cockpit.login'),
        { id: 'demo-login-data', pluginPoint: 'cockpit.login.data', result: loginResult },
        plugin('demo-diagram-action', 'cockpit.processDefinition.diagram.action'),
      ],
    };
  },
}));

// bpmn-js does not draw in jsdom: a diagram that hands over a viewer and shows its actions
vi.mock('../../shared/diagram/BpmnDiagram', () => ({
  default: function FakeDiagram({ onViewer, actions }: { onViewer?: (viewer: unknown) => (() => void) | void; actions?: ReactNode }) {
    useEffect(() => onViewer?.({ viewer: 'bpmn-js' }) ?? undefined, [onViewer]);
    return <div>{actions}</div>;
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
        return loggedIn ? json({ userId: 'demo', authorizedApps: ['cockpit'] }) : json({}, 404);
      }
      if (path === '/api/admin/auth/user/default/login/cockpit' && method === 'POST') {
        loggedIn = new URLSearchParams(String(init.body)).get('password') === 'demo';
        return loggedIn ? json({ userId: 'demo', authorizedApps: ['cockpit'] }) : json({}, 401);
      }
      if (path === `${ENGINE}/user/demo/profile`) {
        return json({ id: 'demo', firstName: 'Demo', lastName: 'Demo' });
      }
      if (path === `${ENGINE}/process-instance/pi-1`) {
        return json({ id: 'pi-1', definitionId: 'invoice:2', businessKey: null, suspended: false, ended: false, tenantId: null });
      }
      if (path === `${ENGINE}/process-instance/pi-1/activity-instances`) {
        return json({ id: 'pi-1', activityId: 'invoice:2', activityName: 'Invoice', activityType: 'processDefinition', executionIds: ['pi-1'] });
      }
      if (path === `${ENGINE}/process-definition/invoice%3A2`) {
        return json({ id: 'invoice:2', key: 'invoice', name: 'Invoice', version: 2, deploymentId: 'd-1', resource: 'invoice.bpmn' });
      }
      if (path === `${ENGINE}/process-definition/invoice%3A2/xml`) {
        return json({ id: 'invoice:2', bpmn20Xml: '<definitions />' });
      }
      if (path === `${ENGINE}/process-instance`) {
        return json([]);
      }
      // no diagram in jsdom; the rest of the page is not under test
      return json({ message: `not in this test: ${method} ${url}` }, 404);
    }),
  );
}

beforeAll(() => initI18n('en'));
beforeEach(() => {
  const list = document.createElement('script');
  list.type = 'application/json';
  list.id = 'cadenzaflow-plugins';
  list.textContent = JSON.stringify({ cockpit: [{ id: 'demo', location: '/api/cockpit/plugin/demo/static/app' }] });
  document.body.appendChild(list);
});
afterEach(() => {
  document.getElementById('cadenzaflow-plugins')?.remove();
  vi.unstubAllGlobals();
});

describe('cockpit plugins', () => {
  it('shows tabs and actions of plugins on the process instance page', async () => {
    fakeBackend();
    renderApp('/app/react/cockpit/default/process-instance/pi-1?tab=demo-tab');
    await logIn();

    expect(await screen.findByRole('tab', { name: 'Demo Tab', selected: true })).toBeInTheDocument();
    expect(await screen.findByText(`demo-tab {"processInstanceId":"pi-1"} ${ENGINE}`)).toBeInTheDocument();
    expect(screen.getByText(`demo-action {"processInstanceId":"pi-1"} ${ENGINE}`)).toBeInTheDocument();
    // the plugin's entry in the navigation, and the reports of report plugins
    const navigation = within(screen.getByRole('navigation', { name: 'Cockpit sections' }));
    expect(navigation.getByText(`demo-nav {} ${ENGINE}`)).toBeInTheDocument();
    expect(navigation.getByRole('link', { name: 'Reports' })).toBeInTheDocument();
  });

  it('shows the page of a route plugin at its classic path', async () => {
    fakeBackend();
    renderApp('/app/react/cockpit/default/#/demo-page');
    await logIn();

    expect(await screen.findByText(`demo-page {} ${ENGINE}`)).toBeInTheDocument();
  });

  it('shows the reports of report plugins', async () => {
    fakeBackend();
    renderApp('/app/react/cockpit/default/reports');
    await logIn();

    expect(await screen.findByRole('heading', { name: 'Demo report' })).toBeInTheDocument();
    expect(screen.getByText(`demo-report {} ${ENGINE}`)).toBeInTheDocument();
  });

  it('logs out with a logout plugin instead of its own logout', async () => {
    fakeBackend();
    renderApp('/app/react/cockpit/default/reports');
    const user = await logIn();

    await user.click(await screen.findByRole('button', { name: 'Demo Demo' }));
    await user.click(screen.getByText('Log out'));

    expect(logout).toHaveBeenCalledWith({ api: expect.objectContaining({ engineApi: ENGINE }) });
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('/logout'))).toBe(false);
  });

  it('shows the actions of plugins on the process definition diagram, with the viewer', async () => {
    fakeBackend();
    renderApp('/app/react/cockpit/default/process-definition/invoice:2');
    await logIn();

    expect(
      await screen.findByText(`demo-diagram-action {"processDefinitionId":"invoice:2","viewer":{"viewer":"bpmn-js"}} ${ENGINE}`),
    ).toBeInTheDocument();
  });

  it('shows login plugins below the login form and hands them each login', async () => {
    loginResult.mockClear();
    fakeBackend();
    renderApp('/app/react/cockpit/default/');

    expect(await screen.findByText(`demo-login {} ${ENGINE}`)).toBeInTheDocument();
    // a failed login: the promise rejects
    await logIn('wrong');
    await expect(loginResult.mock.calls[0][0]).rejects.toBeDefined();
    // a successful one: the authentication as in the AngularJS webapps
    await logIn();
    const authentication = await loginResult.mock.calls[1][0];
    expect(authentication).toMatchObject({ name: 'demo', authorizedApps: ['cockpit'] });
    expect(authentication.canAccess('cockpit')).toBe(true);
    expect(authentication.canAccess('admin')).toBe(false);
  });
});
