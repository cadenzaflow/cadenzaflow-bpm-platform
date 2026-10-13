import { engineUrl } from '../../../shared/api/client';

/** What a form submits to: completing a task, or starting a process. */
export type FormTarget =
  | { kind: 'task'; taskId: string; processInstanceId: string | null }
  | { kind: 'start'; processDefinitionId: string; processDefinitionKey: string };

const base = (target: FormTarget) =>
  target.kind === 'task'
    ? `/task/${encodeURIComponent(target.taskId)}`
    : `/process-definition/${encodeURIComponent(target.processDefinitionId)}`;

/** REST URLs of a target's form, its variables and its submission. */
export function targetUrls(engine: string, target: FormTarget) {
  const path = base(target);
  return {
    /** GET: { key, contextPath, camundaFormRef } */
    formInfo: engineUrl(engine, target.kind === 'task' ? `${path}/form` : `${path}/startForm`),
    /** GET: the form stored in the deployment (deployment: keys, Camunda Forms) */
    deployedForm: engineUrl(engine, target.kind === 'task' ? `${path}/deployed-form` : `${path}/deployed-start-form`),
    formVariables: engineUrl(engine, `${path}/form-variables`),
    submit: engineUrl(engine, `${path}/submit-form`),
  };
}

/** Key under which a draft of the form is kept; start forms keep none. */
export const draftId = (target: FormTarget) => (target.kind === 'task' ? target.taskId : null);
