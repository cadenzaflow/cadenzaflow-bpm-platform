import type { ReactNode } from 'react';
import { Tile } from '@carbon/react';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useAuthentication } from '../../../shared/auth/authentication';
import { PluginView } from '../../../shared/plugins/PluginPoint';
import { usePluginPoint } from '../../../shared/plugins/plugins';
import { useAdminAccess } from '../api';
import { SYSTEM_SECTIONS } from '../system/search';

const route = getRouteApi('/admin/$engine/');

function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <Tile className="cz-admin-dashboard__section">
      <h2 className="cz-admin-dashboard__title">{title}</h2>
      <ul>{children}</ul>
    </Tile>
  );
}

/**
 * Entry points of the Admin sections, shown as far as the user may use them
 * (as in the classic Admin), followed by the sections of plugins.
 */
export function AdminDashboard() {
  const { t } = useTranslation('admin');
  const { engine } = route.useParams();
  const me = useAuthentication(engine).data?.userId;
  const { users, groups, tenants, authorizations } = useAdminAccess(engine);
  const sectionPlugins = usePluginPoint('admin', 'admin.dashboard.section');
  const systemPlugins = usePluginPoint('admin', 'admin.system');

  return (
    <section className="cz-page cz-admin-dashboard">
      <h1 className="cz-page__title">{t('DASHBOARD_DASHBOARD')}</h1>
      <div className="cz-admin-dashboard__sections">
        <Section
          title={
            <Link to="/admin/$engine/users" params={{ engine }}>
              {t('USERS_USERS')}
            </Link>
          }
        >
          {users?.has('create') && (
            <li>
              <Link to="/admin/$engine/user-create" params={{ engine }}>
                {t('USERS_CREATE_NEW')}
              </Link>
            </li>
          )}
          {users?.has('list') && (
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
        {groups?.has('list') && (
          <Section
            title={
              <Link to="/admin/$engine/groups" params={{ engine }}>
                {t('GROUPS_GROUPS')}
              </Link>
            }
          >
            {groups.has('create') && (
              <li>
                <Link to="/admin/$engine/group-create" params={{ engine }}>
                  {t('GROUPS_CREATE_NEW')}
                </Link>
              </li>
            )}
            <li>
              <Link to="/admin/$engine/groups" params={{ engine }}>
                {t('GROUPS_LIST_OF_GROUPS')}
              </Link>
            </li>
          </Section>
        )}
        {tenants?.has('list') && (
          <Section
            title={
              <Link to="/admin/$engine/tenants" params={{ engine }}>
                {t('TENANTS_TENANTS')}
              </Link>
            }
          >
            {tenants.has('create') && (
              <li>
                <Link to="/admin/$engine/tenant-create" params={{ engine }}>
                  {t('TENANTS_CREATE_NEW')}
                </Link>
              </li>
            )}
            <li>
              <Link to="/admin/$engine/tenants" params={{ engine }}>
                {t('TENANTS_LIST_TENANTS')}
              </Link>
            </li>
          </Section>
        )}
        {authorizations && (
          <Section
            title={
              <Link to="/admin/$engine/authorization" params={{ engine }}>
                {t('AUTHORIZATION_AUTHORIZATIONS')}
              </Link>
            }
          >
            <li>
              <Link to="/admin/$engine/authorization" params={{ engine }}>
                {t('AUTHORIZATION_MANAGE_AUTHORIZATIONS')}
              </Link>
            </li>
          </Section>
        )}
        <Section
          title={
            <Link to="/admin/$engine/system" params={{ engine }}>
              {t('SYSTEM_SYSTEM')}
            </Link>
          }
        >
          {[...SYSTEM_SECTIONS, ...systemPlugins.map((plugin) => ({ id: plugin.id, label: plugin.label ?? plugin.id }))].map(
            (section) => (
              <li key={section.id}>
                <Link to="/admin/$engine/system" params={{ engine }} search={{ section: section.id }}>
                  {t(section.label)}
                </Link>
              </li>
            ),
          )}
        </Section>
        {sectionPlugins.map((plugin) => (
          <Tile key={plugin.id} className="cz-admin-dashboard__section">
            <h2 className="cz-admin-dashboard__title">{t(plugin.label ?? plugin.id)}</h2>
            <PluginView plugin={plugin} engine={engine} />
          </Tile>
        ))}
      </div>
    </section>
  );
}
