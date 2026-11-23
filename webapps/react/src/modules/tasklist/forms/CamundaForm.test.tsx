import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '../../../app/query-client';
import { initI18n } from '../../../shared/i18n';
import type { Variables } from '../../../shared/variables';
import { json } from '../../../test/app';
import CamundaForm from './CamundaForm';
import type { FormTarget } from './target';

beforeAll(() => initI18n('en'));

beforeEach(() => localStorage.clear());

afterEach(() => vi.unstubAllGlobals());

const ENGINE = '/api/engine/engine/default';
const FORM_URL = `${ENGINE}/task/t-1/deployed-form`;

/** A Camunda Form with a required text field, a number and a checkbox. */
const schema = {
  type: 'default',
  id: 'approve',
  schemaVersion: 16,
  components: [
    { type: 'textfield', id: 'f-creditor', key: 'creditor', label: 'Creditor', validate: { required: true } },
    { type: 'number', id: 'f-amount', key: 'amount', label: 'Amount' },
    { type: 'checkbox', id: 'f-approved', key: 'approved', label: 'Approved' },
  ],
};

const variables: Variables = {
  creditor: { type: 'String', value: 'Great Pizza for Everyone Inc.', valueInfo: {} },
  amount: { type: 'Double', value: 30, valueInfo: {} },
};

const task: FormTarget = { kind: 'task', taskId: 't-1', processInstanceId: 'pi-1' };

function fakeBackend(form: unknown = schema) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const path = url.split('?')[0];
      if (path === FORM_URL) {
        return form ? json(form) : json({ message: 'The form could not be found' }, 404);
      }
      if (path.endsWith('/form-variables')) {
        return json(variables);
      }
      return json({}, 404);
    }),
  );
}

/** Types into a field of the form: form-js takes the value on input and applies it on blur at the latest. */
function enter(field: HTMLElement, value: string) {
  fireEvent.input(field, { target: { value } });
  fireEvent.blur(field);
}

function renderForm(props: { target?: FormTarget; disabled?: boolean } = {}) {
  const submit = vi.fn(async () => true);
  const view = render(
    <QueryClientProvider client={createQueryClient()}>
      <CamundaForm
        engine="default"
        target={props.target ?? task}
        url={FORM_URL}
        disabled={props.disabled ?? false}
        submitting={false}
        submitLabel="Complete"
        submit={submit}
      />
    </QueryClientProvider>,
  );
  return { submit, ...view };
}

describe('a Camunda Form in the Tasklist', () => {
  it('shows the variables of the task and completes it with what the user entered', async () => {
    fakeBackend();
    const { submit } = renderForm();
    const user = userEvent.setup();

    const creditor = await screen.findByLabelText(/Creditor/);
    expect(creditor).toHaveValue('Great Pizza for Everyone Inc.');
    expect(screen.getByLabelText('Amount')).toHaveValue('30');

    enter(creditor, 'Bobs Burgers');
    await user.click(screen.getByLabelText('Approved'));
    await user.click(screen.getByRole('button', { name: 'Complete' }));

    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit).toHaveBeenCalledWith({ creditor: { value: 'Bobs Burgers' }, amount: { value: 30 }, approved: { value: true } });
  });

  it('does not complete the task while a required field is empty', async () => {
    fakeBackend();
    const { submit } = renderForm();
    const user = userEvent.setup();

    enter(await screen.findByLabelText(/Creditor/), '');
    await user.click(screen.getByRole('button', { name: 'Complete' }));

    expect(await screen.findByText('Field is required.')).toBeInTheDocument();
    expect(submit).not.toHaveBeenCalled();
  });

  it('keeps a draft in the browser and drops it once the task is completed', async () => {
    fakeBackend();
    const first = renderForm();
    const user = userEvent.setup();

    // nothing to save before the user changed something
    await screen.findByLabelText(/Creditor/);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    enter(screen.getByLabelText(/Creditor/), 'Draft Ltd.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // saving is not completing
    expect(first.submit).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('camunda-form:t-1')!)).toMatchObject({ creditor: 'Draft Ltd.' });
    first.unmount();

    // the draft is back when the task is opened again
    const second = renderForm();
    expect(await screen.findByLabelText(/Creditor/)).toHaveValue('Draft Ltd.');
    await user.click(screen.getByRole('button', { name: 'Complete' }));

    await waitFor(() => expect(second.submit).toHaveBeenCalled());
    await waitFor(() => expect(localStorage.getItem('camunda-form:t-1')).toBeNull());
  });

  it('offers no draft for the start form of a process', async () => {
    fakeBackend();
    renderForm({ target: { kind: 'start', processDefinitionId: 'invoice:2', processDefinitionKey: 'invoice' } });

    await screen.findByLabelText(/Creditor/);
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('cannot be filled in or sent by somebody who is not the assignee', async () => {
    fakeBackend();
    renderForm({ disabled: true });

    expect(await screen.findByLabelText(/Creditor/)).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Complete' })).toBeDisabled();
  });

  it('reports a form that cannot be loaded', async () => {
    fakeBackend(null);
    renderForm();

    expect(await screen.findByText('Form failure:')).toBeInTheDocument();
    expect(screen.getByText('The form could not be found')).toBeInTheDocument();
  });
});
