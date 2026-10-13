import { Button, Tile } from '@carbon/react';
import { useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { classicUrl, type ModuleName } from '../shared/config';

/** Placeholder for modules that are not rewritten yet. */
export function NotYetAvailable({ module }: { module: ModuleName }) {
  const { t } = useTranslation();
  const { engine } = useParams({ strict: false }) as { engine: string };
  const moduleName = t(`${module.toUpperCase()}_APP`);

  return (
    <div className="cz-page-message">
      <Tile>
        <h2 className="cz-page-message__title">{t('MODULE_NOT_AVAILABLE', { module: moduleName })}</h2>
        <p className="cz-page-message__text">{t('MODULE_NOT_AVAILABLE_TEXT', { module: moduleName })}</p>
        <Button href={classicUrl(module, engine)}>{t('OPEN_IN_CLASSIC_UI')}</Button>
      </Tile>
    </div>
  );
}
