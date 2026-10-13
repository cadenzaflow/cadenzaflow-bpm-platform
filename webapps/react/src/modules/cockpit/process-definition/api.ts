import { skipToken, useQuery } from '@tanstack/react-query';
import { engineUrl, request } from '../../../shared/api/client';
import type { DiagramBadge } from '../../../shared/diagram/BpmnDiagram';
import type { ProcessDefinition } from '../api';

const definitionUrl = (engine: string, id: string, path = '') =>
  engineUrl(engine, `/process-definition/${encodeURIComponent(id)}${path}`);

export function useProcessDefinition(engine: string, id: string, enabled = true) {
  return useQuery({
    queryKey: ['cockpit', engine, 'process-definition', id],
    queryFn: !enabled ? skipToken : () => request<ProcessDefinition>(definitionUrl(engine, id)),
  });
}

/** The BPMN XML (cached with the Tasklist's diagram tab, it never changes). */
export function useProcessDefinitionXml(engine: string, id: string | undefined) {
  return useQuery({
    queryKey: ['process-definition-xml', engine, id],
    staleTime: Infinity,
    queryFn: !id ? skipToken : async () => (await request<{ bpmn20Xml: string }>(definitionUrl(engine, id, '/xml'))).bpmn20Xml,
  });
}

/** All versions of a process definition (same key and tenant), newest first. */
export function useVersions(engine: string, definition: ProcessDefinition | undefined) {
  return useQuery({
    queryKey: ['cockpit', engine, 'process-definition-versions', definition?.key, definition?.tenantId],
    queryFn: !definition
      ? skipToken
      : () =>
          request<ProcessDefinition[]>(engineUrl(engine, '/process-definition'), {
            query: {
              key: definition.key,
              sortBy: 'version',
              sortOrder: 'desc',
              ...(definition.tenantId ? { tenantIdIn: definition.tenantId } : { withoutTenantId: true }),
            },
          }),
  });
}

interface ActivityStatistics {
  id: string;
  instances: number;
  failedJobs: number;
  incidents: { incidentType: string; incidentCount: number }[];
}

/** Running instances and open incidents per activity, as badges for the diagram. */
export function useActivityBadges(engine: string, id: string) {
  return useQuery({
    queryKey: ['cockpit', engine, 'activity-statistics', id],
    queryFn: async () => {
      const statistics = await request<ActivityStatistics[]>(definitionUrl(engine, id, '/statistics'), { query: { incidents: true } });
      const badges: Record<string, DiagramBadge> = {};
      for (const activity of statistics) {
        badges[activity.id] = {
          count: activity.instances,
          incidents: activity.incidents.reduce((sum, incident) => sum + incident.incidentCount, 0),
        };
      }
      return badges;
    },
  });
}

/** Running instances of this version and of all versions. */
export function useRunningInstances(engine: string, definition: ProcessDefinition | undefined) {
  const count = (query: Record<string, string>) =>
    request<{ count: number }>(engineUrl(engine, '/process-instance/count'), { query }).then((result) => result.count);
  return useQuery({
    queryKey: ['cockpit', engine, 'running-instances', definition?.id],
    queryFn: !definition
      ? skipToken
      : async () => {
          const [current, all] = await Promise.all([
            count({ processDefinitionId: definition.id }),
            count({ processDefinitionKey: definition.key, ...(definition.tenantId ? { tenantIdIn: definition.tenantId } : {}) }),
          ]);
          return { current, all };
        },
  });
}
