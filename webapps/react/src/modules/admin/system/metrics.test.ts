import { describe, expect, it } from 'vitest';
import { activeStart, addMonths, annualRows, formatDate, monthlyRows, parseDate, subscriptionYear } from './metrics';

const date = (text: string) => parseDate(text)!;

describe('execution metrics', () => {
  it('reads and writes yyyy-MM-dd', () => {
    expect(formatDate(date('2026-02-03'))).toBe('2026-02-03');
    expect(parseDate('2026-02-30')).toBeNull();
    expect(parseDate('3.2.2026')).toBeNull();
  });

  it('keeps the contract day where a month allows it', () => {
    expect(formatDate(addMonths(date('2026-01-31'), 1))).toBe('2026-02-28');
    expect(formatDate(addMonths(date('2026-02-28'), 1, 31))).toBe('2026-03-31');
  });

  it('finds the current subscription month and year', () => {
    const now = date('2026-10-13');
    expect(formatDate(activeStart(date('2025-03-31'), 'month', now))).toBe('2026-09-30');
    expect(formatDate(activeStart(date('2025-03-31'), 'year', now))).toBe('2026-03-31');
  });

  it('shows the last 12 months, newest first, task users adding up within a subscription year', () => {
    const rows = monthlyRows(
      [
        { subscriptionYear: 2026, subscriptionMonth: 2, metric: 'process-instances', sum: 7 },
        { subscriptionYear: 2026, subscriptionMonth: 1, metric: 'task-users', sum: 2 },
        { subscriptionYear: 2026, subscriptionMonth: 2, metric: 'task-users', sum: 3 },
        { subscriptionYear: 2025, subscriptionMonth: 11, metric: 'task-users', sum: 1 },
        { subscriptionYear: 2025, subscriptionMonth: 12, metric: 'task-users', sum: 1 },
      ],
      date('2026-01-01'),
      date('2026-10-13'),
    );
    expect(rows).toHaveLength(12);
    expect(rows[0].label).toBe('2026-10-01');
    expect(rows[11].label).toBe('2025-11-01');
    const byLabel = Object.fromEntries(rows.map((row) => [row.label, row]));
    expect(byLabel['2026-02-01'].sums).toMatchObject({ PI: 7, TU: 5 });
    expect(byLabel['2026-10-01'].sums.TU).toBe(5);
    // the previous subscription year counts on its own
    expect(byLabel['2026-01-01'].sums.TU).toBe(2);
    expect(byLabel['2025-12-01']).toMatchObject({ activeYear: false, sums: { TU: 2 } });
  });

  it('sums up subscription years, newest first', () => {
    const rows = annualRows([
      { subscriptionYear: 2025, metric: 'process-instances', sum: 10 },
      { subscriptionYear: 2026, metric: 'process-instances', sum: 4 },
      { subscriptionYear: 2026, metric: 'decision-instances', sum: 1 },
    ]);
    expect(rows.map((row) => [row.label, row.sums.PI, row.sums.DI])).toEqual([
      ['2026', 4, 1],
      ['2025', 10, 0],
    ]);
    expect(subscriptionYear(2026, date('2025-04-15'), date('2026-10-13'))).toEqual({
      from: '2026-04-15',
      to: '2027-04-15',
      current: true,
    });
  });
});
