import { Link } from '@tanstack/react-router';

/** A deployment id that opens the Deployments page on that deployment and, when given, the resource. */
export function DeploymentLink({ engine, deploymentId, resourceName }: { engine: string; deploymentId: string; resourceName?: string }) {
  return (
    <Link
      to="/cockpit/$engine/repository"
      params={{ engine }}
      search={{ deployment: deploymentId, resourceName, searchQuery: [{ type: 'id', operator: 'eq', value: deploymentId }] }}
    >
      {deploymentId}
    </Link>
  );
}
