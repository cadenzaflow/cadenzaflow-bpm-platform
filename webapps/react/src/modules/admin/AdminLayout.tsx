import { Link, Outlet, getRouteApi, useLocation } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { PluginView } from '../../shared/plugins/PluginPoint';
import { useRoutePlugin } from '../../shared/plugins/plugins';
import { useAdminAccess } from './api';
import './admin.scss';

const route = getRouteApi('/admin/$engine');

const linkProps = {
  className: 'cz-section-nav__item',
  activeProps: { className: 'is-active', 'aria-current': 'page' as const },
};

/**
 * Section navigation above every Admin page, in the order of the classic
 * Admin. A route plugin's page (classic path, e.g. #/my-page) shows instead of
 * the page when the URL names it.
 */
export function AdminLayout() {
  const { t } = useTranslation('admin');
  const { engine } = route.useParams();
  const access = useAdminAccess(engine);
  const { hash } = useLocation();
  const routePlugin = useRoutePlugin('admin', hash);

  return (
    <div className="cz-admin">
      <nav className="cz-section-nav" aria-label={t('ADMIN_SECTIONS')}>
        <Link to="/admin/$engine" params={{ engine }} activeOptions={{ exact: true }} {...linkProps}>
          {t('DASHBOARD_DASHBOARD')}
        </Link>
        <Link to="/admin/$engine/users" params={{ engine }} {...linkProps}>
          {t('USERS_USERS')}
        </Link>
        {access.groups?.has('list') && (
          <Link to="/admin/$engine/groups" params={{ engine }} {...linkProps}>
            {t('GROUPS_GROUPS')}
          </Link>
        )}
        {access.tenants?.has('list') && (
          <Link to="/admin/$engine/tenants" params={{ engine }} {...linkProps}>
            {t('TENANTS_TENANTS')}
          </Link>
        )}
        {access.authorizations && (
          <Link to="/admin/$engine/authorization" params={{ engine }} {...linkProps}>
            {t('AUTHORIZATION_AUTHORIZATIONS')}
          </Link>
        )}
        <Link to="/admin/$engine/system" params={{ engine }} {...linkProps}>
          {t('SYSTEM_SYSTEM')}
        </Link>
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
