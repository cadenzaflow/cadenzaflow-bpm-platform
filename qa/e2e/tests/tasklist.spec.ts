import { expect, test, type Page } from '@playwright/test';
import { Engine, notification, open, runKey } from './support';

const TASKLIST = 'app/react/tasklist/default/';

/** Opens the Tasklist with the task selected. */
async function openTask(page: Page, taskId: string) {
  await open(page, `${TASKLIST}?task=${taskId}`);
  return page.getByRole('region', { name: 'Task' });
}

test.describe('forms of the React Tasklist', () => {
  test('a Camunda Form: claimed, filled in and completed', async ({ page, request }) => {
    const engine = new Engine(request);
    const instance = await engine.start('e2e-order', runKey('tasklist'), { customer: { value: 'ACME' }, amount: { value: 1200 } });
    const [task] = await engine.tasks(instance);
    const panel = await openTask(page, task.id);

    // the form shows the variables of the process, and cannot be changed before the task is claimed
    await expect(panel.getByRole('heading', { name: 'Check order' })).toBeVisible();
    await expect(panel.getByLabel('Customer')).toHaveValue('ACME');
    await expect(panel.getByLabel('Customer')).toBeDisabled();

    await panel.getByRole('button', { name: 'Claim' }).click();
    await expect(panel.getByLabel('Customer')).toBeEnabled();
    await panel.getByLabel('Customer').fill('Initech');
    await panel.getByLabel('Approved').check();
    await panel.getByRole('button', { name: 'Complete' }).click();

    await expect(notification(page, 'The task is completed.')).toBeVisible();
    expect(await engine.variable(instance, 'customer')).toBe('Initech');
    expect(await engine.variable(instance, 'approved')).toBe(true);
    // the approved order went on to the external task
    expect(await engine.tasks(instance)).toHaveLength(0);
    expect(await engine.get<unknown[]>(`/external-task?processInstanceId=${instance}`)).toHaveLength(1);
    await engine.removeInstances((await engine.get<{ businessKey: string }>(`/process-instance/${instance}`)).businessKey);
  });

  test('a Camunda Form does not complete the task while a required field is empty', async ({ page, request }) => {
    const engine = new Engine(request);
    const key = runKey('tasklist');
    const instance = await engine.start('e2e-order', key);
    const [task] = await engine.tasks(instance);
    const panel = await openTask(page, task.id);

    await panel.getByRole('button', { name: 'Claim' }).click();
    await expect(panel.getByLabel('Customer')).toBeEnabled();
    await panel.getByRole('button', { name: 'Complete' }).click();

    await expect(panel.getByText('Field is required.')).toBeVisible();
    expect(await engine.tasks(instance)).toHaveLength(1);
    await engine.removeInstances(key);
  });

  test('the generic form: variables are added and the task is completed', async ({ page, request }) => {
    const engine = new Engine(request);
    const instance = await engine.start('e2e-plain', runKey('tasklist'));
    const [task] = await engine.tasks(instance);
    const panel = await openTask(page, task.id);

    await panel.getByRole('button', { name: 'Claim' }).click();
    await panel.getByRole('button', { name: 'Add a variable' }).click();
    await panel.getByLabel('Name').fill('note');
    await panel.getByLabel('Type').selectOption('String');
    await panel.getByLabel('Value').fill('looks fine');
    await panel.getByRole('button', { name: 'Add a variable' }).click();
    await panel.getByLabel('Name').nth(1).fill('count');
    await panel.getByLabel('Type').nth(1).selectOption('Integer');
    await panel.getByLabel('Value').nth(1).fill('3');
    await panel.getByRole('button', { name: 'Complete' }).click();

    await expect(notification(page, 'The task is completed.')).toBeVisible();
    expect(await engine.state(instance)).toBe('COMPLETED');
    const variables = await engine.get<{ name: string; value: unknown; type: string }[]>(`/history/variable-instance?processInstanceId=${instance}`);
    expect(variables.map((v) => [v.name, v.type, v.value]).sort()).toEqual([
      ['count', 'Integer', 3],
      ['note', 'String', 'looks fine'],
    ]);
  });

  test('an embedded form of a process application: the invoice is approved', async ({ page, request }) => {
    const engine = new Engine(request);
    const key = runKey('tasklist');
    const instance = await engine.start('invoice', key, {
      creditor: { value: 'E2E Supplies', type: 'String' },
      amount: { value: 30, type: 'Double' },
      invoiceCategory: { value: 'Misc', type: 'String' },
      invoiceNumber: { value: key, type: 'String' },
      // the form offers the document as a download
      invoiceDocument: { value: Buffer.from('an invoice').toString('base64'), type: 'File', valueInfo: { filename: 'invoice.txt', mimeType: 'text/plain' } },
    } as never);
    const [task] = await engine.tasks(instance);
    expect(task.name).toBe('Approve Invoice');
    const panel = await openTask(page, task.id);

    await panel.getByRole('button', { name: 'Claim' }).click();
    // the form comes from the process application and shows the variables of the invoice
    await expect(panel.locator('input[name="creditor"]')).toHaveValue('E2E Supplies');
    await expect(panel.locator('input[name="invoiceNumber"]')).toHaveValue(key);
    await expect(panel.getByRole('link', { name: 'invoice.txt' })).toBeVisible();
    await panel.locator('input[cam-variable-name="approved"]').check();
    await panel.getByRole('button', { name: 'Complete' }).click();

    await expect(notification(page, 'The task is completed.')).toBeVisible();
    expect(await engine.variable(instance, 'approved')).toBe(true);
    const [next] = await engine.tasks(instance);
    // (the name has line breaks in the BPMN of the example)
    expect(next.name.replace(/\s+/g, ' ')).toBe('Prepare Bank Transfer');
    await engine.removeInstances(key);
  });
});

test.describe('the task of the React Tasklist', () => {
  test('gets a due date, a comment and another candidate group; the history tells it', async ({ page, request }) => {
    const engine = new Engine(request);
    const key = runKey('tasklist');
    const instance = await engine.start('e2e-plain', key);
    const [task] = await engine.tasks(instance);
    const panel = await openTask(page, task.id);

    await panel.getByRole('button', { name: 'Set due date' }).click();
    await panel.getByLabel('Due date').fill('2031-05-06T07:08');
    await panel.getByRole('button', { name: 'Save' }).click();
    await expect(panel.getByRole('button', { name: 'Reset due date' })).toBeVisible();
    expect((await engine.get<{ due: string }>(`/task/${task.id}`)).due).toContain('2031-05-06T07:08:00');

    await panel.getByRole('button', { name: 'Add Comment' }).click();
    const comment = page.getByRole('dialog', { name: 'Add Comment' });
    await comment.getByLabel('Comment').fill('Checked by the e2e test');
    await comment.getByRole('button', { name: 'Save' }).click();
    await expect(comment).toBeHidden();
    const comments = await engine.get<{ message: string }[]>(`/task/${task.id}/comment`);
    expect(comments.map((c) => c.message)).toEqual(['Checked by the e2e test']);

    await panel.getByRole('button', { name: 'Add groups' }).click();
    const groups = page.getByRole('dialog', { name: 'Manage Groups' });
    await groups.getByLabel('Group ID').fill('e2ereviewers');
    await groups.getByRole('button', { name: 'Add a group' }).click();
    await expect(groups.getByText('e2ereviewers', { exact: true })).toBeVisible();
    await groups.getByRole('button', { name: 'Close' }).first().click();
    const links = await engine.get<{ groupId: string | null; type: string }[]>(`/task/${task.id}/identity-links?type=candidate`);
    expect(links.map((link) => link.groupId)).toEqual(['e2ereviewers']);

    await panel.getByRole('tab', { name: 'History' }).click();
    const history = panel.getByRole('tabpanel', { name: 'History' });
    await expect(history.getByText('Checked by the e2e test')).toBeVisible();
    await expect(history.getByText('Due date')).toBeVisible();

    // the diagram of the process marks where the task is
    await panel.getByRole('tab', { name: 'Diagram' }).click();
    await expect(panel.getByRole('tabpanel', { name: 'Diagram' }).locator('[data-element-id="review"]')).toBeVisible();
    await engine.removeInstances(key);
  });

  test('is claimed, given to nobody again and reassigned to a user who exists', async ({ page, request }) => {
    const engine = new Engine(request);
    const key = runKey('tasklist');
    const instance = await engine.start('e2e-plain', key);
    const [task] = await engine.tasks(instance);
    const panel = await openTask(page, task.id);
    const assignee = async () => (await engine.get<{ assignee: string | null }>(`/task/${task.id}`)).assignee;

    await panel.getByRole('button', { name: 'Claim' }).click();
    await expect(panel.getByRole('button', { name: 'Unclaim' })).toBeVisible();
    expect(await assignee()).toBe('demo');

    await panel.getByRole('button', { name: 'Change assignee' }).click();
    await panel.getByPlaceholder('Assignee').fill('nobody-of-that-name');
    await panel.getByRole('button', { name: 'Save' }).click();
    await expect(panel.getByText('There is no user with this ID.')).toBeVisible();
    expect(await assignee()).toBe('demo');
    await panel.getByRole('button', { name: 'Cancel' }).click();

    await panel.getByRole('button', { name: 'Unclaim' }).click();
    await expect(panel.getByRole('button', { name: 'Claim' })).toBeVisible();
    expect(await assignee()).toBeNull();
    await engine.removeInstances(key);
  });
});

test.describe('the React Tasklist', () => {
  test('starts a process with a business key and a variable', async ({ page, request }) => {
    const engine = new Engine(request);
    const key = runKey('tasklist-start');
    await open(page, TASKLIST);

    await page.getByRole('button', { name: 'Start process' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder('Search by process name.').fill('E2E Plain');
    await dialog.getByRole('button', { name: /E2E Plain/ }).click();
    await dialog.getByLabel('Business Key').fill(key);
    await dialog.getByRole('button', { name: 'Add a variable' }).click();
    await dialog.getByLabel('Name').fill('priority');
    await dialog.getByLabel('Type').selectOption('Boolean');
    await dialog.locator('label', { hasText: /^Value$/ }).click();
    await dialog.getByRole('button', { name: 'Start', exact: true }).click();

    await expect(notification(page, 'The process has been started.')).toBeVisible();
    const instances = await engine.get<{ id: string }[]>(`/process-instance?businessKey=${key}`);
    expect(instances).toHaveLength(1);
    expect(await engine.variable(instances[0].id, 'priority')).toBe(true);
    await engine.removeInstances(key);
  });

  test('creates a task that belongs to no process', async ({ page, request }) => {
    const engine = new Engine(request);
    const name = runKey('Standalone task');
    await open(page, TASKLIST);

    await page.getByRole('button', { name: 'Create task' }).click();
    const dialog = page.getByRole('dialog', { name: 'Create task' });
    // a task needs a name
    await expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();
    await dialog.getByLabel('Name').fill(name);
    await dialog.getByLabel('Assignee').fill('demo');
    await dialog.getByLabel('Description').fill('Made by the e2e test');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toBeHidden();

    const tasks = await engine.get<{ id: string; assignee: string; description: string; processInstanceId: string | null }[]>(`/task?name=${encodeURIComponent(name)}`);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ assignee: 'demo', description: 'Made by the e2e test', processInstanceId: null });
    // and it is in the list
    await expect(page.getByRole('list', { name: 'Tasks' }).getByRole('button', { name: new RegExp(name) })).toBeVisible();
    await engine.delete(`/task/${tasks[0].id}`);
  });

  test('keeps a filter with a criterion: created, used, changed and deleted', async ({ page, request }) => {
    const engine = new Engine(request);
    const key = runKey('tasklist-filter');
    const name = runKey('E2E filter');
    const instance = await engine.start('e2e-plain', key);
    await open(page, TASKLIST);
    const filters = page.getByRole('list', { name: 'Filters' });

    await page.getByRole('button', { name: 'Create a filter' }).click();
    let dialog = page.getByRole('dialog', { name: 'Create a filter' });
    await dialog.getByLabel('Name', { exact: true }).fill(name);
    await dialog.getByRole('button', { name: 'Add criterion' }).click();
    await dialog.getByLabel('Key').selectOption('processInstanceBusinessKey');
    await dialog.getByLabel('Value').fill(key);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(notification(page, 'The filter was saved')).toBeVisible();

    const stored = await engine.get<{ id: string; query: Record<string, unknown> }[]>(`/filter?name=${encodeURIComponent(name)}`);
    expect(stored).toHaveLength(1);
    expect(stored[0].query).toMatchObject({ processInstanceBusinessKey: key });

    // the filter shows the one task of this test
    await filters.getByRole('button', { name: new RegExp(`^${name}`) }).click();
    const tasks = page.getByRole('list', { name: 'Tasks' }).getByRole('listitem');
    await expect(tasks).toHaveCount(1);
    await expect(tasks.first()).toContainText('Review request');

    // changed: now it asks for a business key that no instance has
    await filters.getByRole('listitem').filter({ hasText: name }).getByRole('button', { name: 'Edit filter' }).click();
    dialog = page.getByRole('dialog', { name: 'Edit filter' });
    await dialog.getByLabel('Value').fill(`${key}-none`);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(notification(page, 'The filter was saved')).toBeVisible();
    await expect(tasks).toHaveCount(0);

    await filters.getByRole('listitem').filter({ hasText: name }).getByRole('button', { name: 'Edit filter' }).click();
    dialog = page.getByRole('dialog', { name: 'Edit filter' });
    await dialog.getByRole('button', { name: 'Delete filter' }).click();
    await dialog.getByRole('button', { name: 'Delete filter' }).click();
    await expect(notification(page, 'The filter has been deleted')).toBeVisible();
    expect(await engine.get<unknown[]>(`/filter?name=${encodeURIComponent(name)}`)).toHaveLength(0);
    await expect(filters.getByText(name)).toHaveCount(0);
    await engine.removeInstances(key);
    expect(await engine.state(instance)).toBe('EXTERNALLY_TERMINATED');
  });

  test('finds tasks by a search and sorts them', async ({ page, request }) => {
    const engine = new Engine(request);
    const key = runKey('tasklist-search');
    await engine.start('e2e-plain', key);
    await engine.start('e2e-order', key);
    // a filter of the test that shows every task: what the first filter shows differs between the distributions
    const filterName = runKey('E2E everything');
    const filter = await engine.post<{ id: string }>('/filter/create', { resourceType: 'Task', name: filterName, query: {}, properties: { priority: -100 } });
    await open(page, TASKLIST);
    await page.getByRole('list', { name: 'Filters' }).getByRole('button', { name: new RegExp(`^${filterName}`) }).click();
    const tasks = page.getByRole('list', { name: 'Tasks' }).getByRole('listitem');

    const search = page.getByRole('region', { name: 'Tasks' });
    await search.getByRole('button', { name: /^Search/ }).click();
    await search.getByRole('button', { name: 'Add criterion' }).click();
    await search.getByRole('combobox', { name: 'Criterion' }).selectOption({ label: 'Process Instance Business Key' });
    await search.getByRole('textbox', { name: 'Value' }).fill(key);

    await expect(tasks).toHaveCount(2);
    await page.getByLabel('Sort by').selectOption({ label: 'Task name' });
    await page.getByRole('button', { name: 'Descending' }).click();
    await expect(tasks.first()).toContainText('Check order');
    await expect(tasks.nth(1)).toContainText('Review request');
    await engine.removeInstances(key);
    await engine.delete(`/filter/${filter!.id}`);
  });
});
