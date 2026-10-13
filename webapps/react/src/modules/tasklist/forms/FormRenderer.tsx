import { lazy, Suspense } from 'react';
import { InlineNotification, SkeletonText } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import type { Variables } from '../../../shared/variables';
import { ExternalForm } from './ExternalForm';
import type { ResolvedForm } from './form-key';
import { GenericForm } from './GenericForm';
import type { FormTarget } from './target';

// form-js and the embedded-form runtime are large; load them only when needed
const CamundaForm = lazy(() => import('./CamundaForm'));
const EmbeddedForm = lazy(() => import('./embedded/EmbeddedForm'));

/** What every kind of form gets. */
export interface FormProps {
  engine: string;
  target: FormTarget;
  /** e.g. a task form when the user is not the assignee */
  disabled: boolean;
  submitting: boolean;
  /** "Complete" for tasks, "Start" for start forms */
  submitLabel: string;
  /** Resolves to true when submitted; failures are reported to the user already. */
  submit: (variables: Variables, businessKey?: string) => Promise<boolean>;
  /** The task ended without completion (BPMN error button of an embedded form). */
  onTaskEnded?: () => void;
}

/** Shows the form of a task or start event, whatever kind it is. */
export function FormRenderer({ form, ...props }: FormProps & { form: ResolvedForm }) {
  const { t } = useTranslation('tasklist');
  const loading = <SkeletonText paragraph lineCount={4} />;
  switch (form.type) {
    case 'generic':
      return <GenericForm {...props} />;
    case 'external':
      return <ExternalForm {...props} url={form.url} />;
    case 'camunda-forms':
      return (
        <Suspense fallback={loading}>
          <CamundaForm {...props} url={form.url} />
        </Suspense>
      );
    case 'embedded':
      return (
        <Suspense fallback={loading}>
          <EmbeddedForm {...props} url={form.url} />
        </Suspense>
      );
    default:
      return (
        <InlineNotification kind="error" lowContrast hideCloseButton title={t('FORM_FAILURE')} subtitle={t(form.message)} />
      );
  }
}
