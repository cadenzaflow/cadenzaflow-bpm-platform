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
import type { FormProps } from './TaskFormTab';

// Same key as the AngularJS Tasklist, so a saved draft survives the switch.
const draftKey = (taskId: string) => `camunda-form:${taskId}`;

function readDraft(taskId: string): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem(draftKey(taskId)) ?? '{}');
  } catch {
    return {};
  }
}

function writeDraft(taskId: string, data: Record<string, unknown> | null) {
  try {
    if (data) {
      localStorage.setItem(draftKey(taskId), JSON.stringify(data));
    } else {
      localStorage.removeItem(draftKey(taskId));
    }
  } catch {
    // storage blocked: drafts are a convenience only
  }
}

/** A Camunda Form (form-js schema) deployed with the process. Loaded lazily. */
export default function CamundaForm({ engine, task, url, disabled, complete, completing }: FormProps & { url: string }) {
  const { t } = useTranslation('tasklist');
  const container = useRef<HTMLDivElement>(null);
  const form = useRef<Form | null>(null);
  const [dirty, setDirty] = useState(false);
  // form-js only hands out its data through submit(), which also fires 'submit'
  const saving = useRef(false);

  const loaded = useQuery({
    queryKey: ['camunda-form', engine, task.id, url],
    gcTime: 0,
    queryFn: async () => {
      const [schema, variables] = await Promise.all([
        request<FormSchema>(url, { query: { noCache: Date.now() } }),
        fetchFormVariables(engine, task.id),
      ]);
      return { schema, variables };
    },
  });

  // The latest props for the form-js event handlers registered once below.
  const latest = useRef({ complete, disabled, completing });
  latest.current = { complete, disabled, completing };

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
      const { complete: submit, disabled: off, completing: busy } = latest.current;
      if (saving.current || off || busy || Object.keys(errors).length > 0) {
        return;
      }
      submit(toSubmitVariables(data, variables, schema)).then((completed) => completed && writeDraft(task.id, null));
    });
    instance.importSchema(schema, { ...toFormData(variables, schema), ...readDraft(task.id) });
    return () => {
      instance.destroy();
      form.current = null;
    };
  }, [loaded.data, task.id]);

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
        completing={completing}
        onComplete={() => form.current?.submit()}
        saveDisabled={disabled || !dirty}
        onSave={() => {
          saving.current = true;
          try {
            writeDraft(task.id, form.current?.submit().data ?? null);
          } finally {
            saving.current = false;
          }
          setDirty(false);
        }}
      />
    </>
  );
}
