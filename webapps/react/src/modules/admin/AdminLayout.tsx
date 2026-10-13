import { Link, Outlet, getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import './admin.scss';

const route = getRouteApi('/admin/$engine');

/** The Admin's sections, in the order of the classic Admin. */
const SECTIONS = [{ to: '/admin/$engine/users', label: 'USERS_USERS' }] as const;

/** Section navigation above every Admin page. */
export function AdminLayout() {
  const { t } = useTranslation('admin');
  const { engine } = route.useParams();

  return (
    <div className="cz-admin">
      <nav className="cz-admin-nav" aria-label={t('ADMIN_SECTIONS')}>
        <Link
          to="/admin/$engine"
          params={{ engine }}
          className="cz-admin-nav__item"
          activeOptions={{ exact: true }}
          activeProps={{ className: 'is-active', 'aria-current': 'page' }}
        >
          {t('DASHBOARD_DASHBOARD')}
        </Link>
        {SECTIONS.map((section) => (
          <Link
            key={section.to}
            to={section.to}
            params={{ engine }}
            className="cz-admin-nav__item"
            activeProps={{ className: 'is-active', 'aria-current': 'page' }}
          >
            {t(section.label)}
          </Link>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
