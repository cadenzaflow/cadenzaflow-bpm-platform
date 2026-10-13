import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { initI18n } from '../../shared/i18n';
import { useNotifications } from '../../shared/notifications';
import { json, logIn, renderApp } from '../../test/app';
import { validateListSearch } from './search';

const ENGINE = '/api/engine/engine/default';

/** Users demo and mary, groups accounting (mary is a member) and sales; a password policy of 10 characters. */
function fakeBackend() {
  let loggedIn = false;
  const users = [
    { id: 'demo', firstName: 'Demo', lastName: 'Demo', email: 'demo@example.org' },
    { id: 'mary', firstName: 'Mary', lastName: 'Anne', email: 'mary@example.org' },
  ];
  const groups = [
    { id: 'accounting', name: 'Accounting', type: 'WORKFLOW' },
    { id: 'sales', name: 'Sales', type: 'WORKFLOW' },
  ];
  const tenants = [{ id: 'tenant-one', name: 'Tenant One' }];
  const authorizations = [
    { id: 'a1', type: 1, permissions: ['ALL'], userId: null, groupId: 'cadenzaflow-admin', resourceType: 0, resourceId: '*' },
    { id: 'a2', type: 1, permissions: ['ACCESS'], userId: 'demo', groupId: null, resourceType: 0, resourceId: 'tasklist' },
  ];
  const lengthRule = (valid?: boolean) => ({ placeholder: 'PASSWORD_POLICY_LENGTH', parameter: { minLength: '10' }, valid });

  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const [path, queryString] = url.split('?');
    const query = new URLSearchParams(queryString);
    const isJson = (init.headers as Record<string, string> | undefined)?.['Content-Type'] === 'application/json';
    const body = isJson ? JSON.parse(String(init.body)) : undefined;
    if (path === '/api/admin/auth/user/default') {
      return loggedIn ? json({ userId: 'demo', authorizedApps: ['admin', 'tasklist'] }) : json({}, 404);
    }
    if (path === '/api/admin/auth/user/default/login/admin' && method === 'POST') {
      loggedIn = true;
      return json({ userId: 'demo', authorizedApps: ['admin', 'tasklist'] });
    }
    if (method === 'OPTIONS' && [`${ENGINE}/user`, `${ENGINE}/group`, `${ENGINE}/tenant`].includes(path)) {
      return json({ links: [{ rel: 'list' }, { rel: 'count' }, { rel: 'create' }] });
    }
    // members of accounting: mary; the groups of tenant-one: accounting
    const members = query.get('memberOfGroup') === 'accounting' ? [users[1]] : [];
    if (path === `${ENGINE}/user/count`) {
      return json({ count: query.has('memberOfGroup') ? members.length : users.length });
    }
    if (path === `${ENGINE}/user` && query.has('memberOfGroup')) {
      return json(members);
    }
    if (path === `${ENGINE}/user`) {
      const sorted = [...users];
      if (query.get('sortBy') === 'firstName') {
        sorted.sort((a, b) => a.firstName.localeCompare(b.firstName) * (query.get('sortOrder') === 'desc' ? -1 : 1));
      }
      return json(sorted);
    }
    const profile = /^\/api\/engine\/engine\/default\/user\/(\w+)\/profile$/.exec(path);
    if (profile && method === 'GET') {
      const user = users.find((u) => u.id === profile[1]);
      return user ? json(user) : json({ message: 'not found' }, 404);
    }
    if (profile || path === `${ENGINE}/user/mary/credentials` || path === `${ENGINE}/user/create`) {
      return new Response(null, { status: 204 });
    }
    if (path === `${ENGINE}/authorization/check`) {
      return json({ authorized: true });
    }
    if (path === `${ENGINE}/authorization/count`) {
      return json({ count: query.get('resourceType') === '0' ? authorizations.length : 0 });
    }
    if (path === `${ENGINE}/authorization`) {
      return json(query.get('resourceType') === '0' ? authorizations : []);
    }
    if (path === `${ENGINE}/authorization/create`) {
      return json({ id: 'a3' });
    }
    if (path === `${ENGINE}/authorization/a2`) {
      return new Response(null, { status: 204 });
    }
    if (path === `${ENGINE}/identity/password-policy`) {
      return method === 'POST'
        ? json({ valid: body.password.length >= 10, rules: [lengthRule(body.password.length >= 10)] })
        : json({ rules: [lengthRule()] });
    }
    const filteredGroups = query.get('member') === 'mary' || query.get('memberOfTenant') === 'tenant-one' ? [groups[0]] : groups;
    if (path === `${ENGINE}/group/count`) {
      return json({ count: filteredGroups.length });
    }
    if (path === `${ENGINE}/group`) {
      return json(filteredGroups);
    }
    if (path === `${ENGINE}/group/accounting` && method === 'GET') {
      return json(groups[0]);
    }
    if (path === `${ENGINE}/tenant/count`) {
      return json({ count: query.has('groupMember') ? 0 : tenants.length });
    }
    if (path === `${ENGINE}/tenant`) {
      return json(query.has('groupMember') ? [] : tenants);
    }
    if (path === `${ENGINE}/tenant/tenant-one` && method === 'GET') {
      return json(tenants[0]);
    }
    if (
      (path === `${ENGINE}/group/sales/members/mary` && method === 'PUT') ||
      path === `${ENGINE}/group/create` ||
      path === `${ENGINE}/tenant/tenant-one/group-members/accounting` ||
      path === `${ENGINE}/tenant/tenant-one`
    ) {
      return new Response(null, { status: 204 });
    }
    return json({ message: `unexpected ${method} ${url}` }, 500);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const calls = (fetchMock: ReturnType<typeof fakeBackend>, method: string, path: string) =>
  fetchMock.mock.calls.filter(([url, init]) => (init?.method ?? 'GET') === method && url.split('?')[0] === `${ENGINE}${path}`);

beforeAll(() => initI18n('en'));
afterEach(() => {
  vi.unstubAllGlobals();
  useNotifications.setState({ notifications: [] });
});

describe('admin users', () => {
  it('lists users, sorts them and keeps the state in the URL', async () => {
    const fetchMock = fakeBackend();
    const history = renderApp('/app/react/admin/default/users');
    const user = await logIn();

    expect(await screen.findByRole('link', { name: 'mary' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /First Name/ }));

    await waitFor(() => expect(history.location.search).toContain('sortBy=firstName'));
    expect(calls(fetchMock, 'GET', '/user').some(([url]) => url.includes('sortBy=firstName&sortOrder=asc'))).toBe(true);
  });

  it('creates a user with a password the policy accepts', async () => {
    const fetchMock = fakeBackend();
    const history = renderApp('/app/react/admin/default/user-create');
    const user = await logIn();

    await user.type(await screen.findByLabelText('User ID*'), 'john');
    await user.type(screen.getByLabelText('First Name*'), 'John');
    await user.type(screen.getByLabelText('Last Name*'), 'Doe');
    await user.type(screen.getByLabelText('Password*:'), 'short');
    await user.type(screen.getByLabelText('Password (repeat)*:'), 'short');
    // the policy is checked a moment after typing stops
    expect(await screen.findByText('Your Password is missing some criteria:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create User' })).toBeDisabled();

    await user.type(screen.getByLabelText('Password*:'), 'enough!');
    await user.type(screen.getByLabelText('Password (repeat)*:'), 'enough!');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create User' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Create User' }));

    expect(await screen.findByText('Created new user john')).toBeInTheDocument();
    expect(history.location.pathname).toBe('/app/react/admin/default/users');
    expect(JSON.parse(String(calls(fetchMock, 'POST', '/user/create')[0][1]?.body))).toEqual({
      profile: { id: 'john', firstName: 'John', lastName: 'Doe', email: '' },
      credentials: { password: 'shortenough!' },
    });
  });

  it('edits the profile, changes the password and adds the user to a group', async () => {
    const fetchMock = fakeBackend();
    const history = renderApp('/app/react/admin/default/users/mary?tab=profile');
    const user = await logIn();

    const firstName = await screen.findByLabelText('First Name*');
    await user.clear(firstName);
    await user.type(firstName, 'Maria');
    await user.click(screen.getByRole('button', { name: 'Update Profile' }));
    expect(await screen.findByText('User profile successfully updated.')).toBeInTheDocument();
    expect(JSON.parse(String(calls(fetchMock, 'PUT', '/user/mary/profile')[0][1]?.body))).toMatchObject({ firstName: 'Maria' });

    await user.click(screen.getByRole('tab', { name: 'Account' }));
    expect(history.location.search).toContain('tab=account');
    // an admin changing someone else's password confirms with their own
    await user.type(screen.getByLabelText("Demo Demo's Password*:"), 'demo');
    await user.type(screen.getByLabelText('New Password*:'), 'a-long-password');
    await user.type(screen.getByLabelText('New Password (repeat)*:'), 'a-long-password');
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Change Password' }).at(-1)).toBeEnabled());
    await user.click(screen.getAllByRole('button', { name: 'Change Password' }).at(-1)!);
    expect(await screen.findByText('Changed the password.')).toBeInTheDocument();
    expect(JSON.parse(String(calls(fetchMock, 'PUT', '/user/mary/credentials')[0][1]?.body))).toEqual({
      password: 'a-long-password',
      authenticatedUserPassword: 'demo',
    });

    await user.click(screen.getByRole('tab', { name: 'Groups' }));
    expect(await screen.findByText('Accounting')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add to a group' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Select Groups' }));
    // accounting is a membership already and not offered
    expect(dialog.queryByText('Accounting')).not.toBeInTheDocument();
    await user.click(dialog.getByLabelText('sales'));
    await user.click(dialog.getByRole('button', { name: 'Add Groups' }));

    expect(await screen.findByText('User was successfully added to selected groups.')).toBeInTheDocument();
    expect(calls(fetchMock, 'PUT', '/group/sales/members/mary')).toHaveLength(1);
  });
});

describe('admin groups and tenants', () => {
  it('creates a group', async () => {
    const fetchMock = fakeBackend();
    const history = renderApp('/app/react/admin/default/group-create');
    const user = await logIn();

    await user.type(await screen.findByLabelText('Group ID*'), 'support');
    await user.type(screen.getByLabelText('Group Name*'), 'Support');
    await user.click(screen.getByRole('button', { name: 'Create new group' }));

    expect(await screen.findByText('Successfully created new group support')).toBeInTheDocument();
    expect(history.location.pathname).toBe('/app/react/admin/default/groups');
    expect(JSON.parse(String(calls(fetchMock, 'POST', '/group/create')[0][1]?.body))).toEqual({
      id: 'support',
      name: 'Support',
      type: null,
    });
  });

  it('shows the users of a group and adds the group to a tenant', async () => {
    const fetchMock = fakeBackend();
    renderApp('/app/react/admin/default/groups/accounting?tab=users');
    const user = await logIn();

    expect(await screen.findByRole('link', { name: 'mary' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Tenants' }));
    expect(await screen.findByText('Group Accounting is currently not member of any tenants.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add to a tenant' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Select Tenants' }));
    await user.click(await dialog.findByLabelText('tenant-one'));
    await user.click(dialog.getByRole('button', { name: 'Add to a tenant' }));

    expect(await screen.findByText('User was successfully added to selected tenants.')).toBeInTheDocument();
    expect(calls(fetchMock, 'PUT', '/tenant/tenant-one/group-members/accounting')).toHaveLength(1);
  });

  it('renames and deletes a tenant', async () => {
    const fetchMock = fakeBackend();
    const history = renderApp('/app/react/admin/default/tenants/tenant-one');
    const user = await logIn();

    const name = await screen.findByLabelText('Name*');
    await user.clear(name);
    await user.type(name, 'First tenant');
    await user.click(screen.getByRole('button', { name: 'Update Tenant' }));
    expect(await screen.findByText('Tenant successfully updated.')).toBeInTheDocument();
    expect(JSON.parse(String(calls(fetchMock, 'PUT', '/tenant/tenant-one')[0][1]?.body))).toEqual({
      id: 'tenant-one',
      name: 'First tenant',
    });

    await user.click(screen.getByRole('button', { name: 'Delete Tenant' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Delete Tenant' }));
    expect(dialog.getByText('Really delete tenant tenant-one?')).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Delete Tenant' }));

    expect(await screen.findByText('Tenant tenant-one successfully deleted.')).toBeInTheDocument();
    expect(history.location.pathname).toBe('/app/react/admin/default/tenants');
    expect(calls(fetchMock, 'DELETE', '/tenant/tenant-one')).toHaveLength(1);
  });
});

describe('admin authorizations', () => {
  it('creates, changes and deletes authorizations of a resource type', async () => {
    const fetchMock = fakeBackend();
    renderApp('/app/react/admin/default/authorization?resource=0');
    const user = await logIn();

    expect(await screen.findByText('cadenzaflow-admin')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Application' })).toBeInTheDocument();

    // a new one: ALLOW for a group on all applications by default
    await user.click(screen.getByRole('button', { name: 'Create new authorization' }));
    await user.type(screen.getByPlaceholderText('Group ID'), 'accounting');
    const resourceId = screen.getAllByPlaceholderText('(cockpit or tasklist *)')[0];
    await user.clear(resourceId);
    await user.type(resourceId, 'cockpit');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls(fetchMock, 'POST', '/authorization/create')).toHaveLength(1));
    expect(JSON.parse(String(calls(fetchMock, 'POST', '/authorization/create')[0][1]?.body))).toEqual({
      type: 1,
      permissions: ['ALL'],
      resourceType: 0,
      resourceId: 'cockpit',
      groupId: 'accounting',
    });

    // demo's tasklist access moves to cockpit; the type stays (the engine does not change it)
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[1]);
    expect(screen.queryByLabelText('Type')).not.toBeInTheDocument();
    const editedResource = screen.getByDisplayValue('tasklist');
    await user.clear(editedResource);
    await user.type(editedResource, 'cockpit');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls(fetchMock, 'PUT', '/authorization/a2')).toHaveLength(1));
    expect(JSON.parse(String(calls(fetchMock, 'PUT', '/authorization/a2')[0][1]?.body))).toMatchObject({
      type: 1,
      userId: 'demo',
      resourceId: 'cockpit',
    });

    await user.click(screen.getAllByRole('button', { name: 'Delete' })[1]);
    const dialog = within(await screen.findByRole('dialog', { name: 'Confirm Delete' }));
    expect(dialog.getByText('demo')).toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('The authorization has been deleted successfully.')).toBeInTheDocument();
    expect(calls(fetchMock, 'DELETE', '/authorization/a2')).toHaveLength(1);
  });
});

describe('validateListSearch', () => {
  it('keeps search, page and sorting', () => {
    expect(
      validateListSearch({ searchQuery: [{ type: 'id', operator: 'eq', value: 'mary' }], page: 2, sortBy: 'email', sortOrder: 'desc' }),
    ).toEqual({ searchQuery: [{ type: 'id', operator: 'eq', value: 'mary', name: undefined }], page: 2, sortBy: 'email', sortOrder: 'desc' });
    expect(validateListSearch({ page: 1, sortOrder: 'sideways' })).toEqual({
      searchQuery: undefined,
      page: undefined,
      sortBy: undefined,
      sortOrder: undefined,
    });
  });
});
