import type { ReactNode } from 'react';
import { Tile } from '@carbon/react';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useAuthentication } from '../../../shared/auth/authentication';
import { useResourceAccess } from '../api';

const route = getRouteApi('/admin/$engine/');

function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <Tile className="cz-admin-dashboard__section">
      <h2 className="cz-admin-dashboard__title">{title}</h2>
      <ul>{children}</ul>
    </Tile>
  );
}

/** Entry points of the Admin sections, shown as far as the user may use them (as in the classic Admin). */
export function AdminDashboard() {
  const { t } = useTranslation('admin');
  const { engine } = route.useParams();
  const me = useAuthentication(engine).data?.userId;
  const users = useResourceAccess(engine, '/user');

  return (
    <section className="cz-admin-page cz-admin-dashboard">
      <h1 className="cz-admin-page__title">{t('DASHBOARD_DASHBOARD')}</h1>
      <div className="cz-admin-dashboard__sections">
        <Section
          title={
            <Link to="/admin/$engine/users" params={{ engine }}>
              {t('USERS_USERS')}
            </Link>
          }
        >
          {users.data?.has('create') && (
            <li>
              <Link to="/admin/$engine/user-create" params={{ engine }}>
                {t('USERS_CREATE_NEW')}
              </Link>
            </li>
          )}
          {users.data?.has('list') && (
            <li>
              <Link to="/admin/$engine/users" params={{ engine }}>
                {t('USERS_LIST_USERS')}
              </Link>
            </li>
          )}
          {me && (
            <li>
              <Link to="/admin/$engine/users/$userId" params={{ engine, userId: me }} search={{ tab: 'profile' }}>
                {t('USERS_MY_PROFILE')}
              </Link>
            </li>
          )}
        </Section>
      </div>
    </section>
  );
}
