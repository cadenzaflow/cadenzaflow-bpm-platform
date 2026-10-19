import { Link, Outlet, getRouteApi, useLocation } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { PluginPoint, PluginView } from '../../shared/plugins/PluginPoint';
import { usePluginPoint, useRoutePlugin } from '../../shared/plugins/plugins';
import './cockpit.scss';

const route = getRouteApi('/cockpit/$engine');

const linkProps = {
  className: 'cz-section-nav__item',
  activeProps: { className: 'is-active', 'aria-current': 'page' as const },
  // the page of a route plugin (#/my-page) is none of the sections
  activeOptions: { includeHash: true },
};

/**
 * Section navigation above every Cockpit page, in the order of the classic
 * Cockpit, followed by the entries of navigation plugins. A route plugin's
 * page (classic path, e.g. #/my-page) shows instead of the page when the URL
 * names it.
 */
export function CockpitLayout() {
  const { t } = useTranslation('cockpit');
  const { engine } = route.useParams();
  const { hash } = useLocation();
  const routePlugin = useRoutePlugin('cockpit', hash);
  const reports = usePluginPoint('cockpit', 'cockpit.report');

  return (
    <div className="cz-cockpit">
      <nav className="cz-section-nav" aria-label={t('COCKPIT_SECTIONS')}>
        <Link to="/cockpit/$engine" params={{ engine }} {...linkProps} activeOptions={{ ...linkProps.activeOptions, exact: true }}>
          {t('DASHBOARD_DASHBOARD')}
        </Link>
        <Link to="/cockpit/$engine/processes" params={{ engine }} {...linkProps}>
          {t('COCKPIT_PROCESSES')}
        </Link>
        <Link to="/cockpit/$engine/decisions" params={{ engine }} {...linkProps}>
          {t('COCKPIT_DECISIONS')}
        </Link>
        <Link to="/cockpit/$engine/tasks" params={{ engine }} {...linkProps}>
          {t('COCKPIT_HUMAN_TASKS')}
        </Link>
        <Link to="/cockpit/$engine/repository" params={{ engine }} {...linkProps}>
          {t('COCKPIT_DEPLOYMENTS')}
        </Link>
        <Link to="/cockpit/$engine/batch" params={{ engine }} {...linkProps}>
          {t('COCKPIT_BATCHES')}
        </Link>
        {reports.length > 0 && (
          <Link to="/cockpit/$engine/reports" params={{ engine }} {...linkProps}>
            {t('COCKPIT_REPORTS')}
          </Link>
        )}
        <PluginPoint module="cockpit" point="cockpit.navigation" engine={engine} className="cz-section-nav__plugin" />
      </nav>
      {routePlugin ? (
        <section className="cz-page cz-page--wide">
          <PluginView key={hash} plugin={routePlugin} engine={engine} />
        </section>
      ) : (
        <Outlet />
      )}
    </div>
  );
}
