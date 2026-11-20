import { describe, expect, it } from 'vitest';
import { sortItems } from './client-sorting';

const jobs = [
  { id: 'a', activity: 'Ship', priority: 10 as number | null, suspended: true },
  { id: 'b', activity: 'charge card', priority: null, suspended: false },
  { id: 'c', activity: 'Approve 10', priority: 2, suspended: false },
  { id: 'd', activity: 'Approve 9', priority: 7, suspended: true },
];
const values = {
  activity: (job: (typeof jobs)[number]) => job.activity,
  priority: (job: (typeof jobs)[number]) => job.priority,
  suspended: (job: (typeof jobs)[number]) => job.suspended,
};
const ids = (sortBy: string, sortOrder: 'asc' | 'desc') => sortItems(jobs, values, { sortBy, sortOrder }).map((job) => job.id);

describe('sortItems', () => {
  it('orders text without regard to case and numbers in it by their value', () => {
    expect(ids('activity', 'asc')).toEqual(['d', 'c', 'b', 'a']);
    expect(ids('activity', 'desc')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('orders numbers and flags, rows without a value first', () => {
    expect(ids('priority', 'asc')).toEqual(['b', 'c', 'd', 'a']);
    expect(ids('suspended', 'asc')).toEqual(['b', 'c', 'a', 'd']);
  });

  it('leaves the list as it is for a field it does not know', () => {
    expect(ids('unknown', 'asc')).toEqual(['a', 'b', 'c', 'd']);
    expect(jobs.map((job) => job.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});
