import { Button, InlineLoading } from '@carbon/react';
import { useTranslation } from 'react-i18next';

interface FormActionsProps {
  disabled: boolean;
  completing: boolean;
  onComplete: () => void;
  /** Forms that can keep a draft in the browser offer "Save". */
  onSave?: () => void;
  saveDisabled?: boolean;
}

export function FormActions({ disabled, completing, onComplete, onSave, saveDisabled }: FormActionsProps) {
  const { t } = useTranslation('tasklist');
  return (
    <div className="cz-form-actions">
      {onSave && (
        <Button kind="secondary" title={t('SAVE_HINT')} disabled={saveDisabled || completing} onClick={onSave}>
          {t('SAVE')}
        </Button>
      )}
      {completing ? (
        <InlineLoading description={t('COMPLETE')} />
      ) : (
        <Button kind="primary" disabled={disabled} onClick={onComplete}>
          {t('COMPLETE')}
        </Button>
      )}
    </div>
  );
}
