import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '../../../../app/query-client';
import { initI18n } from '../../../../shared/i18n';
import { toEngineDate } from '../../../../shared/variables';
import { json } from '../../../../test/app';
import { tab } from './job-definitions.tab';

beforeAll(() => initI18n('en'));

afterEach(() => vi.unstubAllGlobals());

const ENGINE = '/api/engine/engine/default';

const bpmn = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" targetNamespace="test">
  <process id="invoice" isExecutable="true">
    <serviceTask id="prepareTransfer" name="Prepare Bank Transfer" />
    <intermediateCatchEvent id="reminder" name="Wait a week" />
  </process>
</definitions>`;

const jobDefinitions = [
  { id: 'jd-1', activityId: 'reminder', jobType: 'timer-intermediate-transition', jobConfiguration: 'DURATION: P7D', suspended: true, overridingJobPriority: null },
  { id: 'jd-2', activityId: 'prepareTransfer', jobType: 'async-continuation', jobConfiguration: 'async-before', suspended: false, overridingJobPriority: 20 },
];

/** The job definitions of invoice:2; records the changes the tab sends. */
function fakeBackend() {
  const calls: { path: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const path = url.split('?')[0];
      if (init.method === 'PUT') {
        calls.push({ path, body: JSON.parse(String(init.body)) });
        return new Response(null, { status: 204 });
      }
      if (path === `${ENGINE}/process-definition/invoice%3A2/xml`) {
        return json({ bpmn20Xml: bpmn });
      }
      if (path === `${ENGINE}/job-definition/count`) {
        return json({ count: jobDefinitions.length });
      }
      if (path === `${ENGINE}/job-definition`) {
        return json(jobDefinitions);
      }
      return json({}, 404);
    }),
  );
  return calls;
}

function renderTab(activityIds: string[] = []) {
  const Tab = tab.component;
  render(
    <QueryClientProvider client={createQueryClient()}>
      <Tab
        engine="default"
        definition={{ id: 'invoice:2', key: 'invoice', name: 'Invoice Receipt', version: 2 } as never}
        activityIds={activityIds}
        search={{} as never}
        onSearchChange={() => {}}
      />
    </QueryClientProvider>,
  );
}

const rowOf = async (activityName: string) => (await screen.findByText(activityName)).closest('tr') as HTMLElement;

describe('the job definitions tab of a process definition', () => {
  it('lists the job definitions with the names of their activities, the active ones first', async () => {
    fakeBackend();
    renderTab();

    await screen.findByText('Prepare Bank Transfer');
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getAllByRole('cell').slice(0, 5).map((cell) => cell.textContent))).toEqual([
      ['Active', 'Prepare Bank Transfer', 'async-continuation', 'async-before', '20'],
      ['Suspended', 'Wait a week', 'timer-intermediate-transition', 'DURATION: P7D', ''],
    ]);
  });

  it('shows the job definitions of the activities selected in the diagram only', async () => {
    fakeBackend();
    renderTab(['reminder']);

    await screen.findByText('Wait a week');
    expect(screen.queryByText('Prepare Bank Transfer')).not.toBeInTheDocument();
  });

  it('says so when no job definition belongs to the selected activity', async () => {
    fakeBackend();
    renderTab(['approveInvoice']);

    expect(await screen.findByText('No job definitions matched by current filter.')).toBeInTheDocument();
  });

  it('suspends a job definition with its jobs at once', async () => {
    const calls = fakeBackend();
    renderTab();
    const user = userEvent.setup();

    await user.click(within(await rowOf('Prepare Bank Transfer')).getByRole('button', { name: 'Suspend Job Definition' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Include Existing Job')).toBeChecked();
    await user.click(within(dialog).getByRole('button', { name: 'Suspend' }));

    await waitFor(() => expect(calls).toEqual([{ path: `${ENGINE}/job-definition/jd-2/suspended`, body: { suspended: true, includeJobs: true } }]));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('activates a suspended job definition later, leaving its jobs as they are', async () => {
    const calls = fakeBackend();
    renderTab();
    const user = userEvent.setup();

    await user.click(within(await rowOf('Wait a week')).getByRole('button', { name: 'Activate Job Definition' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByLabelText('Include Existing Job'));
    await user.click(within(dialog).getByLabelText('Delayed'));

    // a date that cannot be read keeps the dialog from being sent
    fireEvent.change(within(dialog).getByLabelText('Schedule at'), { target: { value: '' } });
    expect(within(dialog).getByRole('button', { name: 'Activate' })).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText('Schedule at'), { target: { value: '2026-12-01T10:00:00' } });
    await user.click(within(dialog).getByRole('button', { name: 'Activate' }));

    await waitFor(() =>
      expect(calls).toEqual([
        {
          path: `${ENGINE}/job-definition/jd-1/suspended`,
          body: { suspended: false, includeJobs: false, executionDate: toEngineDate(new Date(2026, 11, 1, 10, 0, 0)) },
        },
      ]),
    );
  });

  it('overrides the priority of the jobs, of the existing ones too', async () => {
    const calls = fakeBackend();
    renderTab();
    const user = userEvent.setup();

    await user.click(within(await rowOf('Wait a week')).getByRole('button', { name: 'Change Overriding Job Priority' }));
    const dialog = screen.getByRole('dialog');
    // nothing to clear yet
    expect(within(dialog).getByRole('button', { name: 'Clear' })).toBeDisabled();

    await user.type(within(dialog).getByLabelText('Priority'), 'high');
    expect(within(dialog).getByText('Invalid value: Only an Integer value is allowed.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Override' })).toBeDisabled();

    await user.clear(within(dialog).getByLabelText('Priority'));
    await user.type(within(dialog).getByLabelText('Priority'), '70');
    await user.click(within(dialog).getByLabelText('Include Existing Jobs'));
    await user.click(within(dialog).getByRole('button', { name: 'Override' }));

    await waitFor(() => expect(calls).toEqual([{ path: `${ENGINE}/job-definition/jd-1/jobPriority`, body: { priority: 70, includeJobs: true } }]));
  });

  it('clears an overriding priority', async () => {
    const calls = fakeBackend();
    renderTab();
    const user = userEvent.setup();

    await user.click(within(await rowOf('Prepare Bank Transfer')).getByRole('button', { name: 'Change Overriding Job Priority' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Priority')).toHaveValue('20');
    await user.clear(within(dialog).getByLabelText('Priority'));
    await user.click(within(dialog).getByRole('button', { name: 'Clear' }));

    await waitFor(() => expect(calls).toEqual([{ path: `${ENGINE}/job-definition/jd-2/jobPriority`, body: { priority: null } }]));
  });
});
