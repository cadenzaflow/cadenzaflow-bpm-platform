import { expect, test, type Page } from '@playwright/test';
import { RESOURCES } from './processes';
import { Engine, REST, notification, open, runKey } from './support';

const COCKPIT = 'app/react/cockpit/default';

const instancePage = (page: Page, id: string) => open(page, `${COCKPIT}/process-instance/${id}`);
const definitionPage = async (page: Page, engine: Engine, key: string) =>
  open(page, `${COCKPIT}/process-definition/${encodeURIComponent(await engine.definitionId(key))}`);

/** The number behind a heading of the dashboard. */
const dashboardNumber = async (page: Page, heading: string) =>
  Number(await page.locator('section, div').filter({ has: page.getByRole('heading', { name: heading, exact: true }) }).last().getByRole('link').first().innerText());

test.describe('the React Cockpit', () => {
  test('counts on its dashboard what the engine has', async ({ page, request }) => {
    const engine = new Engine(request);
    const key = runKey('cockpit-dashboard');
    await engine.start('e2e-plain', key);
    const count = async (path: string) => (await engine.get<{ count: number }>(path)).count;

    await open(page, `${COCKPIT}/`);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    await expect.poll(() => dashboardNumber(page, 'Running Process Instances')).toBe(await count('/process-instance/count'));
    expect(await dashboardNumber(page, 'Open Incidents')).toBe(await count('/incident/count'));
    expect(await dashboardNumber(page, 'Open Human Tasks')).toBe(await count('/task/count'));
    expect(await dashboardNumber(page, 'Process Definitions')).toBe(await count('/process-definition/count?latestVersion=true'));
    expect(await dashboardNumber(page, 'Decision Definitions')).toBe(await count('/decision-definition/count?latestVersion=true'));
    expect(await dashboardNumber(page, 'Deployments')).toBe(await count('/deployment/count'));
    await engine.removeInstances(key);
  });

  test('lists the processes and leads to a definition with its diagram and instances', async ({ page, request }) => {
    const engine = new Engine(request);
    const key = runKey('cockpit-list');
    const instance = await engine.start('e2e-order', key);

    await open(page, `${COCKPIT}/processes`);
    await page.getByRole('link', { name: 'E2E Order', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'E2E Order', level: 1 })).toBeVisible();
    // the diagram is drawn, and the user task says how many instances wait in it
    const diagram = page.locator('.djs-container');
    await expect(diagram.locator('[data-element-id="check"]')).toBeVisible();
    await expect(diagram.locator('[data-element-id="ship"]')).toBeVisible();
    const definition = await engine.definitionId('e2e-order');
    const waiting = (await engine.get<{ count: number }>(`/process-instance/count?processDefinitionId=${encodeURIComponent(definition)}&activityIdIn=check`)).count;
    await expect(page.locator('.djs-overlays[data-container-id="check"] .cz-diagram-badge__count')).toHaveText(String(waiting));
    await expect(page.locator('.djs-overlays[data-container-id="check"] .cz-diagram-badge__count')).toHaveAttribute('title', `Running Instances: ${waiting}`);

    // the instance of this test is in the list of the definition
    const instances = page.getByRole('tabpanel', { name: 'Process Instances' });
    await instances.getByRole('button', { name: 'Add criterion' }).click();
    await instances.getByRole('combobox', { name: 'Criterion' }).selectOption({ label: 'Business Key' });
    await instances.getByRole('textbox', { name: 'Value' }).fill(key);
    await expect(instances.getByRole('row')).toHaveCount(2);
    await instances.getByRole('link', { name: instance }).click();
    await expect(page).toHaveURL(new RegExp(`process-instance/${instance}`));
    await engine.removeInstances(key);
  });

  test('a click on an activity of the diagram shows the instances that wait there', async ({ page, request }) => {
    const engine = new Engine(request);
    const key = runKey('cockpit-diagram');
    const waiting = await engine.start('e2e-order', key);
    const shipping = await engine.start('e2e-order', key);
    const [task] = await engine.tasks(shipping);
    await engine.post(`/task/${task.id}/complete`, { variables: { approved: { value: true, type: 'Boolean' } } });

    await definitionPage(page, engine, 'e2e-order');
    const instances = page.getByRole('tabpanel', { name: 'Process Instances' });
    await page.locator('.djs-container [data-element-id="ship"] .djs-hit').first().click();

    await expect(page).toHaveURL(/activityIds=ship/);
    await expect(instances.getByRole('link', { name: shipping })).toBeVisible();
    await expect(instances.getByRole('link', { name: waiting })).toHaveCount(0);

    // the name below an event belongs to the event
    await page.locator('.djs-container [data-element-id="ordered_label"] .djs-hit').first().click();
    await expect(page).toHaveURL(/activityIds=ordered(&|$)/);
    await engine.removeInstances(key);
  });

  test('adds, changes and deletes a variable of a process instance', async ({ page, request }) => {
    const engine = new Engine(request);
    const key = runKey('cockpit-variables');
    const instance = await engine.start('e2e-plain', key, { customer: { value: 'ACME' } });
    await instancePage(page, instance);
    const variables = page.getByRole('tabpanel', { name: 'Variables' });

    await page.getByRole('button', { name: 'Add a new variable to Process Instance' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add Variable to Process Instance' });
    await dialog.getByLabel('Variable Name*').fill('amount');
    await dialog.getByLabel('Variable Type*').selectOption('Integer');
    // a value that is no number of that type cannot be added
    await dialog.getByLabel('Variable Value*').fill('many');
    await expect(dialog.getByRole('button', { name: 'Add' })).toBeDisabled();
    await dialog.getByLabel('Variable Value*').fill('42');
    await dialog.getByRole('button', { name: 'Add' }).click();
    await expect(notification(page, 'Added the variable "amount".')).toBeVisible();
    expect(await engine.variable(instance, 'amount')).toBe(42);
    await expect(variables.getByRole('row', { name: /amount Integer 42/ })).toBeVisible();

    await variables.getByRole('row', { name: /customer/ }).getByRole('button', { name: 'Change' }).click();
    const change = page.getByRole('dialog', { name: 'Variable' });
    await change.getByRole('textbox').last().fill('Initech');
    await change.getByRole('button', { name: /Save|Change/ }).last().click();
    await expect.poll(() => engine.variable(instance, 'customer')).toBe('Initech');

    await variables.getByRole('row', { name: /amount/ }).getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog').getByRole('button', { name: /Delete/ }).last().click();
    await expect.poll(() => engine.variable(instance, 'amount')).toBeUndefined();
    await expect(variables.getByRole('row', { name: /amount/ })).toHaveCount(0);
    await engine.removeInstances(key);
  });

  test('suspends and activates a process instance, and deletes it', async ({ page, request }) => {
    const engine = new Engine(request);
    const instance = await engine.start('e2e-plain', runKey('cockpit-state'));
    await instancePage(page, instance);
    const suspended = async () => (await engine.get<{ suspended: boolean }>(`/process-instance/${instance}`)).suspended;

    await page.getByRole('button', { name: 'Suspend Process Instance' }).click();
    await page.getByRole('dialog', { name: 'Suspend Process Instance' }).getByRole('button', { name: 'Suspend' }).click();
    await expect(page.getByRole('button', { name: 'Activate Process Instance' })).toBeVisible();
    expect(await suspended()).toBe(true);
    // its task is suspended with it
    expect((await engine.get<{ suspended: boolean }[]>(`/task?processInstanceId=${instance}`))[0].suspended).toBe(true);

    await page.getByRole('button', { name: 'Activate Process Instance' }).click();
    await page.getByRole('dialog', { name: 'Activate Process Instance' }).getByRole('button', { name: 'Activate' }).click();
    await expect(page.getByRole('button', { name: 'Suspend Process Instance' })).toBeVisible();
    expect(await suspended()).toBe(false);

    await page.getByRole('button', { name: 'Delete Process Instance' }).click();
    await page.getByRole('dialog', { name: 'Delete running process instance' }).getByRole('button', { name: 'Delete Process Instance' }).click();
    await expect(notification(page, 'The deletion of the process instance was successful.')).toBeVisible();
    expect(await engine.state(instance)).toBe('EXTERNALLY_TERMINATED');
  });

  test('shows the incident of a failed job and retries the job', async ({ page, request }) => {
    const engine = new Engine(request);
    const key = runKey('cockpit-incident');
    const { instance, job } = await engine.startFailed(key);
    const incidents = async () => (await engine.get<{ count: number }>(`/incident/count?processInstanceId=${instance}`)).count;
    expect(await incidents()).toBe(1);

    // on the definition: the activity carries the incident, and the tab lists it
    await definitionPage(page, engine, 'e2e-failing');
    await expect(page.locator('.djs-overlays[data-container-id="later"] .cz-diagram-badge__incidents')).toBeVisible();
    await expect(page.getByRole('tabpanel', { name: 'Process Instances' }).getByRole('row', { name: new RegExp(`With Incidents ${instance}`) })).toBeVisible();
    await page.getByRole('tab', { name: 'Incidents' }).click();
    await expect(page.getByRole('tabpanel', { name: 'Incidents' }).getByText(/e2eBeanThatDoesNotExist/).first()).toBeVisible();

    // on the instance: the message of the exception, and the retry
    await instancePage(page, instance);
    await page.getByRole('tab', { name: 'Incidents' }).click();
    const tab = page.getByRole('tabpanel', { name: 'Incidents' });
    await expect(tab.getByText(/e2eBeanThatDoesNotExist/).first()).toBeVisible();
    await expect(tab.getByRole('row')).toHaveCount(2);

    await page.getByRole('button', { name: 'Increment Number of Retries of Failed Jobs' }).click();
    const dialog = page.getByRole('dialog', { name: 'Increment Number of Retries' });
    await dialog.getByRole('button', { name: 'Retry (1 job)' }).or(dialog.getByRole('button', { name: /^Retry \(1/ })).first().click();
    await expect(dialog.getByText('Successful')).toBeVisible();

    await expect.poll(incidents).toBe(0);
    expect((await engine.get<{ retries: number }>(`/job/${job}`)).retries).toBe(1);
    await engine.removeInstances(key);
  });

  test('leads from a process instance to the instance it called and back', async ({ page, request }) => {
    const engine = new Engine(request);
    const key = runKey('cockpit-called');
    const parent = await engine.start('e2e-parent', key);
    const [called] = await engine.get<{ id: string }[]>(`/process-instance?superProcessInstance=${parent}`);

    await instancePage(page, parent);
    await page.getByRole('tab', { name: 'Called Process Instances' }).click();
    await page.getByRole('tabpanel', { name: 'Called Process Instances' }).getByRole('link', { name: called.id }).click();

    await expect(page).toHaveURL(new RegExp(`process-instance/${called.id}`));
    await expect(page.getByRole('heading', { name: 'E2E Plain', level: 1 })).toBeVisible();
    // the called instance names its caller
    await page.getByRole('complementary').getByRole('link', { name: parent }).click();
    await expect(page).toHaveURL(new RegExp(`process-instance/${parent}`));

    // the definition names what it calls
    await definitionPage(page, engine, 'e2e-parent');
    await page.getByRole('tab', { name: 'Called Process Definitions' }).click();
    await expect(page.getByRole('tabpanel', { name: 'Called Process Definitions' }).getByRole('link', { name: 'E2E Plain' })).toBeVisible();
    await engine.removeInstances(key);
  });

  test('shows the user task and the external task of an instance, and reassigns the user task', async ({ page, request }) => {
    const engine = new Engine(request);
    const key = runKey('cockpit-tasks');
    const instance = await engine.start('e2e-order', key);
    await instancePage(page, instance);

    await page.getByRole('tab', { name: 'User Tasks' }).click();
    const userTasks = page.getByRole('tabpanel', { name: 'User Tasks' });
    await expect(userTasks.getByRole('row', { name: /Check order/ })).toBeVisible();
    await userTasks.getByRole('row', { name: /Check order/ }).getByRole('button', { name: /assignee/i }).first().click();
    await userTasks.getByRole('textbox').last().fill('demo');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await engine.tasks(instance))[0].assignee).toBe('demo');

    const [task] = await engine.tasks(instance);
    await engine.post(`/task/${task.id}/complete`, { variables: { approved: { value: true, type: 'Boolean' } } });
    await page.reload();
    await page.getByRole('tab', { name: 'External Tasks' }).click();
    const external = page.getByRole('tabpanel', { name: 'External Tasks' });
    await expect(external.getByRole('row', { name: /e2e-ship/ })).toBeVisible();
    await engine.removeInstances(key);
  });

  test('suspends a job definition and overrides the priority of its jobs', async ({ page, request }) => {
    const engine = new Engine(request);
    const definition = await engine.definitionId('e2e-wait');
    const jobDefinition = async () =>
      (await engine.get<{ id: string; suspended: boolean; overridingJobPriority: number | null }[]>(`/job-definition?processDefinitionId=${encodeURIComponent(definition)}`))[0];
    // (as an earlier run may have left it)
    await engine.put(`/job-definition/${(await jobDefinition()).id}/suspended`, { suspended: false, includeJobs: true });
    await engine.put(`/job-definition/${(await jobDefinition()).id}/jobPriority`, { priority: null });

    await definitionPage(page, engine, 'e2e-wait');
    await page.getByRole('tab', { name: 'Job Definitions' }).click();
    const row = page.getByRole('tabpanel', { name: 'Job Definitions' }).getByRole('row', { name: /Much later/ });

    await row.getByRole('button', { name: 'Suspend Job Definition' }).click();
    await page.getByRole('dialog', { name: 'Suspend Job Definition' }).getByRole('button', { name: 'Suspend' }).click();
    await expect(row.getByText('Suspended')).toBeVisible();
    expect((await jobDefinition()).suspended).toBe(true);

    await row.getByRole('button', { name: 'Activate Job Definition' }).click();
    await page.getByRole('dialog', { name: 'Activate Job Definition' }).getByRole('button', { name: 'Activate' }).click();
    await expect(row.getByText('Active')).toBeVisible();
    expect((await jobDefinition()).suspended).toBe(false);

    await row.getByRole('button', { name: 'Change Overriding Job Priority' }).click();
    const dialog = page.getByRole('dialog', { name: 'Change Overriding Job Priority' });
    await dialog.getByLabel('Priority').fill('70');
    await dialog.getByRole('button', { name: 'Override' }).click();
    await expect(row.getByRole('cell', { name: '70' })).toBeVisible();
    expect((await jobDefinition()).overridingJobPriority).toBe(70);
    await engine.put(`/job-definition/${(await jobDefinition()).id}/jobPriority`, { priority: null });
  });

  test('changes the history time to live of a process definition', async ({ page, request }) => {
    const engine = new Engine(request);
    const timeToLive = async () => (await engine.get<{ historyTimeToLive: number | null }>('/process-definition/key/e2e-parent')).historyTimeToLive;
    await engine.put('/process-definition/key/e2e-parent/history-time-to-live', { historyTimeToLive: 5 });
    await definitionPage(page, engine, 'e2e-parent');

    await page.getByRole('button', { name: 'Edit History Time To Live value' }).click();
    const dialog = page.getByRole('dialog', { name: 'Edit History Time To Live value' });
    await dialog.getByRole('spinbutton').fill('9');
    await dialog.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByRole('complementary').getByText('9 days')).toBeVisible();
    expect(await timeToLive()).toBe(9);
    await engine.put('/process-definition/key/e2e-parent/history-time-to-live', { historyTimeToLive: 5 });
  });

  test('shows a decision table, and in an evaluation the rule that fired with its values', async ({ page, request }) => {
    const engine = new Engine(request);
    await engine.post('/decision-definition/key/e2e-discount/evaluate', { variables: { amount: { value: 1500, type: 'Double' } } });
    const [evaluation] = await engine.get<{ id: string }[]>('/history/decision-instance?decisionDefinitionKey=e2e-discount&sortBy=evaluationTime&sortOrder=desc&maxResults=1');

    await open(page, `${COCKPIT}/decisions`);
    await page.getByRole('link', { name: 'E2E Discount', exact: true }).click();
    const table = page.locator('.cz-dmn-viewer');
    await expect(table.getByText('Order amount')).toBeVisible();
    await expect(table.getByText('>= 1000')).toBeVisible();

    await page.getByRole('link', { name: evaluation.id }).click();
    await expect(page).toHaveURL(new RegExp(`decision-instance/${evaluation.id}`));
    const fired = page.locator('.cz-dmn-viewer tr.cz-dmn-fired');
    await expect(fired).toHaveCount(1);
    await expect(fired).toContainText('>= 1000');
    await expect(page.locator('.cz-dmn-viewer .cz-dmn-input')).toHaveText(/= 1500/);
    await expect(page.locator('.cz-dmn-viewer .cz-dmn-output')).toHaveText(/= 10/);

    await expect(page.getByRole('tabpanel', { name: 'Inputs' }).getByRole('row', { name: /1500/ })).toBeVisible();
    await page.getByRole('tab', { name: 'Outputs' }).click();
    await expect(page.getByRole('tabpanel', { name: 'Outputs' }).getByRole('row', { name: /Discount in percent Integer 10/ })).toBeVisible();
  });

  test('shows the resources of a deployment and deletes the deployment', async ({ page, request }) => {
    const engine = new Engine(request);
    // a deployment of its own, to look at and to delete: a process with a drawing and a decision
    const name = runKey('e2e-throwaway');
    const multipart: Record<string, string | { name: string; mimeType: string; buffer: Buffer }> = { 'deployment-name': name };
    for (const resource of ['e2e-wait.bpmn', 'e2e-discount.dmn']) {
      const content = RESOURCES[resource].replaceAll('e2e-wait', `${name}-wait`).replaceAll('e2e-discount', `${name}-discount`).replaceAll('e2e-decisions', `${name}-decisions`);
      multipart[resource] = { name: resource, mimeType: 'application/octet-stream', buffer: Buffer.from(content) };
    }
    const deployed = await request.post(`${REST}/deployment/create`, { multipart });
    expect(deployed.status()).toBe(200);
    const deploymentId = (await deployed.json()).id as string;
    await engine.start(`${name}-wait`, name);

    await open(page, `${COCKPIT}/repository`);
    const deployments = page.getByRole('region', { name: 'Deployments' });
    const item = deployments.getByRole('listitem').filter({ hasText: name });
    await item.getByRole('button', { name: new RegExp(`^${name}`) }).click();

    // its resources: the process as a diagram, the decision as a table
    await page.getByText('e2e-wait.bpmn', { exact: true }).click();
    await expect(page.locator('.djs-container [data-element-id="later"]')).toBeVisible();
    await page.getByText('e2e-discount.dmn', { exact: true }).click();
    await expect(page.locator('.cz-dmn-viewer').getByText('Order amount')).toBeVisible();

    await item.getByRole('button', { name: 'Delete Deployment' }).click();
    const dialog = page.getByRole('dialog', { name: `Delete Deployment: ${name}` });
    // an instance is running: the deployment goes only with everything that belongs to it
    await expect(dialog.getByRole('button', { name: 'Delete', exact: true })).toBeDisabled();
    await dialog.locator('label', { hasText: /^Cascade/ }).click();
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(deployments.getByText(name)).toHaveCount(0);
    expect((await request.get(`${REST}/deployment/${deploymentId}`)).status()).toBe(404);
    expect(await engine.get<unknown[]>(`/process-instance?businessKey=${name}`)).toHaveLength(0);
  });

  test('shows the tenant of a process, and the same process of another tenant apart from it', async ({ page, request }) => {
    const engine = new Engine(request);
    // the same process for two tenants (ids of letters and digits, as the engine wants them)
    const stamp = Date.now().toString(36);
    const tenants = [`e2etenanta${stamp}`, `e2etenantb${stamp}`];
    const key = `e2e-tenant-${stamp}`;
    const deployments: string[] = [];
    try {
      for (const tenant of tenants) {
        const deployed = await request.post(`${REST}/deployment/create`, {
          multipart: {
            'deployment-name': `${key}-${tenant}`,
            'tenant-id': tenant,
            file: { name: 'e2e-wait.bpmn', mimeType: 'application/octet-stream', buffer: Buffer.from(RESOURCES['e2e-wait.bpmn'].replaceAll('e2e-wait', key)) },
          },
        });
        expect(deployed.status()).toBe(200);
        deployments.push((await deployed.json()).id);
      }
      const instance = (await engine.post<{ id: string }>(`/process-definition/key/${key}/tenant-id/${tenants[1]}/start`, { businessKey: key }))!.id;

      // the list has the process once per tenant
      await open(page, `${COCKPIT}/processes`);
      const rows = page.getByRole('row').filter({ hasText: key });
      await expect(rows).toHaveCount(2);
      await expect(rows.filter({ hasText: tenants[0] })).toHaveCount(1);
      await expect(rows.filter({ hasText: tenants[1] })).toContainText('1');

      // the definition of the second tenant, with its instance
      await rows.filter({ hasText: tenants[1] }).getByRole('link').click();
      const facts = page.getByRole('complementary');
      await expect(facts.getByText(tenants[1], { exact: true })).toBeVisible();
      await page.getByRole('tabpanel', { name: 'Process Instances' }).getByRole('link', { name: instance }).click();
      await expect(page.getByRole('complementary').getByText(tenants[1], { exact: true })).toBeVisible();
    } finally {
      for (const id of deployments) {
        await engine.delete(`/deployment/${id}?cascade=true&skipCustomListeners=true`);
      }
    }
  });

  test('counts the human tasks as the engine does', async ({ page, request }) => {
    const engine = new Engine(request);
    const count = async (query: string) => (await engine.get<{ count: number }>(`/task/count?${query}`)).count;

    await open(page, `${COCKPIT}/tasks`);
    const byType = page.getByRole('table').first();

    await expect(byType.getByRole('row', { name: /Total/ })).toContainText(String(await count('')));
    await expect(byType.getByRole('row', { name: /assigned to a user/ }).first()).toContainText(String(await count('assigned=true')));
    await expect(byType.getByRole('row', { name: /unassigned/ })).toContainText(String(await count('unassigned=true&withoutCandidateGroups=true')));
  });

  test('runs a batch and shows it among the finished ones', async ({ page, request }) => {
    const engine = new Engine(request);
    const key = runKey('cockpit-batch');
    const instances = [await engine.start('e2e-plain', key), await engine.start('e2e-plain', key)];
    const batch = await engine.post<{ id: string }>('/process-instance/delete', { processInstanceIds: instances, deleteReason: 'e2e batch', skipCustomListeners: true });

    // the job executor of the distribution works the batch off
    await expect.poll(async () => (await engine.get<{ count: number }>(`/history/batch/count?batchId=${batch!.id}&completed=true`)).count, { timeout: 60_000 }).toBe(1);
    expect(await engine.state(instances[0])).toBe('EXTERNALLY_TERMINATED');

    await open(page, `${COCKPIT}/batch`);
    await expect(page.getByRole('heading', { name: 'Batches', level: 1 })).toBeVisible();
    await expect(page.getByText(batch!.id).first()).toBeVisible();
  });
});
