import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyReadPermissions, toReadPermissions, type Authorization } from './api';
import { fromFilterQuery, toFilterQuery, validateRow } from './filter-criteria';

afterEach(() => vi.unstubAllGlobals());

describe('filter criteria', () => {
  it('reads a stored query into rows and writes it back', () => {
    const stored = {
      assigneeExpression: '${ currentUser() }',
      candidateGroups: ['accounting', 'sales'],
      includeAssignedTasks: true,
      unassigned: true,
      priority: 50,
      processVariables: [{ name: 'amount', operator: 'gt', value: 100 }],
      taskVariables: [],
    };
    const form = fromFilterQuery(stored);

    expect(form.rows).toEqual([
      { key: 'assignee', value: '${ currentUser() }' },
      { key: 'candidateGroups', value: 'accounting, sales' },
      { key: 'unassigned', value: 'true' },
      { key: 'priority', value: '50' },
    ]);
    expect(form.includeAssignedTasks).toBe(true);
    // not offered by the dialog: kept as it is
    expect(form.preserved).toEqual({ processVariables: [{ name: 'amount', operator: 'gt', value: 100 }] });

    expect(toFilterQuery(form)).toEqual({
      processVariables: [{ name: 'amount', operator: 'gt', value: 100 }],
      assigneeExpression: '${ currentUser() }',
      candidateGroups: ['accounting', 'sales'],
      unassigned: true,
      priority: 50,
      includeAssignedTasks: true,
    });
  });

  it('keeps "any criterion" in orQueries', () => {
    const form = fromFilterQuery({ orQueries: [{ name: 'Review', assignee: 'demo' }] });
    expect(form.matchAny).toBe(true);
    expect(toFilterQuery(form)).toEqual({ orQueries: [{ name: 'Review', assignee: 'demo' }] });
  });

  it('validates values by kind, expressions where allowed', () => {
    expect(validateRow({ key: 'priority', value: 'high' })).toBe('INVALID_VALUE_FOR_TYPE');
    expect(validateRow({ key: 'dueBefore', value: '${ now() }' })).toBeNull();
    expect(validateRow({ key: 'dueBefore', value: '2026-10-20' })).toBe('INVALID_DATE');
    expect(validateRow({ key: 'name', value: ' ' })).toBe('REQUIRED_FIELD');
    expect(validateRow({ key: 'withoutDueDate', value: '' })).toBeNull();
  });
});

describe('read permissions', () => {
  const auth = (id: string, fields: Partial<Authorization>): Authorization => ({
    id,
    type: 1,
    permissions: ['READ'],
    userId: null,
    groupId: null,
    resourceType: 5,
    resourceId: 'f1',
    ...fields,
  });

  it('reads who may read the filter', () => {
    expect(
      toReadPermissions([
        auth('a1', { type: 0, userId: '*' }),
        auth('a2', { groupId: 'accounting' }),
        auth('a3', { userId: 'mary', permissions: ['UPDATE'] }),
      ]),
    ).toEqual({ everybody: true, identities: [{ kind: 'group', id: 'accounting' }] });
  });

  it('creates, updates and deletes authorizations to match', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response("{}", { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const current = [
      auth('global', { type: 0, userId: '*' }),
      auth('mary', { userId: 'mary', permissions: ['READ', 'UPDATE'] }),
      auth('sales', { groupId: 'sales' }),
    ];

    await applyReadPermissions('default', 'f1', current, {
      everybody: false,
      identities: [{ kind: 'group', id: 'accounting' }],
    });

    const calls = fetchMock.mock.calls.map(([url, init]) => `${(init as RequestInit).method} ${url} ${(init as RequestInit).body ?? ''}`);
    expect(calls).toEqual([
      'DELETE /api/engine/engine/default/authorization/global ',
      'POST /api/engine/engine/default/authorization/create {"resourceType":5,"resourceId":"f1","permissions":["READ"],"type":1,"groupId":"accounting"}',
      `PUT /api/engine/engine/default/authorization/mary ${JSON.stringify({ ...current[1], permissions: ['UPDATE'] })}`,
      'DELETE /api/engine/engine/default/authorization/sales ',
    ]);
  });
});
