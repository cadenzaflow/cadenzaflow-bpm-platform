import { Link, Outlet, getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import './cockpit.scss';

const route = getRouteApi('/cockpit/$engine');

const linkProps = {
  className: 'cz-section-nav__item',
  activeProps: { className: 'is-active', 'aria-current': 'page' as const },
};

/** Section navigation above every Cockpit page, in the order of the classic Cockpit. */
export function CockpitLayout() {
  const { t } = useTranslation('cockpit');
  const { engine } = route.useParams();

  return (
    <div className="cz-cockpit">
      <nav className="cz-section-nav" aria-label={t('COCKPIT_SECTIONS')}>
        <Link to="/cockpit/$engine" params={{ engine }} activeOptions={{ exact: true }} {...linkProps}>
          {t('DASHBOARD_DASHBOARD')}
        </Link>
        <Link to="/cockpit/$engine/processes" params={{ engine }} {...linkProps}>
          {t('COCKPIT_PROCESSES')}
        </Link>
      </nav>
      <Outlet />
    </div>
  );
}
