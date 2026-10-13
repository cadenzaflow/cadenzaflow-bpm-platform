import { useQuery } from '@tanstack/react-query';
import { engineUrl, request, type QueryParams } from '../../shared/api/client';

/** A process definition as the engine REST API returns it. */
export interface ProcessDefinition {
  id: string;
  key: string;
  name: string | null;
  version: number;
  versionTag: string | null;
  tenantId: string | null;
  deploymentId: string;
  resource: string;
  suspended: boolean;
  historyTimeToLive: number | null;
  startableInTasklist: boolean;
}

/** Running instances, failed jobs and open incidents of one process definition version. */
export interface ProcessStatistics {
  id: string;
  instances: number;
  failedJobs: number;
  incidents: { incidentType: string; incidentCount: number }[];
  definition: ProcessDefinition;
}

/** Statistics of all process definitions, counting incidents at their root cause only. */
export function useProcessStatistics(engine: string) {
  return useQuery({
    queryKey: ['cockpit', engine, 'process-statistics'],
    queryFn: () => request<ProcessStatistics[]>(engineUrl(engine, '/process-definition/statistics'), { query: { rootIncidents: true } }),
  });
}

/** The number a count resource returns, e.g. /deployment/count. */
export function useCount(engine: string, path: string, query: QueryParams = {}) {
  return useQuery({
    queryKey: ['cockpit', engine, 'count', path, query],
    queryFn: async () => (await request<{ count: number }>(engineUrl(engine, path), { query })).count,
  });
}

/** Incidents of a statistics entry, summed up over the incident types. */
export const incidentCount = (statistics: ProcessStatistics) =>
  statistics.incidents.reduce((sum, incident) => sum + incident.incidentCount, 0);
