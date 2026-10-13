import { useEffect, useRef, useState } from 'react';
import { InlineNotification, SkeletonText } from '@carbon/react';
import { useQuery } from '@tanstack/react-query';
import { Form } from '@bpmn-io/form-js-viewer';
import '@bpmn-io/form-js-viewer/dist/assets/form-js.css';
import { useTranslation } from 'react-i18next';
import { request } from '../../../shared/api/client';
import { fetchFormVariables } from './api';
import { toFormData, toSubmitVariables, type FormSchema } from './camunda-form-data';
import { FormActions } from './FormActions';
import type { FormProps } from './FormRenderer';
import { draftId } from './target';

// Same key as the AngularJS Tasklist, so a draft saved there shows up here.
const draftKey = (id: string) => `camunda-form:${id}`;

function readDraft(id: string | null): Record<string, unknown> {
  try {
    return id ? JSON.parse(localStorage.getItem(draftKey(id)) ?? '{}') : {};
  } catch {
    return {};
  }
}

function writeDraft(id: string | null, data: Record<string, unknown> | null) {
  if (!id) {
    return;
  }
  try {
    if (data) {
      localStorage.setItem(draftKey(id), JSON.stringify(data));
    } else {
      localStorage.removeItem(draftKey(id));
    }
  } catch {
    // storage blocked: drafts are a convenience only
  }
}

/** A Camunda Form (form-js schema) deployed with the process. Loaded lazily. */
export default function CamundaForm({
  engine,
  target,
  url,
  disabled,
  submit,
  submitting,
  submitLabel,
}: FormProps & { url: string }) {
  const draft = draftId(target);
  const { t } = useTranslation('tasklist');
  const container = useRef<HTMLDivElement>(null);
  const form = useRef<Form | null>(null);
  const [dirty, setDirty] = useState(false);
  // form-js only hands out its data through submit(), which also fires 'submit'
  const saving = useRef(false);

  const loaded = useQuery({
    queryKey: ['camunda-form', engine, url],
    gcTime: 0,
    queryFn: async () => {
      const [schema, variables] = await Promise.all([
        request<FormSchema>(url, { query: { noCache: Date.now() } }),
        fetchFormVariables(engine, target),
      ]);
      return { schema, variables };
    },
  });

  // The latest props for the form-js event handlers registered once below.
  const latest = useRef({ submit, disabled, submitting });
  latest.current = { submit, disabled, submitting };

  useEffect(() => {
    if (!loaded.data || !container.current) {
      return;
    }
    const { schema, variables } = loaded.data;
    const instance = new Form({ container: container.current });
    form.current = instance;
    instance.on('changed', () => setDirty(true));
    // fired by our Complete button and by submit buttons inside the form
    instance.on('submit', ({ data, errors }: { data: Record<string, unknown>; errors: Record<string, unknown> }) => {
      const { submit: send, disabled: off, submitting: busy } = latest.current;
      if (saving.current || off || busy || Object.keys(errors).length > 0) {
        return;
      }
      send(toSubmitVariables(data, variables, schema)).then((sent) => sent && writeDraft(draft, null));
    });
    instance.importSchema(schema, { ...toFormData(variables, schema), ...readDraft(draft) });
    return () => {
      instance.destroy();
      form.current = null;
    };
  }, [loaded.data, draft]);

  useEffect(() => {
    form.current?.setProperty('disabled', disabled);
  }, [disabled, loaded.data]);

  if (loaded.isPending) {
    return <SkeletonText paragraph lineCount={4} />;
  }
  if (loaded.isError) {
    return (
      <InlineNotification
        kind="error"
        lowContrast
        hideCloseButton
        title={t('FORM_FAILURE')}
        subtitle={loaded.error.message}
      />
    );
  }
  return (
    <>
      <div ref={container} className="cz-camunda-form" />
      <FormActions
        disabled={disabled}
        submitting={submitting}
        submitLabel={submitLabel}
        onSubmit={() => form.current?.submit()}
        saveDisabled={disabled || !dirty}
        onSave={
          draft
            ? () => {
                saving.current = true;
                try {
                  writeDraft(draft, form.current?.submit().data ?? null);
                } finally {
                  saving.current = false;
                }
                setDirty(false);
              }
            : undefined
        }
      />
    </>
  );
}
