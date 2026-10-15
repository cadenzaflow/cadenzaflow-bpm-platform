import { useEffect } from 'react';
import { InlineNotification, Loading } from '@carbon/react';
import { Outlet, useMatches, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { setCsrfCookieName } from '../shared/api/client';
import { useAuthentication } from '../shared/auth/authentication';
import { useClassicSettings } from '../shared/classic-settings';
import { setDateTimePattern } from '../shared/format';
import { chooseLanguage } from '../shared/i18n';
import { LoginPage } from '../shared/auth/LoginPage';
import { Notifications } from '../shared/notifications';
import type { ModuleName } from '../shared/config';
import { AppHeader } from './AppHeader';

/** Resolves module and engine of the current URL and puts header and login in front of every module. */
export function Shell() {
  const matches = useMatches();
  const { engine } = useParams({ strict: false }) as { engine?: string };
  const module = matches.map((match) => match.staticData?.module).filter(Boolean).pop();

  if (!module || !engine) {
    return <Outlet />;
  }
  return <ModuleShell module={module} engine={engine} />;
}

function ModuleShell({ module, engine }: { module: ModuleName; engine: string }) {
  const { t, i18n } = useTranslation();
  const authentication = useAuthentication(engine);
  // the settings of the classic app/{module}/scripts/config.js
  const settings = useClassicSettings(module);
  const language = settings.data ? chooseLanguage(settings.data.locales) : undefined;
  const moduleName = settings.data?.appName ?? t(`${module.toUpperCase()}_APP`);
  const vendor = settings.data?.appVendor ?? t('APP_VENDOR');

  if (settings.data) {
    setDateTimePattern(settings.data.dateFormat);
    setCsrfCookieName(settings.data.csrfCookieName);
  }

  useEffect(() => {
    if (language && i18n.language !== language) {
      void i18n.changeLanguage(language);
    }
  }, [i18n, language]);

  useEffect(() => {
    document.title = `${vendor} ${moduleName}`;
  }, [vendor, moduleName]);

  if (authentication.isPending || settings.isPending || (language && i18n.language !== language)) {
    return <Loading withOverlay={false} description={t('LOADING')} className="cz-page-loading" />;
  }
  if (authentication.isError) {
    return (
      <main className="cz-page-message">
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('PAGES_STATUS_COMMUNICATION_ERROR')}
          subtitle={authentication.error.message}
        />
      </main>
    );
  }
  if (!authentication.data) {
    return <LoginPage engine={engine} module={module} />;
  }

  const authorized = authentication.data.authorizedApps.includes(module);
  return (
    <>
      <AppHeader module={module} engine={engine} authentication={authentication.data} />
      <Notifications />
      <main className="cz-content">
        {authorized ? (
          <Outlet />
        ) : (
          <div className="cz-page-message">
            <InlineNotification
              kind="warning"
              lowContrast
              hideCloseButton
              title={t('PAGES_STATUS_ACCESS_DENIED')}
              subtitle={t('MODULE_NOT_AUTHORIZED', { module: moduleName })}
            />
          </div>
        )}
      </main>
    </>
  );
}
