import { Link } from '@tanstack/react-router';

/** A process instance id that opens the process instance page. */
export function InstanceLink({ engine, id }: { engine: string; id: string | null | undefined }) {
  if (!id) {
    return null;
  }
  return (
    <Link to="/cockpit/$engine/process-instance/$id" params={{ engine, id }} className="cz-instance-link">
      {id}
    </Link>
  );
}
