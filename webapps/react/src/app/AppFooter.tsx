import { useTranslation } from 'react-i18next';

/**
 * The footer of every page, as in the AngularJS webapps: the time zone the
 * dates and times are shown in (the browser's), and the version of the webapps.
 */
export function AppFooter() {
  const { t } = useTranslation();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <footer className="cz-footer">
      <span>
        {t('CAM_WIDGET_FOOTER_TIMEZONE')} <i>{timeZone}</i>
      </span>
      <span>
        {t('CAM_WIDGET_FOOTER_POWERED_BY')}{' '}
        <a className="cds--link" href="https://cadenzaflow.org">
          CadenzaFlow Platform
        </a>{' '}
        / <span className="cz-footer__version">v{__CADENZAFLOW_VERSION__}</span>
      </span>
    </footer>
  );
}
