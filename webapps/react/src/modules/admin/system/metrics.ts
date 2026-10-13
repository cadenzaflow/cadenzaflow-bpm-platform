/** The execution metrics of the engine (short name → metric name of the REST API). */
export const METRICS = {
  PI: 'process-instances',
  DI: 'decision-instances',
  TU: 'task-users',
  FNI: 'flow-node-instances',
  EDE: 'executed-decision-elements',
} as const;

export type MetricKey = keyof typeof METRICS;

/** FNI and EDE are only shown on request. */
export const LEGACY_METRICS: MetricKey[] = ['FNI', 'EDE'];

/** One entry of /metrics/aggregated. */
export interface MetricUsage {
  subscriptionYear: number;
  /** 1-12; missing when grouped by year */
  subscriptionMonth?: number | null;
  metric: string;
  sum: number;
}

export interface MetricsRow {
  /** yyyy-MM-dd (month) or the year */
  label: string;
  /** the month belongs to the current subscription year */
  activeYear: boolean;
  sums: Record<MetricKey, number>;
}

const pad = (value: number) => String(value).padStart(2, '0');

/** yyyy-MM-dd of a local date. */
export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** A yyyy-MM-dd text as local date, or null when it is no valid date. */
export function parseDate(text: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) {
    return null;
  }
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date.getMonth() === Number(match[2]) - 1 ? date : null;
}

/** The date shifted by months; the day is cut to the month's last day (Jan 31 + 1 month = Feb 28). */
export function addMonths(date: Date, months: number, day = date.getDate()): Date {
  const first = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(day, lastDay));
}

/** Start of the subscription month or year that contains `now`. */
export function activeStart(contractStart: Date, unit: 'month' | 'year', now: Date): Date {
  const step = unit === 'month' ? 1 : 12;
  let start = contractStart;
  for (let next = addMonths(start, step, contractStart.getDate()); next < now; next = addMonths(next, step, contractStart.getDate())) {
    start = next;
  }
  return start;
}

/** Label of a subscription month: its start date, with the contract's day (cut to the month's end). */
export function monthLabel(year: number, month: number, contractDay: number): string {
  return formatDate(addMonths(new Date(year, month - 1, 1), 0, contractDay));
}

const emptySums = (): Record<MetricKey, number> => ({ PI: 0, DI: 0, TU: 0, FNI: 0, EDE: 0 });
const keyOf = (metric: string) => (Object.keys(METRICS) as MetricKey[]).find((key) => METRICS[key] === metric);

/**
 * The last 12 subscription months, newest first, as the classic Admin shows
 * them: task users (TU) add up within a subscription year.
 */
export function monthlyRows(usages: MetricUsage[], contractStart: Date, now: Date): MetricsRow[] {
  const day = contractStart.getDate();
  const activeMonth = activeStart(contractStart, 'month', now);
  const activeYear = activeStart(contractStart, 'year', now);
  // the last 24 months, oldest first
  const rows: MetricsRow[] = [];
  for (let i = 23; i >= 0; i--) {
    const month = addMonths(activeMonth, -i, day);
    rows.push({ label: formatDate(month), activeYear: month >= activeYear, sums: emptySums() });
  }
  for (const usage of usages) {
    const row = rows.find((candidate) => candidate.label === monthLabel(usage.subscriptionYear, usage.subscriptionMonth ?? 1, day));
    const key = keyOf(usage.metric);
    if (row && key) {
      row.sums[key] += usage.sum;
    }
  }
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].activeYear === rows[i - 1].activeYear) {
      rows[i].sums.TU += rows[i - 1].sums.TU;
    }
  }
  return rows.slice(-12).reverse();
}

/** Usage per subscription year, newest first. */
export function annualRows(usages: MetricUsage[]): MetricsRow[] {
  const rows = new Map<number, MetricsRow>();
  for (const usage of usages) {
    const row = rows.get(usage.subscriptionYear) ?? { label: String(usage.subscriptionYear), activeYear: false, sums: emptySums() };
    const key = keyOf(usage.metric);
    if (key) {
      row.sums[key] += usage.sum;
    }
    rows.set(usage.subscriptionYear, row);
  }
  return [...rows.values()].sort((a, b) => Number(b.label) - Number(a.label));
}

/** From and to of a subscription year; `current` when it has not ended yet. */
export function subscriptionYear(year: number, contractStart: Date, now: Date): { from: string; to: string; current: boolean } {
  const from = new Date(year, contractStart.getMonth(), contractStart.getDate());
  const to = addMonths(from, 12, contractStart.getDate());
  return { from: formatDate(from), to: formatDate(to), current: to > now };
}
