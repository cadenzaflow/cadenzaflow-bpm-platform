import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { createQueryClient } from '../../app/query-client';
import { createAppRouter } from '../../app/router';
import { initI18n } from '../../shared/i18n';
import { json, logIn, renderApp } from '../../test/app';

const ENGINE = '/api/engine/engine/default';
const COCKPIT = '/app/react/cockpit/default';

const pageUnmount = vi.hoisted(() => vi.fn());

// a route plugin and an action on the page of a process instance, which tells what it got
vi.mock('../../shared/plugins/import-plugin', () => ({
  importPlugin: async () => ({
    default: [
      {
        id: 'demo-page',
        pluginPoint: 'cockpit.route',
        properties: { path: '/demo-page' },
        render: (node: HTMLElement) => {
          node.textContent = 'demo-page';
        },
        unmount: pageUnmount,
      },
      {
        id: 'demo-action',
        pluginPoint: 'cockpit.processInstance.runtime.action',
        render: (node: HTMLElement, { processInstanceId }: { processInstanceId: string }) => {
          node.textContent = `action of ${processInstanceId}`;
        },
      },
    ],
  }),
}));

vi.mock('../../shared/diagram/BpmnDiagram', () => ({ default: () => <div /> }));

/** A server with the process instances pi-1 and pi-2; the session can end. */
function fakeBackend() {
  let loggedIn = false;
  let sessionEnded = false;
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
        sessionEnded = !loggedIn;
        return loggedIn ? json({ userId: 'demo', authorizedApps: ['cockpit'] }) : json({}, 401);
      }
      if (sessionEnded) {
        return json({ message: 'not authenticated' }, 401);
      }
      if (path === `${ENGINE}/user/demo/profile`) {
        return json({ id: 'demo', firstName: 'Demo', lastName: 'Demo' });
      }
      const instance = /^\/api\/engine\/engine\/default\/process-instance\/(pi-\d)(\/activity-instances)?$/.exec(path);
      if (instance && !instance[2]) {
        return json({ id: instance[1], definitionId: 'invoice:2', businessKey: null, suspended: false, ended: false, tenantId: null });
      }
      if (instance) {
        return json({ id: instance[1], activityId: 'invoice:2', activityName: 'Invoice', activityType: 'processDefinition', executionIds: [instance[1]] });
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
      // the rest of the pages is not under test
      return json({ message: `not in this test: ${method} ${url}` }, 404);
    }),
  );
  return {
    /** The session ends (timeout, logout in another tab): the server answers 401. */
    endSession: () => {
      loggedIn = false;
      sessionEnded = true;
    },
  };
}

/** Renders the app with the browser's own history, as it runs in the browser. */
function renderInBrowser(url: string) {
  window.history.replaceState(null, '', url);
  render(
    <QueryClientProvider client={createQueryClient()}>
      <RouterProvider router={createAppRouter()} />
    </QueryClientProvider>,
  );
}

const sections = async () => within(await screen.findByRole('navigation', { name: 'Cockpit sections' }));

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
  pageUnmount.mockClear();
  window.history.replaceState(null, '', '/');
});

describe('moving between the pages of the cockpit', () => {
  it('marks Processes on the pages of a process definition or instance and Decisions on those of a decision, as the classic Cockpit', async () => {
    fakeBackend();
    const history = renderApp(`${COCKPIT}/process-instance/pi-1`);
    await logIn();

    const navigation = await sections();
    await waitFor(() => expect(navigation.getByRole('link', { name: 'Processes' })).toHaveAttribute('aria-current', 'page'));
    expect(navigation.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
    expect(navigation.getByRole('link', { name: 'Decisions' })).not.toHaveAttribute('aria-current');

    history.push(`${COCKPIT}/process-definition/invoice%3A2`);
    await waitFor(() => expect(navigation.getByRole('link', { name: 'Processes' })).toHaveAttribute('aria-current', 'page'));

    history.push(`${COCKPIT}/decision-instance/di-1`);
    await waitFor(() => expect(navigation.getByRole('link', { name: 'Decisions' })).toHaveAttribute('aria-current', 'page'));
    expect(navigation.getByRole('link', { name: 'Processes' })).not.toHaveAttribute('aria-current');

    history.push(`${COCKPIT}/decision-definition/dd-1`);
    await waitFor(() => expect(navigation.getByRole('link', { name: 'Decisions' })).toHaveAttribute('aria-current', 'page'));

    // the page of a route plugin is none of the sections
    history.push(`${COCKPIT}/#/demo-page`);
    expect(await screen.findByText('demo-page')).toBeInTheDocument();
    for (const name of ['Dashboard', 'Processes', 'Decisions']) {
      expect(navigation.getByRole('link', { name })).not.toHaveAttribute('aria-current');
    }
  });

  it('leaves the page of a route plugin through the section navigation', async () => {
    fakeBackend();
    const history = renderApp(`${COCKPIT}/#/demo-page`);
    const user = await logIn();
    expect(await screen.findByText('demo-page')).toBeInTheDocument();

    await user.click((await sections()).getByRole('link', { name: 'Processes' }));

    await waitFor(() => expect(history.location.pathname).toBe(`${COCKPIT}/processes`));
    expect(history.location.hash).toBe('');
    expect(screen.queryByText('demo-page')).not.toBeInTheDocument();
    expect(pageUnmount).toHaveBeenCalled();
    expect((await sections()).getByRole('link', { name: 'Processes' })).toHaveAttribute('aria-current', 'page');
  });

  it('follows a plugin that opens a page through the browser history, and the back and forward buttons', async () => {
    fakeBackend();
    renderInBrowser(`${COCKPIT}/#/demo-page`);
    await logIn();
    expect(await screen.findByText('demo-page')).toBeInTheDocument();

    // what a plugin does to open a page of the app without loading it again
    act(() => {
      window.history.pushState(null, '', `${COCKPIT}/process-instance/pi-1`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(await screen.findByText('action of pi-1')).toBeInTheDocument();
    expect(screen.queryByText('demo-page')).not.toBeInTheDocument();
    expect(pageUnmount).toHaveBeenCalled();

    // and to open the page of a route plugin
    act(() => {
      window.history.pushState(null, '', `${COCKPIT}/#/demo-page`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(await screen.findByText('demo-page')).toBeInTheDocument();

    act(() => window.history.back());
    expect(await screen.findByText('action of pi-1')).toBeInTheDocument();
    act(() => window.history.back());
    expect(await screen.findByText('demo-page')).toBeInTheDocument();
    act(() => window.history.forward());
    expect(await screen.findByText('action of pi-1')).toBeInTheDocument();
  });

  it('shows the login page when the session has ended, and the page the user wanted after logging in again', async () => {
    const backend = fakeBackend();
    const history = renderApp(`${COCKPIT}/process-instance/pi-1`);
    await logIn();
    expect(await screen.findByText('action of pi-1')).toBeInTheDocument();

    backend.endSession();
    history.push(`${COCKPIT}/process-instance/pi-2`);

    expect(await screen.findByLabelText('Username')).toBeInTheDocument();
    await logIn();
    expect(await screen.findByText('action of pi-2')).toBeInTheDocument();
    expect(history.location.pathname).toBe(`${COCKPIT}/process-instance/pi-2`);
  });
});
