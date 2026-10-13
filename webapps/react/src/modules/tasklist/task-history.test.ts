import { describe, expect, it } from 'vitest';
import { toEngineDate } from '../../shared/variables';
import { groupHistory, type UserOperation } from './task-history';

const at = (day: number, hour: number) => toEngineDate(new Date(2026, 9, day, hour, 0, 0));

const operation = (operationId: string, timestamp: string, property: string | null, values: [string | null, string | null] = [null, null]): UserOperation => ({
  operationId,
  operationType: operationId.startsWith('claim') ? 'Claim' : 'Update',
  userId: 'demo',
  timestamp,
  property,
  orgValue: values[0],
  newValue: values[1],
});

describe('groupHistory', () => {
  it('groups operations by id and day, newest first, with comments in between', () => {
    const days = groupHistory(
      [
        operation('claim-1', at(12, 9), 'assignee', [null, 'demo']),
        operation('update-1', at(13, 10), 'dueDate', [null, '1791900000000']),
        operation('update-1', at(13, 10), 'priority', ['50', '60']),
      ],
      [{ id: 'c1', userId: 'mary', time: at(13, 11), message: 'Please hurry' }],
    );

    expect(days.map((d) => d.day)).toEqual(['2026-10-13', '2026-10-12']);
    const [comment, update] = days[0].events;
    expect(comment).toMatchObject({ kind: 'comment', message: 'Please hurry', userId: 'mary' });
    expect(update).toMatchObject({ kind: 'operation', type: 'Update' });
    expect(update.kind === 'operation' && update.changes).toEqual([
      { property: 'dueDate', isDate: true, orgValue: null, newValue: '1791900000000' },
      { property: 'priority', isDate: false, orgValue: '50', newValue: '60' },
    ]);
    expect(days[1].events).toHaveLength(1);
  });

  it('is empty without operations and comments', () => {
    expect(groupHistory([], [])).toEqual([]);
  });
});
