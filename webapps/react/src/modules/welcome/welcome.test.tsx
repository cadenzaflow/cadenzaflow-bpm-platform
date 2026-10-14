import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { initI18n } from '../../shared/i18n';
import { json, logIn, renderApp } from '../../test/app';

const ENGINE = '/api/engine/engine/default';

// the links an operator configured in the classic welcome/scripts/config.js
const classicConfig = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('../../shared/classic-config', () => ({ importClassicConfig: async () => classicConfig.value }));

function fakeBackend() {
  let loggedIn = false;
  let firstName = 'Demo';
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const [path, queryString] = url.split('?');
    const query = new URLSearchParams(queryString);
    if (path === '/api/admin/auth/user/default') {
      return loggedIn ? json({ userId: 'demo', authorizedApps: ['cockpit', 'tasklist', 'welcome'] }) : json({}, 404);
    }
    if (path === '/api/admin/auth/user/default/login/welcome' && method === 'POST') {
      loggedIn = true;
      return json({ userId: 'demo', authorizedApps: ['cockpit', 'tasklist', 'welcome'] });
    }
    if (path === `${ENGINE}/user/demo/profile` && method === 'GET') {
      return json({ id: 'demo', firstName, lastName: 'User', email: 'demo@example.org' });
    }
    if (path === `${ENGINE}/user/demo/profile` && method === 'PUT') {
      firstName = JSON.parse(String(init.body)).firstName;
      return new Response(null, { status: 204 });
    }
    if (path === `${ENGINE}/user/demo/credentials` && method === 'PUT') {
      return new Response(null, { status: 204 });
    }
    if (path === `${ENGINE}/group/count` && query.get('member') === 'demo') {
      return json({ count: 1 });
    }
    if (path === `${ENGINE}/group` && query.get('member') === 'demo') {
      return json([{ id: 'accounting', name: 'Accounting' }]);
    }
    if (path === `${ENGINE}/identity/password-policy`) {
      // no policy configured
      return json({ message: 'no policy' }, 404);
    }
    return json({ message: `unexpected ${method} ${url}` }, 500);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeAll(() => initI18n('en'));
afterEach(() => {
  vi.unstubAllGlobals();
  classicConfig.value = {};
});

describe('welcome', () => {
  it('shows the applications the user may open, the configured links and the profile', async () => {
    classicConfig.value = { links: [{ label: 'Intranet', href: 'https://intranet.example.org', description: 'Company pages' }] };
    fakeBackend();
    renderApp('/app/react/welcome/default/');
    await logIn();

    const apps = within((await screen.findByRole('heading', { name: 'Applications' })).parentElement!);
    expect(apps.getByRole('link', { name: 'Cockpit' })).toHaveAttribute('href', '/app/react/cockpit/default/');
    expect(apps.getByRole('link', { name: 'Tasklist' })).toBeInTheDocument();
    // not authorized for the Admin
    expect(apps.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Intranet' })).toHaveAttribute('href', 'https://intranet.example.org');
    expect(screen.getByText('Company pages')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Demo User' })).toBeInTheDocument();
    expect(await screen.findByText('Accounting')).toBeInTheDocument();
  });

  it('links the documentation when no links are configured', async () => {
    fakeBackend();
    renderApp('/app/react/welcome/default/');
    await logIn();

    expect(await screen.findByRole('link', { name: 'Documentation' })).toHaveAttribute('href', 'https://docs.cadenzaflow.org/manual/latest/webapps/');
  });

  it('changes the profile and the password', async () => {
    const fetchMock = fakeBackend();
    const history = renderApp('/app/react/welcome/default/');
    const user = await logIn();

    await user.click(await screen.findByRole('button', { name: 'Edit profile' }));
    await waitFor(() => expect(history.location.search).toBe('?form=profile'));
    const firstName = screen.getByRole('textbox', { name: 'First name' });
    await user.clear(firstName);
    await user.type(firstName, 'Dana');
    await user.click(screen.getByRole('button', { name: 'Update' }));
    expect(await screen.findByText('Changes saved')).toBeInTheDocument();
    const profile = fetchMock.mock.calls.find(([url, init]) => url.endsWith('/user/demo/profile') && init?.method === 'PUT');
    expect(JSON.parse(String(profile?.[1]?.body))).toEqual({ id: 'demo', firstName: 'Dana', lastName: 'User', email: 'demo@example.org' });
    // the new name, also in the header
    expect(await screen.findByRole('heading', { name: 'Dana User' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Change password' }));
    const form = within(screen.getByRole('heading', { name: 'Change your password' }).closest('form')!);
    await user.type(form.getByLabelText('Current password'), 'old-test-secret');
    await user.type(form.getByLabelText('New password'), 'new-test-secret');
    await user.type(form.getByLabelText('Confirm new password'), 'new-test-secret');
    await user.click(form.getByRole('button', { name: 'Change password' }));
    expect(await screen.findByText('Password changed')).toBeInTheDocument();
    const credentials = fetchMock.mock.calls.find(([url]) => url.endsWith('/user/demo/credentials'));
    expect(JSON.parse(String(credentials?.[1]?.body))).toEqual({ password: 'new-test-secret', authenticatedUserPassword: 'old-test-secret' });
  });
});
