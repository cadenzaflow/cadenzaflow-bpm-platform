import { Button, InlineLoading } from '@carbon/react';
import { useTranslation } from 'react-i18next';

interface FormActionsProps {
  disabled: boolean;
  submitting: boolean;
  submitLabel: string;
  onSubmit: () => void;
  /** Task forms that can keep a draft in the browser offer "Save". */
  onSave?: () => void;
  saveDisabled?: boolean;
}

export function FormActions({ disabled, submitting, submitLabel, onSubmit, onSave, saveDisabled }: FormActionsProps) {
  const { t } = useTranslation('tasklist');
  return (
    <div className="cz-form-actions">
      {onSave && (
        <Button kind="secondary" title={t('SAVE_HINT')} disabled={saveDisabled || submitting} onClick={onSave}>
          {t('SAVE')}
        </Button>
      )}
      {submitting ? (
        <InlineLoading description={submitLabel} />
      ) : (
        <Button kind="primary" disabled={disabled} onClick={onSubmit}>
          {submitLabel}
        </Button>
      )}
    </div>
  );
}
