import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchFilterTasks, fetchTask, sortFilters, type Task, type TaskFilter } from './api';
import { sortTabs, taskTabs, visibleTabs, type TaskTab } from './task-tabs/registry';
import { validateTasklistSearch } from './search';

const task = { id: 't1', name: 'Approve', processDefinitionId: 'invoice:1' } as Task;

afterEach(() => vi.unstubAllGlobals());

function stubFetch(body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('sortFilters', () => {
  it('orders by priority, then by name', () => {
    const filters = [
      { id: 'c', name: 'C', properties: { priority: 1 } },
      { id: 'b', name: 'B', properties: {} },
      { id: 'a', name: 'A', properties: { priority: 1 } },
    ] as TaskFilter[];
    expect(sortFilters(filters).map((f) => f.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('fetchFilterTasks', () => {
  it('requests one page as HAL and indexes the embedded resources', async () => {
    const fetchMock = stubFetch({
      count: 31,
      _embedded: {
        task: [task],
        processDefinition: [{ id: 'invoice:1', key: 'invoice', name: 'Invoice', version: 1 }],
        assignee: [{ id: 'demo', firstName: 'Demo', lastName: 'Demo' }],
      },
    });

    const page = await fetchFilterTasks('default', 'f1', 3);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe('/api/engine/engine/default/filter/f1/list?firstResult=30&maxResults=15');
    expect(init.method).toBe('POST');
    expect(init.headers.Accept).toBe('application/hal+json');
    expect(page.count).toBe(31);
    expect(page.tasks).toEqual([task]);
    expect(page.processDefinitions.get('invoice:1')?.name).toBe('Invoice');
    expect(page.users.get('demo')?.firstName).toBe('Demo');
  });

  it('copes with an empty result', async () => {
    stubFetch({ count: 0, _embedded: {} });
    const page = await fetchFilterTasks('default', 'f1', 1);
    expect(page.tasks).toEqual([]);
  });
});

describe('fetchTask', () => {
  it('separates the task from its embedded process definition and users', async () => {
    stubFetch({
      ...task,
      _links: { self: { href: '/task/t1' } },
      _embedded: {
        processDefinition: [{ id: 'invoice:1', key: 'invoice', name: 'Invoice', version: 1 }],
        user: [{ id: 'demo', firstName: 'Demo', lastName: 'Demo' }],
      },
    });

    const details = await fetchTask('default', 't1');

    expect(details.task).toEqual(task);
    expect(details.processDefinition?.key).toBe('invoice');
    expect(details.users.has('demo')).toBe(true);
  });
});

describe('task tabs', () => {
  const tab = (id: string, order: number, visible?: TaskTab['visible']): TaskTab => ({
    id,
    order,
    label: id,
    visible,
    component: () => null,
  });

  it('registers every *.tab.tsx file', () => {
    expect(taskTabs.map((t) => t.id)).toContain('description');
  });

  it('sorts by order and hides tabs that do not apply', () => {
    const tabs = sortTabs([tab('b', 20), tab('a', 10), tab('hidden', 5, () => false)]);
    expect(tabs.map((t) => t.id)).toEqual(['hidden', 'a', 'b']);
    expect(visibleTabs(task, tabs).map((t) => t.id)).toEqual(['a', 'b']);
  });
});

describe('validateTasklistSearch', () => {
  it('keeps known string parameters only', () => {
    expect(validateTasklistSearch({ filter: 'f1', task: '', detailsTab: 3, other: 'x' })).toEqual({
      filter: 'f1',
      task: undefined,
      detailsTab: undefined,
    });
  });
});
