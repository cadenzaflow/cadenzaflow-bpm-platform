import { lazy, Suspense } from 'react';
import { InlineNotification, SkeletonText } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { useAuthentication } from '../../../shared/auth/authentication';
import { notify } from '../../../shared/notifications';
import type { Variables } from '../../../shared/variables';
import type { Task } from '../api';
import type { TaskTabProps } from '../task-tabs/registry';
import { useCompleteTask, useFormInfo } from './api';
import { ExternalForm } from './ExternalForm';
import { resolveTaskForm } from './form-key';
import { GenericForm } from './GenericForm';

// form-js and the embedded-form runtime are large; load them only when needed
const CamundaForm = lazy(() => import('./CamundaForm'));
const EmbeddedForm = lazy(() => import('../embedded-form/EmbeddedForm'));

/** What every kind of task form gets. */
export interface FormProps {
  engine: string;
  task: Task;
  /** Only the assignee may work on the form. */
  disabled: boolean;
  /** Resolves to true when the task is completed; failures are reported to the user already. */
  complete: (variables: Variables) => Promise<boolean>;
  completing: boolean;
}

export function TaskFormTab({ engine, task, onTaskCompleted }: TaskTabProps) {
  const { t } = useTranslation('tasklist');
  const userId = useAuthentication(engine).data?.userId;
  const formInfo = useFormInfo(engine, task.id);
  const completeTask = useCompleteTask(engine, task.id, {
    onSuccess: () => {
      notify({ kind: 'success', title: t('COMPLETE_OK') });
      onTaskCompleted();
    },
    onError: (error) => notify({ kind: 'error', title: t('COMPLETE_ERROR'), subtitle: error.message }),
  });

  if (formInfo.isPending) {
    return <SkeletonText paragraph lineCount={3} />;
  }
  const form = formInfo.isError
    ? { type: 'error' as const, message: formInfo.error.message }
    : resolveTaskForm(formInfo.data, engine, task.id);
  if (form.type === 'error') {
    return <InlineNotification kind="error" lowContrast hideCloseButton title={t('FORM_FAILURE')} subtitle={t(form.message)} />;
  }

  const props: FormProps = {
    engine,
    task,
    disabled: !userId || task.assignee !== userId,
    completing: completeTask.isPending,
    complete: (variables) => completeTask.mutateAsync(variables).then(
      () => true,
      () => false,
    ),
  };

  return (
    <div className="cz-task-form">
      {props.disabled && form.type !== 'external' && (
        <InlineNotification kind="info" lowContrast hideCloseButton subtitle={t('FORM_REQUIRES_CLAIM')} />
      )}
      {form.type === 'generic' && <GenericForm {...props} />}
      {form.type === 'external' && <ExternalForm {...props} url={form.url} />}
      {form.type === 'camunda-forms' && (
        <Suspense fallback={<SkeletonText paragraph lineCount={4} />}>
          <CamundaForm {...props} url={form.url} />
        </Suspense>
      )}
      {form.type === 'embedded' && (
        <Suspense fallback={<SkeletonText paragraph lineCount={4} />}>
          <EmbeddedForm {...props} url={form.url} onTaskEnded={onTaskCompleted} />
        </Suspense>
      )}
    </div>
  );
}
