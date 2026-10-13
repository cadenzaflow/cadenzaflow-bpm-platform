import { InlineNotification, SkeletonText } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { useAuthentication } from '../../../shared/auth/authentication';
import { notify } from '../../../shared/notifications';
import type { TaskTabProps } from '../task-tabs/registry';
import { useFormInfo, useSubmitForm } from './api';
import { resolveForm } from './form-key';
import { FormRenderer } from './FormRenderer';
import type { FormTarget } from './target';

/** The task's form; only the assignee may fill it in. */
export function TaskFormTab({ engine, task, onTaskCompleted }: TaskTabProps) {
  const { t } = useTranslation('tasklist');
  const userId = useAuthentication(engine).data?.userId;
  const target: FormTarget = { kind: 'task', taskId: task.id, processInstanceId: task.processInstanceId };
  const formInfo = useFormInfo(engine, target);
  const submitForm = useSubmitForm(engine, target, {
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
    : resolveForm(formInfo.data, engine, target);
  const disabled = !userId || task.assignee !== userId;

  return (
    <div className="cz-task-form">
      {disabled && form.type !== 'external' && form.type !== 'error' && (
        <InlineNotification kind="info" lowContrast hideCloseButton subtitle={t('FORM_REQUIRES_CLAIM')} />
      )}
      <FormRenderer
        form={form}
        engine={engine}
        target={target}
        disabled={disabled}
        submitting={submitForm.isPending}
        submitLabel={t('COMPLETE')}
        submit={(variables) => submitForm.mutateAsync({ variables }).then(() => true, () => false)}
        onTaskEnded={onTaskCompleted}
      />
    </div>
  );
}
