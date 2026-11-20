import { useEffect } from 'react';
import { InlineNotification, Loading } from '@carbon/react';
import { Outlet, useMatches, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { setCsrfCookieName } from '../shared/api/client';
import { useAuthentication } from '../shared/auth/authentication';
import { useClassicSettings } from '../shared/classic-settings';
import { setDateTimePattern } from '../shared/format';
import { useEngines } from '../shared/engines';
import { chooseLanguage } from '../shared/i18n';
import { LoginPage } from '../shared/auth/LoginPage';
import { Notifications } from '../shared/notifications';
import { EngineLinks } from '../shared/ui/EngineLinks';
import type { ModuleName } from '../shared/config';
import { AppFooter } from './AppFooter';
import { AppHeader } from './AppHeader';

/**
 * Resolves module and engine of the current URL and puts header and login in
 * front of every module; the footer is below every page.
 */
export function Shell() {
  const matches = useMatches();
  const { engine } = useParams({ strict: false }) as { engine?: string };
  const module = matches.map((match) => match.staticData?.module).filter(Boolean).pop();

  return (
    <div className="cz-shell">
      <div className="cz-shell__page">{!module || !engine ? <Outlet /> : <ModuleShell module={module} engine={engine} />}</div>
      <AppFooter />
    </div>
  );
}

function ModuleShell({ module, engine }: { module: ModuleName; engine: string }) {
  const { t, i18n } = useTranslation();
  const authentication = useAuthentication(engine);
  const engines = useEngines();
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

  // an engine the server does not have (a mistyped or an old link); nobody can be logged in to it
  const unknownEngine = !!engines.data && !engines.data.includes(engine);
  if (settings.isPending || (language && i18n.language !== language) || (authentication.isPending && !unknownEngine)) {
    return <Loading withOverlay={false} description={t('LOADING')} className="cz-page-loading" />;
  }
  if (unknownEngine) {
    return (
      <main className="cz-page-message">
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('PAGES_STATUS_NOT_FOUND')}
          subtitle={t('DIRECTIVE_ENGINE_SELECT_MESSAGE_NOT_FOUND')}
        />
        <EngineLinks module={module} engine={engine} engines={engines.data ?? []} />
      </main>
    );
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
    return <LoginPage engine={engine} module={module} appName={moduleName} vendor={vendor} engines={engines.data ?? []} />;
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
