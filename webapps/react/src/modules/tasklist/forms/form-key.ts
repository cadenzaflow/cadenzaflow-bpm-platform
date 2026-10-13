import { appRoot } from '../../../shared/config';
import { targetUrls, type FormTarget } from './target';

/** GET /task/{id}/form or /process-definition/{id}/startForm */
export interface FormInfo {
  key: string | null;
  contextPath: string | null;
  camundaFormRef: unknown | null;
}

export type ResolvedForm =
  | { type: 'generic' }
  | { type: 'embedded'; url: string }
  | { type: 'camunda-forms'; url: string }
  | { type: 'external'; url: string }
  | { type: 'error'; message: string };

const EMBEDDED = 'embedded:';
const CAMUNDA_FORMS = 'camunda-forms:';
const APP = 'app:';
const DEPLOYMENT = 'deployment:';
const ENGINE = 'engine:';

/**
 * Resolves the form key of a task or start event the same way the AngularJS
 * Tasklist did:
 * - no key and no Camunda Form reference: generic form
 * - camundaFormRef, or "camunda-forms:" prefix: Camunda Form (form-js)
 * - "embedded:" prefix: embedded HTML form
 * - anything else: external form, opened in its own page
 * The rest of the key is a location: "app:" (relative to the process
 * application), "deployment:" (resource of the deployment), "engine:"
 * (relative to the webapp) or a plain URL.
 */
export function resolveForm(form: FormInfo, engine: string, target: FormTarget): ResolvedForm {
  const { deployedForm } = targetUrls(engine, target);
  if (form.camundaFormRef) {
    return { type: 'camunda-forms', url: deployedForm };
  }
  if (!form.key) {
    return { type: 'generic' };
  }

  let key = form.key;
  let type: 'embedded' | 'camunda-forms' | 'external' = 'external';
  if (key.startsWith(EMBEDDED)) {
    type = 'embedded';
    key = key.substring(EMBEDDED.length);
  } else if (key.startsWith(CAMUNDA_FORMS)) {
    type = 'camunda-forms';
    key = key.substring(CAMUNDA_FORMS.length);
  }

  if (key.startsWith(APP)) {
    if (!form.contextPath) {
      return { type: 'error', message: 'EMPTY_CONTEXT_PATH' };
    }
    return { type, url: `${form.contextPath}/${key.substring(APP.length)}`.replace(/\/{2,}/g, '/') };
  }
  if (key.startsWith(DEPLOYMENT)) {
    return { type, url: deployedForm };
  }
  if (key.startsWith(ENGINE)) {
    // e.g. engine://engine/:engine/... → the webapp's engine REST API
    return {
      type,
      url: key
        .replace(/^engine:\/\/engine\//, `${appRoot}/api/engine/engine/`)
        .replace(':engine', encodeURIComponent(engine)),
    };
  }
  return { type, url: key };
}

/** External forms get the task id (or the process definition key) and a link back to the Tasklist. */
export function externalFormUrl(url: string, target: FormTarget, callbackUrl: string, base = window.location.href): string {
  const result = new URL(url, base);
  if (target.kind === 'task') {
    result.searchParams.set('taskId', target.taskId);
  } else {
    result.searchParams.set('processDefinitionKey', target.processDefinitionKey);
  }
  result.searchParams.set('callbackUrl', callbackUrl);
  return result.toString();
}
