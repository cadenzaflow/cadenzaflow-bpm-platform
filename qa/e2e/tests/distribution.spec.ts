import { expect, test } from '@playwright/test';
import { Engine, SERVER, runKey } from './support';

const WEBAPP = `${SERVER}/cadenzaflow`;
const APPS = ['cockpit', 'tasklist', 'admin', 'welcome'];

test.describe('the distribution', () => {
  test('reports the version it was built as', async ({ request }) => {
    const version = (await new Engine(request).get<{ version: string }>('/version')).version;

    expect(version).toMatch(/^\d+\.\d+\.\d+/);
    // the build tells which version it made (E2E_VERSION), so a distribution of another build fails here
    if (process.env.E2E_VERSION) {
      expect(version).toBe(process.env.E2E_VERSION);
    }
  });

  test('has the process engine with the invoice example', async ({ request }) => {
    const engine = new Engine(request);

    expect((await engine.get<{ name: string }[]>('/engine')).map((e) => e.name)).toContain('default');
    expect(await engine.get<unknown[]>('/process-definition?key=invoice&latestVersion=true')).toHaveLength(1);
    expect(await engine.get<unknown[]>('/decision-definition?key=invoice-assign-approver&latestVersion=true')).toHaveLength(1);
  });

  test('runs a process from a user task over a gateway and an external task to its end', async ({ request }) => {
    const engine = new Engine(request);
    const key = runKey('distribution');
    const instance = await engine.start('e2e-order', key, { customer: { value: 'ACME' } });

    const [task] = await engine.tasks(instance);
    expect(task.name).toBe('Check order');
    await engine.post(`/task/${task.id}/complete`, { variables: { approved: { value: true, type: 'Boolean' } } });

    // the gateway took the path of the approved order: an external task waits for a worker
    const locked = await engine.post<{ id: string; businessKey: string }[]>('/external-task/fetchAndLock', {
      workerId: 'e2e',
      maxTasks: 1,
      topics: [{ topicName: 'e2e-ship', lockDuration: 60_000, businessKey: key }],
    });
    expect(locked).toHaveLength(1);
    await engine.post(`/external-task/${locked![0].id}/complete`, { workerId: 'e2e', variables: { shipped: { value: true } } });

    expect(await engine.state(instance)).toBe('COMPLETED');
    const ended = await engine.get<{ activityId: string }[]>(`/history/activity-instance?processInstanceId=${instance}&activityType=noneEndEvent`);
    expect(ended.map((activity) => activity.activityId)).toEqual(['shipped']);
  });

  test('takes the other path of the gateway when the order is not approved', async ({ request }) => {
    const engine = new Engine(request);
    const instance = await engine.start('e2e-order', runKey('distribution'));

    const [task] = await engine.tasks(instance);
    await engine.post(`/task/${task.id}/complete`, { variables: { approved: { value: false, type: 'Boolean' } } });

    expect(await engine.state(instance)).toBe('COMPLETED');
    const ended = await engine.get<{ activityId: string }[]>(`/history/activity-instance?processInstanceId=${instance}&activityType=noneEndEvent`);
    expect(ended.map((activity) => activity.activityId)).toEqual(['rejected']);
  });

  test('evaluates a decision table', async ({ request }) => {
    const engine = new Engine(request);

    const large = await engine.post<{ discount: { value: number } }[]>('/decision-definition/key/e2e-discount/evaluate', {
      variables: { amount: { value: 1500, type: 'Double' } },
    });
    const small = await engine.post<{ discount: { value: number } }[]>('/decision-definition/key/e2e-discount/evaluate', {
      variables: { amount: { value: 20, type: 'Double' } },
    });

    expect(large![0].discount.value).toBe(10);
    expect(small![0].discount.value).toBe(0);
  });

  test('starts a called process and ends with it', async ({ request }) => {
    const engine = new Engine(request);
    const parent = await engine.start('e2e-parent', runKey('distribution'));

    const [called] = await engine.get<{ id: string }[]>(`/process-instance?superProcessInstance=${parent}`);
    const [task] = await engine.tasks(called.id);
    expect(task.name).toBe('Review request');
    await engine.post(`/task/${task.id}/complete`);

    expect(await engine.state(called.id)).toBe('COMPLETED');
    expect(await engine.state(parent)).toBe('COMPLETED');
  });

  test('creates a timer job for a waiting process and runs it on demand', async ({ request }) => {
    const engine = new Engine(request);
    const instance = await engine.start('e2e-wait', runKey('distribution'));

    const [job] = await engine.get<{ id: string; dueDate: string }[]>(`/job?processInstanceId=${instance}`);
    expect(new Date(job.dueDate).getFullYear()).toBeGreaterThan(new Date().getFullYear() + 8);
    await engine.post(`/job/${job.id}/execute`);

    expect(await engine.state(instance)).toBe('COMPLETED');
  });

  for (const app of APPS) {
    test(`serves the classic ${app} and the React ${app}`, async ({ request }) => {
      const classic = await request.get(`${WEBAPP}/app/${app}/default/`);
      expect(classic.status()).toBe(200);
      expect(await classic.text()).toContain('<html');

      const react = await request.get(`${WEBAPP}/app/react/${app}/default/`);
      expect(react.status()).toBe(200);
      const html = await react.text();
      // the server filled in the placeholders of the page
      expect(html).not.toContain('$APP_ROOT');
      expect(html).not.toContain('$CSP_NONCE');
      expect(html).not.toContain('$PLUGINS');

      // what the page loads is there
      const assets = [...html.matchAll(/(?:src|href)="([^"]*\/app\/react\/assets\/[^"]+)"/g)].map((match) => match[1]);
      expect(assets.length).toBeGreaterThan(0);
      for (const asset of assets) {
        const file = await request.get(`${SERVER}${asset}`);
        expect(file.status(), asset).toBe(200);
        expect((await file.body()).length, asset).toBeGreaterThan(1000);
      }
    });
  }

  test('sends the security headers with the webapps', async ({ request }) => {
    for (const path of ['app/cockpit/default/', 'app/react/cockpit/default/']) {
      const headers = (await request.get(`${WEBAPP}/${path}`)).headers();

      expect(headers['content-security-policy'], path).toContain("'strict-dynamic'");
      expect(headers['content-security-policy'], path).toMatch(/'nonce-[-_a-zA-Z\d]+'/);
      expect(headers['x-content-type-options'], path).toBe('nosniff');
      expect(headers['x-xss-protection'], path).toBe('1; mode=block');
    }
  });

  test('gives the webapp API to a session only, and ends the session on logout', async ({ playwright }) => {
    // a client of its own: its cookies are the session
    const client = await playwright.request.newContext({ extraHTTPHeaders: { Accept: 'application/json' } });
    const user = `${WEBAPP}/api/admin/auth/user/default`;
    const token = async () => (await client.storageState()).cookies.find((cookie) => cookie.name === 'XSRF-TOKEN')?.value ?? '';

    await client.get(`${WEBAPP}/app/cockpit/default/`);
    expect((await client.get(user)).status()).toBe(404);
    expect((await client.get(`${WEBAPP}/api/engine/engine/default/process-definition/count`)).status()).toBe(401);

    // a request that changes something needs the CSRF token of the session
    const withoutToken = await client.post(`${user}/login/cockpit`, { form: { username: 'demo', password: 'demo' } });
    expect(withoutToken.status()).toBe(403);
    // the refused request ended the session: a new page, a new token
    await client.get(`${WEBAPP}/app/cockpit/default/`);

    const wrong = await client.post(`${user}/login/cockpit`, { form: { username: 'demo', password: 'wrong' }, headers: { 'X-XSRF-TOKEN': await token() } });
    expect(wrong.status()).toBe(401);

    // the engine delays the next attempt after a wrong password
    await expect(async () => {
      const login = await client.post(`${user}/login/cockpit`, { form: { username: 'demo', password: 'demo' }, headers: { 'X-XSRF-TOKEN': await token() } });
      expect(login.status()).toBe(200);
      expect((await login.json()).authorizedApps).toEqual(expect.arrayContaining(['cockpit', 'tasklist', 'admin']));
    }).toPass({ timeout: 30_000 });

    expect((await (await client.get(user)).json()).userId).toBe('demo');
    expect((await client.get(`${WEBAPP}/api/engine/engine/default/process-definition/count`)).status()).toBe(200);
    expect((await client.get(`${WEBAPP}/api/cockpit/plugin/base/default/process-definition/statistics-count`)).status()).toBe(200);

    const logout = await client.post(`${user}/logout`, { headers: { 'X-XSRF-TOKEN': await token() } });
    expect([200, 204]).toContain(logout.status());
    expect((await client.get(user)).status()).toBe(404);
    await client.dispose();
  });
});
