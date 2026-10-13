import { Button } from '@carbon/react';
import { Launch } from '@carbon/icons-react';
import { useTranslation } from 'react-i18next';
import { moduleUrl } from '../../../shared/config';
import { externalFormUrl } from './form-key';
import type { FormProps } from './TaskFormTab';

/** The task is completed in another application, which links back to the Tasklist. */
export function ExternalForm({ engine, task, url }: FormProps & { url: string }) {
  const { t } = useTranslation('tasklist');
  const callbackUrl = new URL(moduleUrl('tasklist', engine), window.location.href).toString();
  return (
    <div className="cz-external-form">
      <p className="cz-form-hint">{t('TASK_EXTERNAL_FORM_NOTE')}</p>
      <Button kind="tertiary" href={externalFormUrl(url, task.id, callbackUrl)} renderIcon={Launch}>
        {t('EXTERNAL_FORM_LINK')}
      </Button>
    </div>
  );
}
