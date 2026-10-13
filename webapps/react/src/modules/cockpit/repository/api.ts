import { skipToken, useMutation, useQuery } from '@tanstack/react-query';
import { engineUrl, request } from '../../../shared/api/client';
import { useInvalidateCockpit } from '../incidents/api';

/** A deployment as the engine REST API lists it. */
export interface Deployment {
  id: string;
  name: string | null;
  deploymentTime: string;
  source: string | null;
  tenantId: string | null;
}

/** A file of a deployment. */
export interface DeploymentResource {
  id: string;
  name: string;
  deploymentId: string;
}

/** A definition deployed from a resource (process, decision or case definition). */
export interface ResourceDefinition {
  id: string;
  key: string;
  name: string | null;
  version: number;
  decisionRequirementsDefinitionId?: string | null;
}

export type ResourceType = 'bpmn' | 'dmn' | 'cmmn' | 'image' | 'html' | 'form' | 'other';

/** The kind of a resource, from its file name (as in the classic Cockpit). */
export function resourceType(name: string): ResourceType {
  const lower = name.toLowerCase();
  if (/\.(bpmn\d*\.xml|bpmn)$/.test(lower)) {
    return 'bpmn';
  }
  if (/\.(dmn\d*\.xml|dmn)$/.test(lower)) {
    return 'dmn';
  }
  if (/\.(cmmn\d*\.xml|cmmn)$/.test(lower)) {
    return 'cmmn';
  }
  if (/\.(gif|jpg|jpeg|jpe|png|svg|tif|tiff)$/.test(lower)) {
    return 'image';
  }
  if (lower.endsWith('.html')) {
    return 'html';
  }
  if (lower.endsWith('.form')) {
    return 'form';
  }
  return 'other';
}

/** Where the definitions of a resource type are listed. */
const DEFINITIONS: Partial<Record<ResourceType, string>> = {
  bpmn: '/process-definition',
  dmn: '/decision-definition',
  cmmn: '/case-definition',
};

const segment = encodeURIComponent;

/** The content of a resource; also its download link. */
export const resourceDataUrl = (engine: string, resource: DeploymentResource) =>
  engineUrl(engine, `/deployment/${segment(resource.deploymentId)}/resources/${segment(resource.id)}/data`);

export function useResources(engine: string, deploymentId: string | undefined) {
  return useQuery({
    queryKey: ['cockpit', engine, 'deployment-resources', deploymentId],
    queryFn: !deploymentId
      ? skipToken
      : () => request<DeploymentResource[]>(engineUrl(engine, `/deployment/${segment(deploymentId)}/resources`)),
  });
}

/** The text of a resource (images are shown from their URL instead). */
export function useResourceText(engine: string, resource: DeploymentResource | undefined) {
  return useQuery({
    queryKey: ['cockpit', engine, 'deployment-resource-text', resource?.deploymentId, resource?.id],
    staleTime: Infinity,
    queryFn:
      !resource || resourceType(resource.name) === 'image'
        ? skipToken
        : () => request<string>(resourceDataUrl(engine, resource), { accept: '*/*', responseType: 'text' }),
  });
}

/** The definitions deployed from a resource. */
export function useResourceDefinitions(engine: string, resource: DeploymentResource | undefined) {
  const path = resource && DEFINITIONS[resourceType(resource.name)];
  return useQuery({
    queryKey: ['cockpit', engine, 'resource-definitions', resource?.deploymentId, resource?.name],
    queryFn:
      !resource || !path
        ? skipToken
        : () =>
            request<ResourceDefinition[]>(engineUrl(engine, path), {
              query: { deploymentId: resource.deploymentId, resourceName: resource.name, sortBy: 'key', sortOrder: 'asc' },
            }),
  });
}

/** Running process instances (or open case instances) of a definition. */
export function useDefinitionInstanceCount(engine: string, type: ResourceType, definitionId: string) {
  return useQuery({
    queryKey: ['cockpit', engine, 'definition-instance-count', type, definitionId],
    queryFn: async () =>
      type === 'cmmn'
        ? (await request<{ count: number }>(engineUrl(engine, '/case-instance/count'), { query: { caseDefinitionId: definitionId } })).count
        : (await request<{ count: number }>(engineUrl(engine, '/process-instance/count'), { method: 'POST', json: { processDefinitionId: definitionId } }))
            .count,
  });
}

/** The decision requirements definition (DRD) a decision belongs to. */
export function useDecisionRequirements(engine: string, id: string | null | undefined) {
  return useQuery({
    queryKey: ['cockpit', engine, 'decision-requirements', id],
    queryFn: !id ? skipToken : () => request<ResourceDefinition>(engineUrl(engine, `/decision-requirements-definition/${segment(id)}`)),
  });
}

/**
 * Running process instances and open case instances of a deployment; a
 * deployment with instances is only deleted with them (cascade). Case
 * instances count as none when the case engine does not answer.
 */
export function useDeploymentInstanceCounts(engine: string, deploymentId: string) {
  return useQuery({
    queryKey: ['cockpit', engine, 'deployment-instance-counts', deploymentId],
    queryFn: async () => {
      const [processes, cases] = await Promise.all([
        request<{ count: number }>(engineUrl(engine, '/process-instance/count'), { method: 'POST', json: { deploymentId } }),
        request<{ count: number }>(engineUrl(engine, '/case-instance/count'), { query: { deploymentId } }).catch(() => ({ count: 0 })),
      ]);
      return { processes: processes.count, cases: cases.count };
    },
  });
}

export interface DeleteOptions {
  cascade: boolean;
  skipCustomListeners: boolean;
  skipIoMappings: boolean;
}

export function useDeleteDeployment(engine: string) {
  const invalidate = useInvalidateCockpit(engine);
  return useMutation({
    mutationFn: ({ id, options }: { id: string; options: DeleteOptions }) =>
      request<void>(engineUrl(engine, `/deployment/${segment(id)}`), { method: 'DELETE', query: { ...options } }),
    onSettled: invalidate,
  });
}
