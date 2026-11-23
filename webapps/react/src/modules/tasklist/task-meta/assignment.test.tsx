import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '../../../app/query-client';
import { initI18n } from '../../../shared/i18n';
import { useNotifications } from '../../../shared/notifications';
import { json } from '../../../test/app';
import type { Task, TaskDetails } from '../api';
import { AssigneeField } from './AssigneeField';
import { GroupsField } from './GroupsField';

beforeAll(() => initI18n('en'));

afterEach(() => {
  vi.unstubAllGlobals();
  useNotifications.setState({ notifications: [] });
});

const ENGINE = '/api/engine/engine/default';

interface Call {
  path: string;
  body: unknown;
}

/** demo is logged in; the users demo and mary exist; the task t-1 has the candidate groups of the test. */
function fakeBackend(candidateGroups: string[] = [], groupNames: 'readable' | 'forbidden' = 'readable') {
  const calls: Call[] = [];
  const groups = [...candidateGroups];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const [path, queryString] = url.split('?');
      const query = new URLSearchParams(queryString);
      const body = init.body ? JSON.parse(String(init.body)) : undefined;
      if (init.method === 'POST') {
        calls.push({ path, body });
        if (path === `${ENGINE}/task/t-1/identity-links`) {
          groups.push(body.groupId);
        }
        if (path === `${ENGINE}/task/t-1/identity-links/delete`) {
          groups.splice(groups.indexOf(body.groupId), 1);
        }
        return new Response(null, { status: 204 });
      }
      if (path === '/api/admin/auth/user/default') {
        return json({ userId: 'demo', authorizedApps: ['tasklist'] });
      }
      if (path === `${ENGINE}/user`) {
        return json(['demo', 'mary'].includes(query.get('id') ?? '') ? [{ id: query.get('id') }] : []);
      }
      if (path === `${ENGINE}/task/t-1/identity-links`) {
        return json(groups.map((groupId) => ({ type: 'candidate', userId: null, groupId })));
      }
      if (path === `${ENGINE}/group`) {
        return groupNames === 'forbidden'
          ? json({ message: 'not allowed' }, 403)
          : json((query.get('idIn') ?? '').split(',').map((id) => ({ id, name: id === 'accounting' ? 'Accounting' : null })));
      }
      return json({}, 404);
    }),
  );
  return calls;
}

const details = (assignee: string | null): TaskDetails => ({
  task: { id: 't-1', name: 'Approve Invoice', assignee } as Task,
  processDefinition: undefined,
  users: new Map([['mary', { id: 'mary', firstName: 'Mary', lastName: 'Anne' }]]) as TaskDetails['users'],
});

const inApp = (ui: React.ReactNode) => render(<QueryClientProvider client={createQueryClient()}>{ui}</QueryClientProvider>);

describe('the assignee of a task', () => {
  it('is the user who claims an unassigned task', async () => {
    const calls = fakeBackend();
    inApp(<AssigneeField engine="default" details={details(null)} />);
    const user = userEvent.setup({ delay: null });

    expect(screen.getByText('Assignee: Unassigned')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Claim' }));

    await waitFor(() => expect(calls).toEqual([{ path: `${ENGINE}/task/t-1/claim`, body: { userId: 'demo' } }]));
  });

  it('gives the task back when the user unclaims it', async () => {
    const calls = fakeBackend();
    inApp(<AssigneeField engine="default" details={details('demo')} />);
    const user = userEvent.setup({ delay: null });

    await user.click(await screen.findByRole('button', { name: 'Unclaim' }));

    await waitFor(() => expect(calls).toEqual([{ path: `${ENGINE}/task/t-1/unclaim`, body: undefined }]));
    // the own task is not "reset"
    expect(screen.queryByRole('button', { name: 'Reset assignee' })).not.toBeInTheDocument();
  });

  it('shows the name of another assignee and takes the task away from them', async () => {
    const calls = fakeBackend();
    inApp(<AssigneeField engine="default" details={details('mary')} />);
    const user = userEvent.setup({ delay: null });

    expect(screen.getByText('Assignee: Mary Anne')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset assignee' }));

    await waitFor(() => expect(calls).toEqual([{ path: `${ENGINE}/task/t-1/assignee`, body: { userId: null } }]));
    expect(screen.queryByRole('button', { name: 'Claim' })).not.toBeInTheDocument();
  });

  it('gives the task to another user, who has to exist', async () => {
    const calls = fakeBackend();
    inApp(<AssigneeField engine="default" details={details('demo')} />);
    const user = userEvent.setup({ delay: null });

    await user.click(screen.getByRole('button', { name: 'Change assignee' }));
    const field = screen.getByPlaceholderText('Assignee');
    expect(field).toHaveValue('demo');
    await user.clear(field);
    await user.type(field, 'nobody');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('There is no user with this ID.')).toBeInTheDocument();
    expect(calls).toEqual([]);

    await user.clear(field);
    await user.type(field, ' mary {Enter}');

    await waitFor(() => expect(calls).toEqual([{ path: `${ENGINE}/task/t-1/assignee`, body: { userId: 'mary' } }]));
    // back to the read view once it is saved
    await waitFor(() => expect(screen.queryByPlaceholderText('Assignee')).not.toBeInTheDocument());
  });

  it('leaves the assignee as it is when the change is cancelled', async () => {
    const calls = fakeBackend();
    inApp(<AssigneeField engine="default" details={details('demo')} />);
    const user = userEvent.setup({ delay: null });

    await user.click(screen.getByRole('button', { name: 'Change assignee' }));
    await user.type(screen.getByPlaceholderText('Assignee'), 'x');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByText('Assignee: demo')).toBeInTheDocument();
    expect(calls).toEqual([]);
  });
});

describe('the candidate groups of a task', () => {
  const renderGroups = () =>
    inApp(
      <dl>
        <GroupsField engine="default" taskId="t-1" />
      </dl>,
    );

  it('are shown by name, or by id where the name is not known', async () => {
    fakeBackend(['accounting', 'sales']);
    renderGroups();

    expect(await screen.findByText('Accounting, sales')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage Groups' })).toBeInTheDocument();
  });

  it('are shown by id when the user may not read groups', async () => {
    fakeBackend(['accounting'], 'forbidden');
    renderGroups();

    expect(await screen.findByText('accounting')).toBeInTheDocument();
  });

  it('are added and removed in the dialog, none twice', async () => {
    const calls = fakeBackend(['accounting']);
    renderGroups();
    const user = userEvent.setup({ delay: null });

    await user.click(await screen.findByRole('button', { name: 'Manage Groups' }));
    const dialog = within(screen.getByRole('dialog'));
    const field = dialog.getByLabelText('Group ID');

    await user.type(field, 'accounting');
    expect(dialog.getByText('Task is already in this group.')).toBeInTheDocument();
    expect(dialog.getByRole('button', { name: 'Add a group' })).toBeDisabled();

    await user.clear(field);
    await user.type(field, ' sales ');
    await user.click(dialog.getByRole('button', { name: 'Add a group' }));

    // the new group is listed and the field is empty again
    expect(await dialog.findByText('sales')).toBeInTheDocument();
    await waitFor(() => expect(field).toHaveValue(''));

    await user.click(within(dialog.getByText('Accounting').closest('.cds--tag') as HTMLElement).getByRole('button'));

    await waitFor(() => expect(dialog.queryByText('Accounting')).not.toBeInTheDocument());
    expect(calls).toEqual([
      { path: `${ENGINE}/task/t-1/identity-links`, body: { groupId: 'sales', type: 'candidate' } },
      { path: `${ENGINE}/task/t-1/identity-links/delete`, body: { groupId: 'accounting', type: 'candidate' } },
    ]);
  });

  it('offer to add groups to a task without any', async () => {
    fakeBackend([]);
    renderGroups();

    expect(await screen.findByText('–')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add groups' })).toBeInTheDocument();
  });
});
