import { Link } from '@tanstack/react-router';
import { CopyValue } from '../../../shared/ui/CopyValue';

/** A process instance id that opens the process instance page, with a button that copies it. */
export function InstanceLink({ engine, id }: { engine: string; id: string | null | undefined }) {
  if (!id) {
    return null;
  }
  return (
    <CopyValue text={id}>
      <Link to="/cockpit/$engine/process-instance/$id" params={{ engine, id }} className="cz-instance-link">
        {id}
      </Link>
    </CopyValue>
  );
}
