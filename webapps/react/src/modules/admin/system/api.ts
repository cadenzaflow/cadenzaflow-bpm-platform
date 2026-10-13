import { useQuery } from '@tanstack/react-query';
import { adminUrl, engineUrl, request } from '../../../shared/api/client';
import { METRICS, addMonths, activeStart, formatDate, monthlyRows, annualRows, type MetricUsage } from './metrics';

function fetchAggregated(engine: string, query: Record<string, string | undefined>) {
  return request<MetricUsage[]>(adminUrl(`/plugin/adminPlugins/${encodeURIComponent(engine)}/metrics/aggregated`), { query });
}

/**
 * Monthly usage of the last 12 months: PI and DI (plus FNI and EDE on
 * request) since the start of the previous subscription year, task users of
 * the previous and the current subscription year separately.
 */
export function useMonthlyMetrics(engine: string, contractStart: Date, legacy: boolean) {
  const start = formatDate(contractStart);
  return useQuery({
    queryKey: ['admin-metrics', engine, 'month', start, legacy],
    queryFn: async () => {
      const now = new Date();
      const currentYear = activeStart(contractStart, 'year', now);
      const previousYear = formatDate(addMonths(currentYear, -12, contractStart.getDate()));
      const regular = [METRICS.PI, METRICS.DI, ...(legacy ? [METRICS.FNI, METRICS.EDE] : [])];
      const monthly = (metrics: string[], startDate: string, endDate?: string) =>
        fetchAggregated(engine, { subscriptionStartDate: start, groupBy: 'month', metrics: metrics.join(','), startDate, endDate });
      const parts = await Promise.all([
        monthly(regular, previousYear),
        monthly([METRICS.TU], formatDate(currentYear)),
        monthly([METRICS.TU], previousYear, formatDate(currentYear)),
      ]);
      return monthlyRows(parts.flat(), contractStart, now);
    },
  });
}

export function useAnnualMetrics(engine: string, contractStart: Date) {
  const start = formatDate(contractStart);
  return useQuery({
    queryKey: ['admin-metrics', engine, 'year', start],
    queryFn: async () => annualRows(await fetchAggregated(engine, { subscriptionStartDate: start, groupBy: 'year' })),
  });
}

/** The engine's diagnostics (telemetry) data, without its internal command and metric counters. */
export function useDiagnostics(engine: string) {
  return useQuery({
    queryKey: ['admin-diagnostics', engine],
    queryFn: async () => {
      const data = await request<{ product?: { internals?: Record<string, unknown> } }>(engineUrl(engine, '/telemetry/data'));
      if (data.product?.internals) {
        delete data.product.internals.commands;
        delete data.product.internals.metrics;
      }
      return data;
    },
  });
}
