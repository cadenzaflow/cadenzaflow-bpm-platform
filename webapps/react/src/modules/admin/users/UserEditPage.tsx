import { useState } from 'react';
import { Button, InlineNotification, SkeletonText, Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { Add } from '@carbon/icons-react';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useUserProfile } from '../../../shared/auth/authentication';
import { displayName } from '../../../shared/format';
import { AdminPage } from '../components/AdminPage';
import type { AdminEditSearch } from '../search';
import { AccountTab } from './AccountTab';
import { ProfileTab } from './ProfileTab';
import { UserMembershipsTab } from './UserMembershipsTab';

const route = getRouteApi('/admin/$engine/users/$userId');

const TABS = ['profile', 'account', 'groups', 'tenants'] as const;
const TAB_LABELS = { profile: 'USERS_PROFILE', account: 'USERS_ACCOUNT', groups: 'USERS_GROUPS', tenants: 'USERS_TENANTS' };

/** Profile, account (password, delete, unlock), groups and tenants of a user; ?tab= selects one. */
export function UserEditPage() {
  const { t } = useTranslation('admin');
  const { engine, userId } = route.useParams();
  const { tab } = route.useSearch();
  const navigate = route.useNavigate();
  const profile = useUserProfile(engine, userId);
  const [adding, setAdding] = useState(false);
  const selectedIndex = Math.max(0, TABS.indexOf(tab as (typeof TABS)[number]));
  const selected = TABS[selectedIndex];
  const name = displayName(profile.data, userId);

  return (
    <AdminPage
      title={t('USERS_EDIT_USER', { user: name })}
      breadcrumbs={[
        <Link key="users" to="/admin/$engine/users" params={{ engine }}>
          {t('USERS_USERS')}
        </Link>,
        name,
      ]}
      actions={
        profile.data &&
        (selected === 'groups' || selected === 'tenants') && (
          <Button size="md" renderIcon={Add} onClick={() => setAdding(true)}>
            {t(selected === 'groups' ? 'USERS_ADD_TO_A_GROUP' : 'USERS_ADD_TO_A_TENANT')}
          </Button>
        )
      }
    >
      {profile.isPending && <SkeletonText paragraph lineCount={4} />}
      {profile.isError && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={profile.error.message} />}
      {profile.data && (
        <Tabs
          selectedIndex={selectedIndex}
          onChange={({ selectedIndex: index }) =>
            navigate({ search: (previous: AdminEditSearch) => ({ ...previous, tab: TABS[index] }), replace: true })
          }
        >
          <TabList aria-label={t('USERS_USER')}>
            {TABS.map((id) => (
              <Tab key={id}>{t(TAB_LABELS[id])}</Tab>
            ))}
          </TabList>
          <TabPanels>
            {TABS.map((id) => (
              <TabPanel key={id}>
                {id === selected && id === 'profile' && <ProfileTab engine={engine} profile={profile.data} />}
                {id === selected && id === 'account' && <AccountTab engine={engine} profile={profile.data} />}
                {id === selected && (id === 'groups' || id === 'tenants') && (
                  <UserMembershipsTab
                    engine={engine}
                    profile={profile.data}
                    kind={id === 'groups' ? 'group' : 'tenant'}
                    adding={adding}
                    onAddingDone={() => setAdding(false)}
                  />
                )}
              </TabPanel>
            ))}
          </TabPanels>
        </Tabs>
      )}
    </AdminPage>
  );
}
