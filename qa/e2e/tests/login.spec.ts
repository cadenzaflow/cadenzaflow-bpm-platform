import { expect, test, type Page } from '@playwright/test';
import { open } from './support';

async function logInClassic(page: Page, app: string) {
  await page.goto(`app/${app}/default/`);
  await page.locator('input[type="text"]').fill('demo');
  await page.locator('input[type="password"]').fill('demo');
  await page.locator('button[type="submit"]').click();
}

test.describe('the classic webapps', () => {
  test('Cockpit shows its dashboard after the login', async ({ page }) => {
    await logInClassic(page, 'cockpit');

    await expect(page.locator('.deployed .processes .stats-label')).toHaveText('Process Definitions');
    await expect(page).toHaveURL(/app\/cockpit\/default\/#\/dashboard/);
    // the footer names the version of the build, not a fixed one
    await expect(page.locator('footer, .app-footer, [cam-widget-footer]').first()).toContainText(/v\d+\.\d+\.\d+/);
  });

  test('Tasklist shows the tasks of the first filter after the login', async ({ page }) => {
    await logInClassic(page, 'tasklist');

    await expect(page.locator('.task-filters .name, [cam-tasklist-filters] .name').first()).toBeVisible();
    await expect(page.locator('.tasks-list .task, [cam-tasks] .task').first()).toBeVisible();
  });

  test('Admin and Welcome open after the login', async ({ page }) => {
    await logInClassic(page, 'admin');
    await expect(page.getByRole('link', { name: 'List of Users' })).toBeVisible();

    await page.goto('app/welcome/default/');
    await expect(page.getByRole('heading', { name: 'Applications' })).toBeVisible();
  });
});

test.describe('the login of the React webapps', () => {
  test('names the webapp and refuses a wrong password', async ({ page }) => {
    await page.goto('app/react/tasklist/default/');

    await expect(page.getByRole('heading', { name: /Tasklist/ })).toBeVisible();
    // (a user that does not exist: a wrong password would lock demo for the tests that follow)
    await page.getByLabel('Username').fill('nobody-of-that-name');
    await page.getByRole('textbox', { name: 'Password' }).fill('not-the-password');
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page.getByText(/Wrong credentials|locked/i)).toBeVisible();
    await expect(page.getByLabel('Username')).toBeVisible();
  });

  test('leads to the page that was asked for', async ({ page }) => {
    await open(page, 'app/react/cockpit/default/decisions');

    await expect(page).toHaveURL(/app\/react\/cockpit\/default\/decisions/);
    await expect(page.getByRole('heading', { name: 'Decisions', level: 1 })).toBeVisible();
  });

  test('keeps the session over a reload and over the apps, and ends it on logout', async ({ page }) => {
    await open(page, 'app/react/cockpit/default/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    await page.getByRole('navigation', { name: 'Modules' }).getByRole('link', { name: 'Tasklist' }).click();
    await expect(page.getByRole('region', { name: 'Filters' })).toBeVisible();
    await page.getByRole('navigation', { name: 'Modules' }).getByRole('link', { name: 'Admin' }).click();
    await expect(page.getByRole('navigation', { name: 'Admin sections' })).toBeVisible();

    await page.getByRole('button', { name: 'Demo Demo' }).click();
    await page.getByRole('menuitem', { name: 'Log out' }).or(page.getByText('Log out', { exact: true })).first().click();

    await expect(page.getByLabel('Username')).toBeVisible();
    // the session is gone: another page asks for the login again
    await page.goto('app/react/cockpit/default/processes');
    await expect(page.getByLabel('Username')).toBeVisible();
  });

  test('offers the classic webapp of the same app', async ({ page }) => {
    await open(page, 'app/react/admin/default/');

    await page.getByRole('button', { name: 'Demo Demo' }).click();
    await page.getByRole('link', { name: 'Switch to the classic UI' }).click();

    await expect(page).toHaveURL(/app\/admin\/default\//);
    // the session is the same: no second login
    await expect(page.getByRole('link', { name: 'List of Users' })).toBeVisible();
  });
});
