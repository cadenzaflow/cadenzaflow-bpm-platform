import { useMutation, useQuery } from '@tanstack/react-query';
import { engineUrl, request } from '../../../shared/api/client';
import type { DiagramBadge } from '../../../shared/diagram/BpmnDiagram';
import { useInvalidateCockpit } from '../incidents/api';

/** A running process instance as the engine REST API returns it. */
export interface ProcessInstance {
  id: string;
  definitionId: string;
  businessKey: string | null;
  suspended: boolean;
  ended: boolean;
  tenantId: string | null;
}

/** A node of the activity instance tree (activity instances and transition instances alike). */
export interface ActivityInstance {
  id: string;
  activityId: string;
  activityName: string | null;
  activityType: string;
  childActivityInstances?: ActivityInstance[];
  childTransitionInstances?: ActivityInstance[];
  incidents?: { id: string; activityId: string }[];
  /** activity instances only: the executions they run in */
  executionIds?: string[];
  /** transition instances only; their id is this execution's id (for the first one often the process instance id) */
  executionId?: string;
}

const instanceUrl = (engine: string, id: string, path = '') =>
  engineUrl(engine, `/process-instance/${encodeURIComponent(id)}${path}`);

export function useProcessInstance(engine: string, id: string) {
  return useQuery({
    queryKey: ['cockpit', engine, 'process-instance', id],
    queryFn: () => request<ProcessInstance>(instanceUrl(engine, id)),
  });
}

export function useActivityInstances(engine: string, id: string) {
  return useQuery({
    queryKey: ['cockpit', engine, 'activity-instances', id],
    queryFn: () => request<ActivityInstance>(instanceUrl(engine, id, '/activity-instances')),
  });
}

/** The instance that called this one (through a call activity), if any. */
export function useSuperProcessInstance(engine: string, id: string) {
  return useQuery({
    queryKey: ['cockpit', engine, 'super-process-instance', id],
    queryFn: async () =>
      (await request<ProcessInstance[]>(engineUrl(engine, '/process-instance'), { query: { subProcessInstance: id } }))[0] ?? null,
  });
}

/** The children of a node: activity instances, then transition instances (e.g. waiting async continuations). */
export const childrenOf = (node: ActivityInstance) => [...(node.childActivityInstances ?? []), ...(node.childTransitionInstances ?? [])];

/** The activity of a node; a multi-instance body counts as its activity. */
export const activityOf = (node: ActivityInstance) => node.activityId.replace(/#multiInstanceBody$/, '');

/** A node id unique within the tree: a transition instance may share its id with the process instance. */
export const treeIdOf = (node: ActivityInstance) => (node.executionId ? `transition:${node.id}` : node.id);

/**
 * The tree nodes to mark for a selection: the root when nothing is selected,
 * otherwise the selected instances of the selected activities.
 */
export function treeSelection(root: ActivityInstance, activityIds: string[], activityInstanceIds: string[]): string[] {
  if (!activityInstanceIds.length) {
    return [treeIdOf(root)];
  }
  return allInstances(root)
    .filter((node) => activityInstanceIds.includes(node.id) && activityIds.includes(activityOf(node)))
    .map(treeIdOf);
}

/**
 * The activity instance each execution runs in, by tree id (tasks and jobs
 * know only their execution); the innermost one where executions are shared.
 */
export function activityInstanceOfExecution(root: ActivityInstance): Map<string, string> {
  const map = new Map<string, string>();
  // depth first: inner instances come after outer ones and win
  for (const node of [root, ...allInstances(root)]) {
    for (const executionId of node.executionIds ?? (node.executionId ? [node.executionId] : [])) {
      map.set(executionId, treeIdOf(node));
    }
  }
  return map;
}

/** All nodes below the root (the process instance itself), depth first. */
export function allInstances(root: ActivityInstance): ActivityInstance[] {
  return childrenOf(root).flatMap((child) => [child, ...allInstances(child)]);
}

/** Running instances and open incidents per activity, as diagram badges. */
export function activityBadges(root: ActivityInstance): Record<string, DiagramBadge> {
  const badges: Record<string, DiagramBadge> = {};
  for (const node of allInstances(root)) {
    // a multi-instance body counts with its activity
    const activityId = activityOf(node);
    const badge = (badges[activityId] ??= { count: 0, incidents: 0 });
    if (!node.activityId.endsWith('#multiInstanceBody')) {
      badge.count! += 1;
    }
    badge.incidents! += node.incidents?.length ?? 0;
  }
  return badges;
}

/** The instances of the given activities (for a selection made in the diagram). */
export function instancesOf(root: ActivityInstance, activityIds: string[]): string[] {
  return allInstances(root)
    .filter((node) => activityIds.includes(activityOf(node)))
    .map((node) => node.id);
}

export function useInstanceSuspension(engine: string, id: string) {
  const invalidate = useInvalidateCockpit(engine);
  return useMutation({
    mutationFn: (suspended: boolean) => request<void>(instanceUrl(engine, id, '/suspended'), { method: 'PUT', json: { suspended } }),
    onSettled: invalidate,
  });
}

/** Cancels (deletes) the running instance; listeners and input/output mappings can be skipped. */
export function useCancelInstance(engine: string, id: string) {
  const invalidate = useInvalidateCockpit(engine);
  return useMutation({
    mutationFn: (options: { skipCustomListeners: boolean; skipIoMappings: boolean }) =>
      request<void>(instanceUrl(engine, id), { method: 'DELETE', query: options }),
    onSettled: invalidate,
  });
}
