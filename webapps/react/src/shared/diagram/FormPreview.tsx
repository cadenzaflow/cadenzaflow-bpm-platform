import { useEffect, useRef, useState } from 'react';
import { InlineNotification } from '@carbon/react';
import { Form } from '@bpmn-io/form-js-viewer';
import '@bpmn-io/form-js-viewer/dist/assets/form-js.css';

/** A Camunda Form (form-js schema) rendered read-only. Load it lazily: form-js is large. */
export default function FormPreview({ schema, errorTitle }: { schema: string; errorTitle: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const form = new Form({ container: container.current, properties: { readOnly: true } });
    let active = true;
    setError(null);
    Promise.resolve()
      .then(() => form.importSchema(JSON.parse(schema)))
      .catch((failure: Error) => active && setError(failure.message));
    return () => {
      active = false;
      form.destroy();
    };
  }, [schema]);

  return (
    <>
      {error && <InlineNotification kind="error" lowContrast hideCloseButton title={errorTitle} subtitle={error} />}
      <div ref={container} className="cz-form-preview" />
    </>
  );
}
