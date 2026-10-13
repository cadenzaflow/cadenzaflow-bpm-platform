import { useEffect, useRef, useState } from 'react';
import { InlineNotification, SkeletonText } from '@carbon/react';
import { useQueryClient } from '@tanstack/react-query';
import $ from 'jquery';
import { useTranslation } from 'react-i18next';
import { useAuthentication } from '../../../shared/auth/authentication';
import { notify } from '../../../shared/notifications';
import { FormActions } from '../task-form/FormActions';
import type { FormProps } from '../task-form/TaskFormTab';
import { CamundaForm, isType } from './sdk';
import { createSdkClient, ReportedError } from './sdk-client';
import './embedded-form.scss';

// cam-variable-type values the runtime checks on submit; checked while typing here
const CHECKED_TYPES = ['Integer', 'Long', 'Short', 'Double', 'Float', 'Date', 'Json', 'Xml'];

/** Lets the browser's form validation report values that do not fit their cam-variable-type. */
function addTypeValidation(form: HTMLFormElement, message: (type: string) => string) {
  form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[cam-variable-type]').forEach((field) => {
    const type = field.getAttribute('cam-variable-type') ?? '';
    if (!CHECKED_TYPES.includes(type) || ('type' in field && field.type === 'checkbox')) {
      return;
    }
    const check = () => field.setCustomValidity(field.value && !isType(field.value.trim(), type) ? message(type) : '');
    field.addEventListener('input', check);
    check();
  });
}

/** The parts of the runtime's form object used here (formElement is a jQuery object). */
interface CamForm {
  formElement: { 0: HTMLFormElement; on: (events: string, handler: (event: Event) => void) => void };
  submit: (done: (error: Error | null) => void) => void;
  store: (done: (error?: Error) => void) => void;
  on: (event: string, handler: (arg?: unknown) => void) => void;
}

/** An embedded HTML form (cam-variable-name & co.), as written for the AngularJS Tasklist. Loaded lazily. */
export default function EmbeddedForm({
  engine,
  task,
  url,
  disabled,
  complete,
  completing,
  onTaskEnded,
}: FormProps & { url: string; onTaskEnded: () => void }) {
  const { t } = useTranslation('tasklist');
  const queryClient = useQueryClient();
  const userId = useAuthentication(engine).data?.userId;
  const container = useRef<HTMLFieldSetElement>(null);
  const camForm = useRef<CamForm | null>(null);
  const [status, setStatus] = useState<{ state: 'loading' | 'ready' | 'failed'; message?: string }>({
    state: 'loading',
  });
  const [dirty, setDirty] = useState(false);

  // latest props for the runtime's callbacks, which are registered once per form
  const latest = useRef({ complete, onTaskEnded, t });
  latest.current = { complete, onTaskEnded, t };

  useEffect(() => {
    // a fresh host per form, so a late answer for a previous form cannot draw into this one
    const host = document.createElement('div');
    container.current!.appendChild(host);
    let active = true;
    setStatus({ state: 'loading' });
    setDirty(false);

    const refreshLists = () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['filter-tasks', engine] }),
        queryClient.invalidateQueries({ queryKey: ['task-filters', engine] }),
      ]);

    new CamundaForm({
      client: createSdkClient(engine, (variables) => latest.current.complete(variables)),
      taskId: task.id,
      formUrl: url,
      containerElement: $(host),
      urlParams: { taskId: task.id, userId, engineName: engine },
      done: (error: Error | null, form: CamForm) => {
        if (!active) {
          return;
        }
        if (error) {
          setStatus({ state: 'failed', message: error.message });
          return;
        }
        camForm.current = form;
        const element = form.formElement[0];
        addTypeValidation(element, (type) => latest.current.t('INVALID_VALUE_FOR_TYPE', { type }));
        form.formElement.on('input change', () => setDirty(true));
        // Enter in a field must not post the page
        form.formElement.on('submit', (event) => event.preventDefault());
        form.on('error-success', () => {
          notify({ kind: 'success', title: latest.current.t('BPMN_ERROR_OK') });
          refreshLists();
          latest.current.onTaskEnded();
        });
        form.on('escalation-success', () => {
          notify({ kind: 'success', title: latest.current.t('ESCALATION_OK') });
          refreshLists();
          queryClient.invalidateQueries({ queryKey: ['task', engine, task.id] });
        });
        const failed = (failure?: unknown) =>
          notify({ kind: 'error', title: latest.current.t('FORM_FAILURE'), subtitle: (failure as Error)?.message });
        form.on('error-failed', failed);
        form.on('escalation-failed', failed);
        setStatus({ state: 'ready' });
      },
    });

    return () => {
      active = false;
      camForm.current = null;
      host.remove();
    };
  }, [engine, task.id, url, userId, queryClient]);

  const onComplete = () => {
    const form = camForm.current;
    if (!form || !form.formElement[0].reportValidity()) {
      return;
    }
    form.submit((error) => {
      // server failures were reported by complete(); a form script may cancel on purpose
      if (error && !(error instanceof ReportedError) && error.message !== 'camForm submission prevented') {
        notify({ kind: 'error', title: t('COMPLETE_ERROR'), subtitle: error.message });
      }
    });
  };

  const onSave = () =>
    camForm.current?.store((error) =>
      error ? notify({ kind: 'error', title: t('FORM_FAILURE'), subtitle: error.message }) : setDirty(false),
    );

  return (
    <>
      {status.state === 'loading' && <SkeletonText paragraph lineCount={4} />}
      {status.state === 'failed' && (
        <InlineNotification kind="error" lowContrast hideCloseButton title={t('FORM_FAILURE')} subtitle={status.message} />
      )}
      <fieldset ref={container} className="cz-embedded-form" disabled={disabled} />
      {status.state === 'ready' && (
        <FormActions
          disabled={disabled}
          completing={completing}
          onComplete={onComplete}
          saveDisabled={disabled || !dirty}
          onSave={onSave}
        />
      )}
    </>
  );
}
