import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '../../../app/query-client';
import { initI18n } from '../../../shared/i18n';
import { json } from '../../../test/app';
import type { TaskFilter } from '../api';
import type { Authorization } from './api';
import { FilterModal } from './FilterModal';

beforeAll(() => initI18n('en'));

afterEach(() => vi.unstubAllGlobals());

// whole dialogs are typed in: that takes its time when the tests of the build run in parallel
vi.setConfig({ testTimeout: 40_000 });

const ENGINE = '/api/engine/engine/default';

interface Call {
  method: string;
  path: string;
  body: unknown;
}

/** The filter and authorization resources of the engine; records what the dialog sends. */
function fakeBackend(authorizations: Authorization[] | 'forbidden' = []) {
  const calls: Call[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET';
      const path = url.split('?')[0];
      if (method !== 'GET') {
        calls.push({ method, path, body: init.body ? JSON.parse(String(init.body)) : undefined });
      }
      if (path === `${ENGINE}/authorization` && method === 'GET') {
        return authorizations === 'forbidden'
          ? json({ type: 'AuthorizationException', message: 'not allowed' }, 403)
          : json(authorizations);
      }
      if (path === `${ENGINE}/filter/create`) {
        return json({ id: 'f-new' });
      }
      return new Response(null, { status: 204 });
    }),
  );
  return calls;
}

function renderModal(filter: TaskFilter | null) {
  const handlers = { onClose: vi.fn(), onSaved: vi.fn(), onDeleted: vi.fn() };
  render(
    <QueryClientProvider client={createQueryClient()}>
      <FilterModal engine="default" filter={filter} {...handlers} />
    </QueryClientProvider>,
  );
  return handlers;
}

const myTasks: TaskFilter = {
  id: 'f-1',
  name: 'My tasks',
  owner: 'demo',
  query: { assigneeExpression: '${ currentUser() }', candidateGroups: ['sales', 'accounting'], includeAssignedTasks: true },
  properties: { priority: 5, color: '#ff0000', description: 'Mine', refresh: true, variables: [{ name: 'amount', label: 'Amount' }] },
};

const grant = (id: string, identity: { userId?: string; groupId?: string }, permissions = ['READ']): Authorization => ({
  id,
  type: 1,
  permissions,
  userId: identity.userId ?? null,
  groupId: identity.groupId ?? null,
  resourceType: 5,
  resourceId: 'f-1',
});

describe('FilterModal', () => {
  it('creates a filter with criteria, a shown variable and read permissions', async () => {
    const calls = fakeBackend();
    const { onSaved } = renderModal(null);
    const user = userEvent.setup({ delay: null });

    await user.type(screen.getByLabelText('Name'), ' Sales ');
    await user.type(screen.getByLabelText('Description'), 'Tasks of sales');
    await user.clear(screen.getByLabelText('Priority'));
    await user.type(screen.getByLabelText('Priority'), '10');
    await user.click(screen.getByLabelText('Auto-Refresh'));

    await user.click(screen.getByRole('button', { name: 'Add criterion' }));
    await user.selectOptions(screen.getAllByLabelText('Key')[0], 'candidateGroups');
    await user.type(screen.getAllByLabelText('Value')[0], 'sales, accounting');
    await user.click(screen.getByLabelText('Include assigned tasks'));
    await user.click(screen.getByRole('button', { name: 'Add criterion' }));
    await user.selectOptions(screen.getAllByLabelText('Key')[1], 'priority');
    await user.type(screen.getAllByLabelText('Value')[1], '50');

    await user.click(screen.getByRole('button', { name: 'Add variable' }));
    await user.type(screen.getByPlaceholderText('Machine name of variable'), 'amount');
    await user.type(screen.getByPlaceholderText('Human readable label'), 'Amount');
    await user.click(screen.getByLabelText('Show undefined variables'));

    await user.selectOptions(screen.getByLabelText('user', { selector: 'select' }), 'group');
    await user.type(screen.getByPlaceholderText('Group ID'), 'sales');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('f-new'));
    expect(calls).toEqual([
      {
        method: 'POST',
        path: `${ENGINE}/filter/create`,
        body: {
          resourceType: 'Task',
          name: 'Sales',
          query: { candidateGroups: ['sales', 'accounting'], priority: 50, includeAssignedTasks: true },
          properties: {
            description: 'Tasks of sales',
            priority: 10,
            color: '#555555',
            refresh: true,
            variables: [{ name: 'amount', label: 'Amount' }],
            showUndefinedVariable: true,
          },
        },
      },
      {
        method: 'POST',
        path: `${ENGINE}/authorization/create`,
        body: { resourceType: 5, resourceId: 'f-new', permissions: ['READ'], type: 1, groupId: 'sales' },
      },
    ]);
  });

  it('saves criteria that match any of them as an OR query', async () => {
    const calls = fakeBackend();
    const { onSaved } = renderModal(null);
    const user = userEvent.setup({ delay: null });

    await user.type(screen.getByLabelText('Name'), 'Open');
    await user.click(screen.getByRole('button', { name: 'Add criterion' }));
    await user.selectOptions(screen.getAllByLabelText('Key')[0], 'unassigned');
    await user.click(screen.getByRole('button', { name: 'Add criterion' }));
    await user.selectOptions(screen.getAllByLabelText('Key')[1], 'assignee');
    await user.type(screen.getAllByLabelText('Value')[0], '${{ currentUser() }');
    await user.click(screen.getByRole('switch'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect((calls[0].body as { query: unknown }).query).toEqual({
      orQueries: [{ unassigned: true, assigneeExpression: '${ currentUser() }' }],
    });
  });

  it('does not save while the name, the priority or a criterion is invalid', async () => {
    const calls = fakeBackend();
    renderModal(null);
    const user = userEvent.setup({ delay: null });

    await user.click(screen.getByRole('button', { name: 'Add criterion' }));
    await user.selectOptions(screen.getAllByLabelText('Key')[0], 'minPriority');
    await user.type(screen.getAllByLabelText('Value')[0], 'high');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Required field')).toBeInTheDocument();
    expect(screen.getByText('Only a Integer value is allowed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(calls).toEqual([]);

    // the form can be saved once it is corrected
    await user.type(screen.getByLabelText('Name'), 'Urgent');
    await user.clear(screen.getAllByLabelText('Value')[0]);
    await user.type(screen.getAllByLabelText('Value')[0], '80');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect((calls[0].body as { query: unknown }).query).toEqual({ minPriority: 80 });
  });

  it('shows a stored filter and changes it, taking the read permission from a removed user', async () => {
    const calls = fakeBackend([grant('a-1', { userId: 'john' }), grant('a-2', { groupId: 'sales' }, ['READ', 'UPDATE'])]);
    const { onSaved } = renderModal(myTasks);
    const user = userEvent.setup({ delay: null });

    expect(screen.getByLabelText('Name', { selector: '#cz-filter-name' })).toHaveValue('My tasks');
    expect(screen.getByLabelText('Priority')).toHaveValue('5');
    expect(screen.getByLabelText('Auto-Refresh')).toBeChecked();
    expect(screen.getAllByLabelText('Value').map((input) => (input as HTMLInputElement).value)).toEqual([
      '${ currentUser() }',
      'sales, accounting',
    ]);
    expect(screen.getByLabelText('Include assigned tasks')).toBeChecked();
    expect(screen.getByPlaceholderText('Machine name of variable')).toHaveValue('amount');

    // john and the group sales may read the filter; john is removed, the group loses READ only
    const john = await screen.findByText('john');
    await user.click(within(john.closest('.cds--tag') as HTMLElement).getByRole('button'));
    await user.click(within(screen.getByText('sales').closest('.cds--tag') as HTMLElement).getByRole('button'));
    await user.clear(screen.getByLabelText('Name', { selector: '#cz-filter-name' }));
    await user.type(screen.getByLabelText('Name', { selector: '#cz-filter-name' }), 'Mine');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('f-1'));
    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      `PUT ${ENGINE}/filter/f-1`,
      `DELETE ${ENGINE}/authorization/a-1`,
      `PUT ${ENGINE}/authorization/a-2`,
    ]);
    expect(calls[0].body).toMatchObject({ id: 'f-1', name: 'Mine', query: myTasks.query });
    expect(calls[2].body).toMatchObject({ id: 'a-2', permissions: ['UPDATE'] });
  });

  it('refuses a user who may read the filter already', async () => {
    fakeBackend([grant('a-1', { userId: 'john' })]);
    renderModal(myTasks);
    const user = userEvent.setup({ delay: null });

    await screen.findByText('john');
    await user.type(screen.getByPlaceholderText('User ID'), 'john');

    expect(screen.getByText('Given user has already read permissions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
  });

  it('leaves the permissions alone when the user may not read them', async () => {
    const calls = fakeBackend('forbidden');
    const { onSaved } = renderModal(myTasks);
    const user = userEvent.setup({ delay: null });

    expect(await screen.findByText(/In order to edit the read permissions/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Accessible by all users')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('f-1'));
    expect(calls.map((call) => `${call.method} ${call.path}`)).toEqual([`PUT ${ENGINE}/filter/f-1`]);
  });

  it('deletes the filter only after the warning was confirmed', async () => {
    const calls = fakeBackend();
    const { onDeleted } = renderModal(myTasks);
    const user = userEvent.setup({ delay: null });

    await user.click(screen.getByRole('button', { name: 'Delete filter' }));
    expect(screen.getByText(/Deleting the filter cannot be undone/)).toBeInTheDocument();
    expect(calls).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'Delete filter' }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
    expect(calls).toEqual([{ method: 'DELETE', path: `${ENGINE}/filter/f-1`, body: undefined }]);
  });
});
