import { InlineNotification } from '@carbon/react';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../shared/api/client';

/** Shown by the router when rendering or loading a page fails. */
export function ErrorView({ error }: ErrorComponentProps) {
  const { t } = useTranslation();
  const status = error instanceof ApiError ? error.status : undefined;
  return (
    <div className="cz-page-message">
      <InlineNotification
        kind="error"
        lowContrast
        hideCloseButton
        title={t('PAGES_STATUS_COMMUNICATION_ERROR')}
        subtitle={status ? t('PAGES_MSG_COMMUNICATION_ERROR', { status }) : String((error as Error)?.message ?? error)}
      />
    </div>
  );
}
