import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '../../../app/query-client';
import { initI18n } from '../../../shared/i18n';
import { Notifications, useNotifications } from '../../../shared/notifications';
import { TimeToLive } from './TimeToLive';

beforeAll(() => initI18n('en'));

afterEach(() => {
  vi.unstubAllGlobals();
  useNotifications.setState({ notifications: [] });
});

const URL = '/api/engine/engine/default/process-definition/invoice%3A2/history-time-to-live';

function fakeBackend(status = 204) {
  const calls: { path: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ path: url, body: JSON.parse(String(init.body)) });
      return status === 204
        ? new Response(null, { status })
        : new Response(JSON.stringify({ message: 'The definition is gone' }), { status });
    }),
  );
  return calls;
}

function renderValue(value: number | null) {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <TimeToLive engine="default" resource="process-definition" id="invoice:2" value={value} />
      <Notifications />
    </QueryClientProvider>,
  );
}

const openDialog = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Edit History Time To Live value' }));
  return within(screen.getByRole('dialog'));
};

describe('the history time to live of a definition', () => {
  it('is shown in days, or as null when there is none', () => {
    renderValue(30);
    expect(screen.getByText('30 days')).toBeInTheDocument();
  });

  it('is one day, not one days', () => {
    renderValue(1);
    expect(screen.getByText('1 day')).toBeInTheDocument();
  });

  it('is set to another number of days', async () => {
    const calls = fakeBackend();
    renderValue(null);
    const user = userEvent.setup();

    expect(screen.getByText('null')).toBeInTheDocument();
    const dialog = await openDialog(user);
    // without a number there is nothing to save
    expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();

    fireEvent.change(dialog.getByRole('spinbutton'), { target: { value: '45' } });
    await user.click(dialog.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(calls).toEqual([{ path: URL, body: { historyTimeToLive: 45 } }]));
    expect(await screen.findByText('The history time to live value has been updated to 45 days successfully.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('refuses a negative number of days', async () => {
    const calls = fakeBackend();
    renderValue(30);
    const user = userEvent.setup();

    const dialog = await openDialog(user);
    fireEvent.change(dialog.getByRole('spinbutton'), { target: { value: '-1' } });

    expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(calls).toEqual([]);
  });

  it('is cleared', async () => {
    const calls = fakeBackend();
    renderValue(30);
    const user = userEvent.setup();

    const dialog = await openDialog(user);
    await user.click(dialog.getByLabelText('Clear Value'));
    expect(dialog.queryByRole('spinbutton')).not.toBeInTheDocument();
    await user.click(dialog.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(calls).toEqual([{ path: URL, body: { historyTimeToLive: null } }]));
    expect(await screen.findByText('The history time to live value has been set to null.')).toBeInTheDocument();
  });

  it('keeps the dialog open and says why when the engine refuses the change', async () => {
    fakeBackend(404);
    renderValue(30);
    const user = userEvent.setup();

    const dialog = await openDialog(user);
    await user.click(dialog.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Failed to update history time to live.')).toBeInTheDocument();
    expect(screen.getByText('The definition is gone')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
