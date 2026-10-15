import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { initI18n } from '../shared/i18n';
import { useNotifications } from '../shared/notifications';
import { json, logIn, renderApp } from '../test/app';

// the settings of the classic tasklist/scripts/config.js, per test
const classicConfig = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('../shared/classic-config', () => ({ importClassicConfig: async () => classicConfig.value }));

const task = {
  id: 't1',
  name: 'Approve Invoice',
  assignee: null,
  created: '2026-10-13T08:49:55.851+0000',
  description: 'Check the invoice amount.',
  processDefinitionId: 'invoice:1',
  priority: 50,
  taskDefinitionKey: 'approveInvoice',
};
const invoice = { id: 'invoice:1', key: 'invoice', name: 'Invoice Receipt', version: 1 };
/** Assigned to demo, no form key: generic form. */
const myTask = { ...task, id: 't2', name: 'Check order', assignee: 'demo', processInstanceId: 'pi2' };
/** Assigned to demo, embedded HTML form of a process application. */
const embeddedTask = { ...myTask, id: 't3', name: 'Approve amount', processInstanceId: 'pi3' };
const embeddedForm = `
<form>
  <input cam-variable-name="amount" cam-variable-type="Double" name="amount" aria-label="Amount" />
  <input cam-variable-name="approved" cam-variable-type="Boolean" type="checkbox" name="approved" aria-label="Approved" />
  <p id="creditor"></p>
  <script cam-script type="text/form-script">
    camForm.on('form-loaded', function () { camForm.variableManager.fetchVariable('creditor'); });
    camForm.on('variables-fetched', function () {
      $('#creditor', camForm.formElement).text('Creditor: ' + camForm.variableManager.variableValue('creditor'));
    });
  </script>
</form>`;

/** A minimal backend: login with demo/demo, one filter with one task. */
function fakeBackend() {
  let loggedIn = false;
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const path = url.split('?')[0];
    if (path === '/api/admin/auth/user/default') {
      return loggedIn ? json({ userId: 'demo', authorizedApps: ['cockpit', 'tasklist', 'welcome'] }) : json({}, 404);
    }
    if (/^\/api\/admin\/auth\/user\/default\/login\/\w+$/.test(path) && method === 'POST') {
      loggedIn = new URLSearchParams(String(init.body)).get('password') === 'demo';
      return loggedIn ? json({ userId: 'demo', authorizedApps: ['cockpit', 'tasklist', 'welcome'] }) : json({}, 401);
    }
    if (path === '/api/engine/engine/default/user/demo/profile') {
      return json({ id: 'demo', firstName: 'Demo', lastName: 'User' });
    }
    if (path === '/api/engine/engine/default/filter') {
      return json([{ id: 'f1', name: 'My tasks', properties: {}, itemCount: 1 }]);
    }
    if (path === '/api/engine/engine/default/filter/f1/list' && method === 'POST') {
      return json({ count: 1, _embedded: { task: [task], processDefinition: [invoice] } });
    }
    if (path === '/api/engine/engine/default/task/t1') {
      return json({ ...task, _embedded: { processDefinition: [invoice], user: [] } });
    }
    if (path === '/api/engine/engine/default/task/t2') {
      return json({ ...myTask, _embedded: { processDefinition: [invoice], user: [] } });
    }
    if (path === '/api/engine/engine/default/task/t2/form') {
      return json({ key: null, contextPath: null, camundaFormRef: null });
    }
    if (path === '/api/engine/engine/default/process-instance/pi2') {
      return json({ id: 'pi2', businessKey: 'ORDER-1' });
    }
    if (path === '/api/engine/engine/default/task/t2/submit-form' && method === 'POST') {
      return new Response(null, { status: 204 });
    }
    if (path === '/api/engine/engine/default/task/t3') {
      return json({ ...embeddedTask, _embedded: { processDefinition: [invoice], user: [] } });
    }
    if (path === '/api/engine/engine/default/task/t3/form') {
      return json({ key: 'embedded:app:forms/approve.html', contextPath: '/invoice', camundaFormRef: null });
    }
    if (path === '/invoice/forms/approve.html') {
      return new Response(embeddedForm, { status: 200 });
    }
    if (path === '/api/engine/engine/default/task/t3/form-variables') {
      return json({
        amount: { type: 'Double', value: 10.5 },
        approved: { type: 'Boolean', value: false },
        creditor: { type: 'String', value: 'ACME' },
      });
    }
    if (path === '/api/engine/engine/default/task/t3/submit-form' && method === 'POST') {
      return new Response(null, { status: 204 });
    }
    if (path === '/api/engine/engine/default/process-definition') {
      return json([{ id: 'order:1', key: 'order', name: 'Order', version: 1, tenantId: null }]);
    }
    if (path === '/api/engine/engine/default/process-definition/count') {
      return json({ count: 1 });
    }
    if (path === '/api/engine/engine/default/process-definition/order%3A1/startForm') {
      return json({ key: null, contextPath: null, camundaFormRef: null });
    }
    if (path === '/api/engine/engine/default/process-definition/order%3A1/submit-form' && method === 'POST') {
      return json({ id: 'pi9' });
    }
    if (path === '/api/engine/engine/default/task' && method === 'GET') {
      // tasks assigned to demo in the process just started
      const query = new URLSearchParams(url.split('?')[1]);
      return json(query.get('processInstanceId') === 'pi9' && query.get('assignee') === 'demo' ? [{ id: 't2', name: 'Ship Order', taskDefinitionKey: 'ship' }] : []);
    }
    if (path === '/api/engine/engine/default/task/create' && method === 'POST') {
      return new Response(null, { status: 204 });
    }
    if (path === '/api/engine/engine/default/task/t2/comment/create' && method === 'POST') {
      return json({ id: 'c1' });
    }
    return json({ message: `unexpected ${method} ${url}` }, 500);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeAll(() => initI18n('en'));
afterEach(() => {
  vi.unstubAllGlobals();
  useNotifications.setState({ notifications: [] });
  classicConfig.value = {};
});

describe('webapp shell', () => {
  it('logs in, selects the first filter and opens a task', async () => {
    fakeBackend();
    const history = renderApp('/app/react/tasklist/default');

    const user = await logIn();

    expect(await screen.findByText('Approve Invoice')).toBeInTheDocument();
    expect(screen.getByText('My tasks')).toBeInTheDocument();
    expect(history.location.search).toContain('filter=f1');

    await user.click(screen.getByText('Approve Invoice'));

    expect(await screen.findByRole('button', { name: 'Claim' })).toBeInTheDocument();
    expect(history.location.search).toContain('task=t1');

    // tabs render when selected; the selection goes into the URL
    await user.click(screen.getByRole('tab', { name: 'Description' }));
    expect(await screen.findByText('Check the invoice amount.')).toBeInTheDocument();
    expect(history.location.search).toContain('detailsTab=description');
  });

  it('completes a task with the generic form', async () => {
    const fetchMock = fakeBackend();
    const history = renderApp('/app/react/tasklist/default?filter=f1&task=t2');
    const user = await logIn();

    expect(await screen.findByDisplayValue('ORDER-1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add a variable' }));
    await user.type(screen.getByLabelText('Name'), 'note');
    await user.selectOptions(screen.getByLabelText('Type'), 'String');
    await user.type(screen.getByLabelText('Value'), 'hi');
    await user.click(screen.getByRole('button', { name: 'Complete' }));

    expect(await screen.findByText('The task is completed.')).toBeInTheDocument();
    const submit = fetchMock.mock.calls.find(([url]) => url.endsWith('/task/t2/submit-form'));
    expect(JSON.parse(String(submit?.[1]?.body))).toEqual({ variables: { note: { type: 'String', value: 'hi' } } });
    expect(history.location.search).not.toContain('task=');
  });

  it('completes a task with an embedded HTML form', async () => {
    const fetchMock = fakeBackend();
    renderApp('/app/react/tasklist/default?filter=f1&task=t3');
    const user = await logIn();

    // values from the engine, and a form script using camForm and jQuery
    const amount = await screen.findByDisplayValue('10.5');
    expect(await screen.findByText('Creditor: ACME')).toBeInTheDocument();

    // a value that is not a Double stops the completion
    await user.clear(amount);
    await user.type(amount, 'abc');
    await user.click(screen.getByRole('button', { name: 'Complete' }));
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/task/t3/submit-form'))).toBe(false);

    await user.clear(amount);
    await user.type(amount, '12');
    await user.click(screen.getByLabelText('Approved'));
    await user.click(screen.getByRole('button', { name: 'Complete' }));

    expect(await screen.findByText('The task is completed.')).toBeInTheDocument();
    const submit = fetchMock.mock.calls.find(([url]) => url.endsWith('/task/t3/submit-form'));
    // changed fields, plus variables a script fetched without a field (as the old runtime did)
    expect(JSON.parse(String(submit?.[1]?.body)).variables).toEqual({
      amount: { value: 12, type: 'Double' },
      approved: { value: true, type: 'Boolean' },
      creditor: { value: 'ACME', type: 'String' },
    });
    // loads the embedded-form runtime lazily; slow on a cold first run
  }, 20_000);

  it('starts a process with a business key', async () => {
    const fetchMock = fakeBackend();
    const history = renderApp('/app/react/tasklist/default?filter=f1');
    const user = await logIn();

    await user.click(await screen.findByRole('button', { name: 'Start process' }));
    await user.click(await screen.findByText('Order'));
    expect(history.location.search).toContain('processStart=order');

    await user.type(await screen.findByLabelText('Business Key'), 'ORDER-1');
    await user.click(screen.getByRole('button', { name: 'Start' }));

    expect(await screen.findByText('The process has been started.')).toBeInTheDocument();
    const submit = fetchMock.mock.calls.find(([url]) => url.endsWith('/process-definition/order%3A1/submit-form'));
    expect(JSON.parse(String(submit?.[1]?.body))).toEqual({ variables: {}, businessKey: 'ORDER-1' });
    expect(history.location.search).not.toContain('processStart');

    // the next task of the process is assigned to demo: the message opens it
    expect(await screen.findByText('You are assigned to the following tasks in the same process')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ship Order' }));
    expect(history.location.search).toContain('task=t2');
  });

  it('creates a standalone task', async () => {
    const fetchMock = fakeBackend();
    renderApp('/app/react/tasklist/default?filter=f1');
    const user = await logIn();

    await user.click(await screen.findByRole('button', { name: 'Create task' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Create task' }));
    expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();
    await user.type(dialog.getByLabelText('Name'), 'Call the customer');
    await user.type(dialog.getByLabelText('Assignee'), 'demo');
    await user.click(dialog.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Create task' })).not.toBeInTheDocument());
    const create = fetchMock.mock.calls.find(([url]) => url.endsWith('/task/create'));
    expect(JSON.parse(String(create?.[1]?.body))).toEqual({
      name: 'Call the customer',
      assignee: 'demo',
      tenantId: null,
      description: null,
      priority: 50,
    });
  });

  it('has keyboard shortcuts, and lists them', async () => {
    fakeBackend();
    renderApp('/app/react/tasklist/default?filter=f1');
    const user = await logIn();
    await screen.findByText('Approve Invoice');

    await user.keyboard('{Control>}{Alt>}l{/Alt}{/Control}');
    expect(screen.getByText('Approve Invoice').closest('button')).toHaveFocus();

    await user.keyboard('{Control>}{Alt>}p{/Alt}{/Control}');
    expect(await screen.findByText('Order')).toBeVisible();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Keyboard Shortcuts' }));
    const help = within(await screen.findByRole('dialog', { name: 'Keyboard Shortcuts' }));
    expect(help.getByText('Ctrl + Alt + P')).toBeInTheDocument();
    expect(help.getByText('Opens the start process dialog')).toBeInTheDocument();
  });

  it('rejects wrong credentials', async () => {
    fakeBackend();
    renderApp('/app/react/tasklist/default');

    await logIn('wrong');

    expect(await screen.findByText('Login Failed')).toBeInTheDocument();
  });
});

describe('tasklist with the settings of the classic config.js', () => {
  it('takes the shortcut keys and comments with the process instance', async () => {
    classicConfig.value = {
      shortcuts: {
        // the config.js the classic Tasklist ships: its descriptions keep the translations
        claimTask: { key: 'ctrl+alt+c', description: 'claims the currently selected task' },
        startProcess: { key: 'ctrl+alt+s', description: 'starts a process' },
      },
      assignProcessInstanceIdToTaskComment: true,
    };
    const fetchMock = fakeBackend();
    renderApp('/app/react/tasklist/default?filter=f1&task=t2');
    const user = await logIn();
    expect(await screen.findByRole('heading', { name: 'Check order' })).toBeInTheDocument();

    await user.keyboard('{Control>}{Alt>}s{/Alt}{/Control}');
    expect(await screen.findByText('Order')).toBeVisible();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Keyboard Shortcuts' }));
    const help = within(await screen.findByRole('dialog', { name: 'Keyboard Shortcuts' }));
    expect(help.getByText('Ctrl + Alt + S')).toBeInTheDocument();
    expect(help.getByText('starts a process')).toBeInTheDocument();
    expect(help.getByText('Claims the selected task')).toBeInTheDocument();
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Add Comment' }));
    const comment = within(await screen.findByRole('dialog', { name: 'Add Comment' }));
    await user.type(comment.getByLabelText('Comment'), 'Looks good');
    await user.click(comment.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => url.endsWith('/task/t2/comment/create'))).toBe(true),
    );
    const created = fetchMock.mock.calls.find(([url]) => url.endsWith('/task/t2/comment/create'));
    expect(JSON.parse(String(created?.[1]?.body))).toEqual({ message: 'Looks good', processInstanceId: 'pi2' });
  });
});
