import { Link } from '@tanstack/react-router';
import { CopyValue } from '../../../shared/ui/CopyValue';

/** A deployment id that opens the Deployments page on that deployment and, when given, the resource; a button copies the id. */
export function DeploymentLink({ engine, deploymentId, resourceName }: { engine: string; deploymentId: string; resourceName?: string }) {
  return (
    <CopyValue text={deploymentId}>
      <Link
        to="/cockpit/$engine/repository"
        params={{ engine }}
        search={{ deployment: deploymentId, resourceName, searchQuery: [{ type: 'id', operator: 'eq', value: deploymentId }] }}
      >
        {deploymentId}
      </Link>
    </CopyValue>
  );
}
