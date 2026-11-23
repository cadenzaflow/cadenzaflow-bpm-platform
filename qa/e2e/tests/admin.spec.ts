import { expect, test, type APIRequestContext } from '@playwright/test';
import { Engine, REST, notification, open } from './support';

const ADMIN = 'app/react/admin/default';

/** Ids of this run (letters and digits only, as the engine wants them). */
const id = (name: string) => `${name}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

/** Removes what a test made, also when it failed half way. */
async function remove(request: APIRequestContext, ...paths: string[]) {
  for (const path of paths) {
    await request.delete(`${REST}${path}`);
  }
}

test.describe('the React Admin', () => {
  test('creates a user who can log in, changes the profile and deletes the user', async ({ page, request }) => {
    const engine = new Engine(request);
    const userId = id('e2euser');
    await open(page, `${ADMIN}/user-create`);

    await page.getByLabel('User ID*').fill(userId);
    await page.getByLabel('First Name*').fill('Erin');
    await page.getByLabel('Last Name*').fill('Example');
    await page.getByLabel('Email').fill('not-an-address');
    await page.getByLabel('Password*:', { exact: true }).fill('erin-password-1');
    // the repeated password has to be the same
    await page.getByLabel('Password (repeat)*:').fill('something-else');
    await expect(page.getByRole('button', { name: 'Create User' })).toBeDisabled();
    await page.getByLabel('Password (repeat)*:').fill('erin-password-1');
    await page.getByLabel('Email').fill('erin@example.org');
    await page.getByRole('button', { name: 'Create User' }).click();

    await expect(notification(page, `Created new user ${userId}`)).toBeVisible();
    expect(await engine.get(`/user/${userId}/profile`)).toMatchObject({ id: userId, firstName: 'Erin', lastName: 'Example', email: 'erin@example.org' });

    // the password works: the user logs in (and may use no app yet, having no authorization)
    const login = await request.post(`${REST}/identity/verify`, { data: { username: userId, password: 'erin-password-1' } });
    expect((await login.json()).authenticated).toBe(true);

    // the profile is changed
    await page.goto(`${ADMIN}/users/${userId}?tab=profile`);
    await page.getByLabel('Last Name*').fill('Sample');
    await page.getByRole('button', { name: 'Update Profile' }).click();
    await expect(notification(page, 'User profile successfully updated.')).toBeVisible();
    expect((await engine.get<{ lastName: string }>(`/user/${userId}/profile`)).lastName).toBe('Sample');

    // ... and the user is in the list, and deleted from the account tab
    await page.goto(`${ADMIN}/users`);
    await expect(page.getByRole('link', { name: userId, exact: true })).toBeVisible();
    await page.getByRole('link', { name: userId, exact: true }).click();
    await page.getByRole('tab', { name: 'Account' }).click();
    await page.getByRole('button', { name: 'Delete User' }).click();
    await page.getByRole('dialog', { name: 'Delete User' }).getByRole('button', { name: 'Delete User' }).click();
    await expect(notification(page, `User ${userId} successfully deleted.`)).toBeVisible();
    expect((await request.get(`${REST}/user/${userId}/profile`)).status()).toBe(404);
  });

  test('creates a group, puts a user into it and removes the group', async ({ page, request }) => {
    const engine = new Engine(request);
    const groupId = id('e2egroup');
    const userId = id('e2emember');
    await engine.post('/user/create', { profile: { id: userId, firstName: 'Mem', lastName: 'Ber' }, credentials: { password: 'member-password-1' } });

    try {
      await open(page, `${ADMIN}/group-create`);
      await page.getByLabel('Group ID*').fill(groupId);
      await page.getByLabel('Group Name*').fill('E2E Group');
      await page.getByRole('button', { name: 'Create new group' }).click();
      await expect(notification(page, `Successfully created new group ${groupId}`)).toBeVisible();
      expect(await engine.get(`/group/${groupId}`)).toMatchObject({ id: groupId, name: 'E2E Group' });

      await page.goto(`${ADMIN}/users/${userId}?tab=groups`);
      await page.getByRole('button', { name: 'Add to a group' }).click();
      const dialog = page.getByRole('dialog', { name: 'Select Groups' });
      await dialog.locator('label', { hasText: groupId }).click();
      await dialog.getByRole('button', { name: 'Add Groups' }).click();
      await expect(notification(page, 'User was successfully added to selected groups.')).toBeVisible();
      expect((await engine.get<{ id: string }[]>(`/group?member=${userId}`)).map((group) => group.id)).toEqual([groupId]);

      // the group lists its member
      await page.goto(`${ADMIN}/groups/${groupId}?tab=users`);
      await expect(page.getByRole('link', { name: userId, exact: true })).toBeVisible();
    } finally {
      await remove(request, `/group/${groupId}`, `/user/${userId}`);
    }
  });

  test('creates a tenant and changes its name', async ({ page, request }) => {
    const engine = new Engine(request);
    const tenantId = id('e2etenant');

    try {
      await open(page, `${ADMIN}/tenant-create`);
      await page.getByLabel('ID*').fill(tenantId);
      await page.getByLabel('Name*').fill('E2E Tenant');
      await page.getByRole('button', { name: 'Create new tenant' }).click();
      await expect(notification(page, `Created new tenant ${tenantId}`)).toBeVisible();
      expect(await engine.get(`/tenant/${tenantId}`)).toMatchObject({ id: tenantId, name: 'E2E Tenant' });

      await page.getByRole('link', { name: tenantId, exact: true }).click();
      await page.getByLabel('Name*').fill('E2E Tenant renamed');
      await page.getByRole('button', { name: 'Update Tenant' }).click();
      await expect(notification(page, 'Tenant successfully updated.')).toBeVisible();
      expect((await engine.get<{ name: string }>(`/tenant/${tenantId}`)).name).toBe('E2E Tenant renamed');
    } finally {
      await remove(request, `/tenant/${tenantId}`);
    }
  });

  test('an authorization lets a user into the Tasklist, and only there', async ({ page, request, browser }) => {
    const engine = new Engine(request);
    const userId = id('e2etasks');
    await engine.post('/user/create', { profile: { id: userId, firstName: 'Tess', lastName: 'Tasks' }, credentials: { password: 'tasks-password-1' } });

    try {
      await open(page, `${ADMIN}/authorization?resource=0`);
      await expect(page.getByRole('heading', { name: 'Application' })).toBeVisible();
      await page.getByRole('button', { name: 'Create new authorization' }).click();
      await page.getByLabel('Type').selectOption({ label: 'ALLOW' });
      // for a user, not for a group
      await page.getByRole('row').filter({ has: page.getByLabel('Type') }).getByRole('button', { name: /Group|User/ }).first().click();
      await page.getByPlaceholder('User ID').fill(userId);
      await page.getByPlaceholder('(cockpit or tasklist *)').first().fill('tasklist');
      await page.getByRole('button', { name: 'Save' }).click();

      await expect
        .poll(async () => (await engine.get<{ resourceId: string; userId: string }[]>(`/authorization?userIdIn=${userId}&resourceType=0`)).map((a) => a.resourceId))
        .toEqual(['tasklist']);

      // the user, in a browser of their own
      const context = await browser.newContext({ baseURL: page.url().split('app/react')[0] });
      const own = await context.newPage();
      await open(own, 'app/react/tasklist/default/', userId, 'tasks-password-1');
      await expect(own.getByRole('region', { name: 'Filters' })).toBeVisible();
      const session = await (await context.request.get('api/admin/auth/user/default', { headers: { Accept: 'application/json' } })).json();
      const modules = own.getByRole('navigation', { name: 'Modules' });

      // Where the engine checks authorizations (the Tomcat distributions do, Run does not
      // unless it is configured to), the grant is all the user has.
      const checked = !session.authorizedApps.includes('cockpit');
      if (process.env.E2E_AUTHORIZATION) {
        expect(checked, 'the engine checks authorizations').toBe(process.env.E2E_AUTHORIZATION === 'true');
      }
      if (checked) {
        expect(session.authorizedApps).toContain('tasklist');
        expect(session.authorizedApps).not.toContain('admin');
        await expect(modules.getByRole('link', { name: 'Cockpit' })).toHaveCount(0);
        await expect(modules.getByRole('link', { name: 'Admin' })).toHaveCount(0);
        // Cockpit does not open for them
        await own.goto('app/react/cockpit/default/');
        await expect(own.getByRole('heading', { name: 'Dashboard' })).toHaveCount(0);
      } else {
        // without the check every user may use every app
        await expect(modules.getByRole('link', { name: 'Cockpit' })).toBeVisible();
        await expect(modules.getByRole('link', { name: 'Admin' })).toBeVisible();
      }
      await context.close();
    } finally {
      const authorizations = await engine.get<{ id: string }[]>(`/authorization?userIdIn=${userId}`);
      await remove(request, ...authorizations.map((a) => `/authorization/${a.id}`), `/user/${userId}`);
    }
  });

  test('tells the state of the engine, its metrics and its diagnostics', async ({ page }) => {
    await open(page, `${ADMIN}/system`);
    await expect(page.getByRole('status').filter({ hasText: 'is up and running' })).toBeVisible();

    await page.getByRole('navigation', { name: 'System Settings' }).getByRole('link', { name: 'Execution Metrics' }).click();
    await expect(page.getByText('Usage last 12 months by month')).toBeVisible();

    await page.getByRole('navigation', { name: 'System Settings' }).getByRole('link', { name: 'Diagnostics' }).click();
    await expect(page.getByText(/"vendor": "/)).toBeVisible();
    await expect(page.getByText(/"version": "\d+\.\d+\.\d+/).first()).toBeVisible();
  });
});

test.describe('the React Welcome page', () => {
  test('leads to the apps and changes the own profile', async ({ page, request }) => {
    const engine = new Engine(request);
    const before = await engine.get<{ id: string; firstName: string; lastName: string; email: string }>('/user/demo/profile');

    try {
      await open(page, 'app/react/welcome/default/');
      await expect(page.getByRole('heading', { name: 'Applications' })).toBeVisible();
      for (const app of ['Cockpit', 'Tasklist', 'Admin']) {
        await expect(page.getByRole('main').getByRole('link', { name: app, exact: true })).toBeVisible();
      }

      await page.getByRole('button', { name: 'Edit profile' }).click();
      await page.getByLabel('Email').fill('demo-e2e@example.org');
      await page.getByRole('button', { name: 'Update' }).click();

      await expect(page.getByRole('complementary').getByText('demo-e2e@example.org')).toBeVisible();
      expect((await engine.get<{ email: string }>('/user/demo/profile')).email).toBe('demo-e2e@example.org');

      await page.getByRole('main').getByRole('link', { name: 'Tasklist', exact: true }).click();
      await expect(page.getByRole('region', { name: 'Filters' })).toBeVisible();
    } finally {
      await engine.put('/user/demo/profile', before);
    }
  });
});
