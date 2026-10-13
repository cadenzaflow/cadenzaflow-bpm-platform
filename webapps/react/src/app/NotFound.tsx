import { InlineNotification } from '@carbon/react';
import { useTranslation } from 'react-i18next';

export function NotFound() {
  const { t } = useTranslation();
  return (
    <main className="cz-page-message">
      <InlineNotification
        kind="info"
        lowContrast
        hideCloseButton
        title={t('PAGES_STATUS_NOT_FOUND')}
        subtitle={t('PAGES_MSG_NOT_FOUND')}
      />
    </main>
  );
}
