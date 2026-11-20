import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { initI18n } from '../../../shared/i18n';
import { json, logIn, renderApp } from '../../../test/app';

const ENGINE = '/api/engine/engine/default';
const invoice = { id: 'invoice:1', key: 'invoice', name: 'Invoice Receipt', version: 1, tenantId: null };

/** A backend with one startable process that has no start form. */
function fakeBackend() {
  let loggedIn = false;
  const started: unknown[] = [];
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
        return json([{ id: 'f1', name: 'My tasks', properties: {}, itemCount: 0 }]);
      }
      if (path === `${ENGINE}/filter/f1/list` && method === 'POST') {
        return json({ count: 0, _embedded: { task: [] } });
      }
      if (path === `${ENGINE}/process-definition`) {
        return json([invoice]);
      }
      if (path === `${ENGINE}/process-definition/count`) {
        return json({ count: 1 });
      }
      if (path === `${ENGINE}/process-definition/invoice%3A1/startForm`) {
        return json({ key: null, contextPath: null });
      }
      if (path === `${ENGINE}/process-definition/invoice%3A1/submit-form` && method === 'POST') {
        started.push(JSON.parse(String(init.body)));
        return json({ id: 'pi1' });
      }
      if (path === `${ENGINE}/task`) {
        return json([]);
      }
      // the rest of the page is not under test
      return json({ message: `not in this test: ${method} ${url}` }, 404);
    }),
  );
  return started;
}

beforeAll(() => initI18n('en'));
afterEach(() => vi.unstubAllGlobals());

describe('start process dialog', () => {
  it('offers the process list again after a process was started', async () => {
    const started = fakeBackend();
    renderApp('/app/react/tasklist/default?filter=f1');
    const user = await logIn();

    await user.click(await screen.findByRole('button', { name: 'Start process' }));
    await user.click(await screen.findByText('Invoice Receipt'));
    await user.type(await screen.findByLabelText('Business Key'), 'order-1');
    await user.click(screen.getByRole('button', { name: 'Start' }));
    expect(await screen.findByText('The process has been started.')).toBeInTheDocument();
    expect(started).toEqual([{ variables: {}, businessKey: 'order-1' }]);

    // the dialog starts over: no form of the process just started, none of its input
    await user.click(screen.getByRole('button', { name: 'Start process' }));
    expect(await screen.findByText('Click on the process to start.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Business Key')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('order-1')).not.toBeInTheDocument();
  });

  it('offers the process list again after the dialog was closed with a form open', async () => {
    const started = fakeBackend();
    renderApp('/app/react/tasklist/default?filter=f1');
    const user = await logIn();

    await user.click(await screen.findByRole('button', { name: 'Start process' }));
    await user.click(await screen.findByText('Invoice Receipt'));
    await user.type(await screen.findByLabelText('Business Key'), 'order-2');
    await user.click(screen.getByRole('button', { name: 'Close' }));

    await user.click(screen.getByRole('button', { name: 'Start process' }));
    expect(await screen.findByText('Click on the process to start.')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('order-2')).not.toBeInTheDocument();
    expect(started).toEqual([]);
  });
});
