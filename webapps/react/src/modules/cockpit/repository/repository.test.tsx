import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { initI18n } from '../../../shared/i18n';
import { json, logIn, renderApp } from '../../../test/app';
import { resourceType } from './api';
import { commonPath } from './search';

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
    if (path === `${ENGINE}/deployment/count`) {
      return json({ count: 2 });
    }
    if (path === `${ENGINE}/deployment`) {
      return json([
        { id: 'dep-1', name: 'invoice', deploymentTime: '2026-10-13T08:00:00.000+0000', source: 'process application', tenantId: null },
        { id: 'dep-2', name: null, deploymentTime: '2026-10-12T08:00:00.000+0000', source: null, tenantId: null },
      ]);
    }
    if (path === `${ENGINE}/deployment/dep-1/resources`) {
      return json([
        { id: 'res-1', name: 'process/invoice.bpmn', deploymentId: 'dep-1' },
        { id: 'res-2', name: 'process/readme.txt', deploymentId: 'dep-1' },
      ]);
    }
    if (path === `${ENGINE}/deployment/dep-1/resources/res-2/data`) {
      return new Response('Hello from the deployment', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    if (path === `${ENGINE}/process-instance/count` && method === 'POST') {
      return json({ count: 3 });
    }
    if (path === `${ENGINE}/case-instance/count`) {
      // no case engine
      return json({ message: 'not found' }, 404);
    }
    if (path === `${ENGINE}/deployment/dep-1` && method === 'DELETE') {
      return new Response(null, { status: 204 });
    }
    return json({ message: `unexpected ${method} ${url}` }, 500);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeAll(() => initI18n('en'));
afterEach(() => vi.unstubAllGlobals());

describe('deployment resources', () => {
  it('knows the kind of a resource by its name', () => {
    expect(resourceType('invoice.bpmn')).toBe('bpmn');
    expect(resourceType('diagrams/order.bpmn20.xml')).toBe('bpmn');
    expect(resourceType('decisions.DMN')).toBe('dmn');
    expect(resourceType('case.cmmn11.xml')).toBe('cmmn');
    expect(resourceType('logo.PNG')).toBe('image');
    expect(resourceType('forms/start.form')).toBe('form');
    expect(resourceType('forms/start.html')).toBe('html');
    expect(resourceType('script.groovy')).toBe('other');
  });

  it('finds the path the resources share', () => {
    expect(commonPath(['a/b/one.bpmn', 'a/b/c/two.dmn'])).toBe('a/b/');
    expect(commonPath(['a/one.bpmn', 'b/two.dmn'])).toBe('');
    expect(commonPath(['one.bpmn'])).toBe('');
  });
});

describe('cockpit deployments', () => {
  it('shows the first deployment, its resources and a resource as text', async () => {
    fakeBackend();
    renderApp('/app/react/cockpit/default/repository');
    const user = await logIn();

    const resources = await screen.findByRole('button', { name: 'readme.txt' });
    // the shared path is shown once, not on every resource
    expect(screen.queryByText('process/')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /invoice.*Time:/ })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: /dep-2/ })).toBeInTheDocument();

    await user.click(resources);
    expect(await screen.findByText('Hello from the deployment')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute('href', `${ENGINE}/deployment/dep-1/resources/res-2/data`);
  });

  it('deletes a deployment with instances only together with them', async () => {
    const fetchMock = fakeBackend();
    renderApp('/app/react/cockpit/default/repository');
    const user = await logIn();

    const item = (await screen.findByRole('button', { name: /invoice.*Time:/ })).closest('li')!;
    await user.click(within(item).getByRole('button', { name: 'Delete Deployment' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Delete Deployment: invoice' }));
    expect(await dialog.findByText(/There are 3 running process instances which belong to this deployment/)).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Delete' })).toBeDisabled();
    await user.click(dialog.getByRole('checkbox', { name: 'Cascade' }));
    await user.click(dialog.getByRole('button', { name: 'Delete' }));
    await waitFor(() => {
      const deleted = fetchMock.mock.calls.find(([url, init]) => url.startsWith(`${ENGINE}/deployment/dep-1?`) && init?.method === 'DELETE');
      expect(deleted?.[0]).toContain('cascade=true&skipCustomListeners=true&skipIoMappings=true');
    });
  });
});
