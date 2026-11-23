import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '../../../app/query-client';
import { initI18n } from '../../../shared/i18n';
import { toEngineDate } from '../../../shared/variables';
import { json } from '../../../test/app';
import type { Task } from '../api';
import type { TaskComment, UserOperation } from '../task-history';
import { tab } from './history.tab';

beforeAll(() => initI18n('en'));

afterEach(() => vi.unstubAllGlobals());

const ENGINE = '/api/engine/engine/default';

const task = { id: 't-1', name: 'Approve Invoice' } as Task;

const at = (day: number, hours: number) => toEngineDate(new Date(2026, 9, day, hours, 0, 0));
const due = new Date(2026, 9, 30, 12, 0, 0);

const operations: UserOperation[] = [
  { operationId: 'op-1', operationType: 'Claim', userId: 'demo', timestamp: at(13, 9), property: 'assignee', orgValue: null, newValue: 'demo' },
  { operationId: 'op-2', operationType: 'Update', userId: 'mary', timestamp: at(14, 10), property: 'dueDate', orgValue: null, newValue: String(due.getTime()) },
  { operationId: 'op-2', operationType: 'Update', userId: 'mary', timestamp: at(14, 10), property: 'priority', orgValue: '50', newValue: '80' },
];

const comments: TaskComment[] = [{ id: 'c-1', userId: 'john', time: at(14, 11), message: 'Please check the amount' }];

/** The user operation log and the comments of the task; records the list requests. */
function fakeBackend(log: UserOperation[], count = log.length, taskComments: TaskComment[] | 'forbidden' = comments) {
  const requests: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const [path, query] = url.split('?');
      if (path === `${ENGINE}/history/user-operation/count`) {
        return json({ count });
      }
      if (path === `${ENGINE}/history/user-operation`) {
        requests.push(`operations firstResult=${new URLSearchParams(query).get('firstResult')}`);
        return json(log);
      }
      if (path === `${ENGINE}/task/t-1/comment`) {
        requests.push('comments');
        return taskComments === 'forbidden' ? json({ message: 'not allowed' }, 403) : json(taskComments);
      }
      return json({}, 404);
    }),
  );
  return requests;
}

function renderTab() {
  const Tab = tab.component;
  render(
    <QueryClientProvider client={createQueryClient()}>
      <Tab engine="default" task={task} onTaskCompleted={() => {}} />
    </QueryClientProvider>,
  );
}

describe('the history tab of a task', () => {
  it('shows operations and comments by day, the newest first', async () => {
    fakeBackend(operations);
    renderTab();

    const days = (await screen.findAllByRole('heading', { level: 3 })).map((heading) => heading.textContent);
    expect(days).toEqual(['Wednesday, October 14, 2026', 'Tuesday, October 13, 2026']);

    const events = screen.getAllByRole('listitem');
    expect(events).toHaveLength(3);
    // the comment, the newest entry
    expect(within(events[0]).getByText('Comment')).toBeInTheDocument();
    expect(within(events[0]).getByText('Please check the amount')).toBeInTheDocument();
    expect(events[0]).toHaveTextContent('john');
    // one operation that changed two properties
    expect(within(events[1]).getAllByRole('term').map((term) => term.textContent)).toEqual(['Due date', 'Priority']);
    expect(within(events[1]).getAllByRole('definition')[1]).toHaveTextContent('50 → 80');
    // a date comes as epoch milliseconds and is shown as a date; a missing value as a dash
    expect(within(events[1]).getAllByRole('definition')[0]).toHaveTextContent(
      `– → ${new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(due)}`,
    );
    expect(within(events[2]).getByText('Claim')).toBeInTheDocument();
    expect(within(events[2]).getByRole('definition')).toHaveTextContent('– → demo');
  });

  it('says so when the task has no history', async () => {
    fakeBackend([], 0, []);
    renderTab();

    expect(await screen.findByText('There is no history for the task.')).toBeInTheDocument();
  });

  it('shows the operations when the comments may not be read', async () => {
    fakeBackend(operations, operations.length, 'forbidden');
    renderTab();

    expect(await screen.findByText('Claim')).toBeInTheDocument();
    expect(screen.queryByText('Comment')).not.toBeInTheDocument();
  });

  it('pages through a long history; the comments come with the first page only', async () => {
    const requests = fakeBackend(operations, 120);
    renderTab();
    const user = userEvent.setup({ delay: null });

    await screen.findByText('Claim');
    await user.click(screen.getByRole('button', { name: /2/ }));

    await waitFor(() => expect(requests).toEqual(['operations firstResult=0', 'comments', 'operations firstResult=50']));
  });
});
