import { useState } from 'react';
import { Button, Form, InlineNotification, SkeletonText, Stack, Tab, TabList, TabPanel, TabPanels, Tabs, TextInput } from '@carbon/react';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { notify } from '../../../shared/notifications';
import { PageFrame } from '../../../shared/ui/PageFrame';
import type { Column } from '../../../shared/ui/ListTable';
import type { Group, Tenant, User } from '../api';
import { DeleteSection } from '../components/DeleteSection';
import { MembershipList } from '../components/MembershipList';
import { useIdentityItem } from '../resources';
import type { AdminEditSearch } from '../search';

const route = getRouteApi('/admin/$engine/tenants/$tenantId');

const TABS = ['tenant', 'groups', 'users'] as const;
const TAB_LABELS = { tenant: 'TENANTS_INFORMATION', groups: 'TENANTS_GROUPS', users: 'TENANTS_USERS' };

/** Information (name, delete), groups and users of a tenant; ?tab= selects one. Memberships are changed on the user and group pages. */
export function TenantEditPage() {
  const { t } = useTranslation('admin');
  const { engine, tenantId } = route.useParams();
  const { tab } = route.useSearch();
  const navigate = route.useNavigate();
  const { item: tenant, update, remove } = useIdentityItem<Tenant>(engine, '/tenant', tenantId);
  const [edited, setEdited] = useState<Tenant | null>(null);
  const selectedIndex = Math.max(0, TABS.indexOf(tab as (typeof TABS)[number]));
  const selected = TABS[selectedIndex];
  const name = tenant.data?.name || tenantId;
  const form = edited ?? tenant.data;

  const groupColumns: Column<Group>[] = [
    {
      key: 'id',
      header: t('GROUPS_GROUP_ID'),
      sortBy: 'id',
      render: (group) => (
        <Link to="/admin/$engine/groups/$groupId" params={{ engine, groupId: group.id }}>
          {group.id}
        </Link>
      ),
    },
    { key: 'name', header: t('GROUPS_GROUP_NAME'), sortBy: 'name', render: (group) => group.name },
    { key: 'type', header: t('GROUPS_GROUP_TYPE'), sortBy: 'type', render: (group) => group.type },
  ];
  const userColumns: Column<User>[] = [
    {
      key: 'id',
      header: t('USERS_ID'),
      sortBy: 'userId',
      render: (user) => (
        <Link to="/admin/$engine/users/$userId" params={{ engine, userId: user.id }}>
          {user.id}
        </Link>
      ),
    },
    { key: 'firstName', header: t('PLUGIN_SEARCH_USER_FIRSTNAME'), sortBy: 'firstName', render: (user) => user.firstName },
    { key: 'lastName', header: t('PLUGIN_SEARCH_USER_LASTNAME'), sortBy: 'lastName', render: (user) => user.lastName },
  ];

  return (
    <PageFrame
      title={t('TENANTS_TENANT_TITLE', { name })}
      breadcrumbs={[
        <Link key="tenants" to="/admin/$engine/tenants" params={{ engine }}>
          {t('TENANTS_TENANTS')}
        </Link>,
        name,
      ]}
    >
      {tenant.isPending && <SkeletonText paragraph lineCount={4} />}
      {tenant.isError && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={tenant.error.message} />}
      {tenant.data && form && (
        <Tabs
          selectedIndex={selectedIndex}
          onChange={({ selectedIndex: index }) =>
            navigate({ search: (previous: AdminEditSearch) => ({ ...previous, tab: TABS[index] }), replace: true })
          }
        >
          <TabList aria-label={t('TENANTS_TENANT')}>
            {TABS.map((id) => (
              <Tab key={id}>{t(TAB_LABELS[id])}</Tab>
            ))}
          </TabList>
          <TabPanels>
            <TabPanel>
              {selected === 'tenant' && (
                <Stack gap={7} className="cz-admin-form">
                  <Form
                    onSubmit={(event) => {
                      event.preventDefault();
                      update.mutate(form, {
                        onSuccess: () => {
                          setEdited(null);
                          notify({ kind: 'success', title: t('TENANTS_TENANT_UPDATE_SUCCESS') });
                        },
                        onError: (error) =>
                          notify({
                            kind: 'error',
                            title: t('NOTIFICATIONS_STATUS_FAILED'),
                            subtitle: t('TENANTS_TENANT_UPDATE_FAILED', { message: error.message }),
                          }),
                      });
                    }}
                  >
                    <Stack gap={6}>
                      <TextInput
                        id="cz-tenant-name"
                        labelText={t('TENANTS_TENANT_NAME')}
                        value={form.name ?? ''}
                        invalid={!form.name?.trim()}
                        invalidText={t('TENANTS_NAME_REQUIRED')}
                        onChange={(event) => setEdited({ ...form, name: event.target.value })}
                      />
                      <div>
                        <Button type="submit" disabled={!edited || !form.name?.trim() || update.isPending}>
                          {t('TENANTS_UPDATE_TENANT')}
                        </Button>
                      </div>
                    </Stack>
                  </Form>
                  <DeleteSection
                    label={t('TENANTS_DELETE_TENANT')}
                    warningTitle={t('TENANTS_WARNING')}
                    warningText={t('TENANTS_DELETING_TENANT_UNDONE')}
                    question={t('TENANTS_TENANT_DELETE_CONFIRM', { tenant: tenantId })}
                    busy={remove.isPending}
                    onDelete={() =>
                      remove.mutate(tenantId, {
                        onSuccess: () => {
                          notify({ kind: 'success', title: t('TENANTS_TENANT_DELETE_SUCCESS', { tenant: tenantId }) });
                          navigate({ to: '/admin/$engine/tenants', params: { engine } });
                        },
                        onError: (error) =>
                          notify({
                            kind: 'error',
                            title: t('NOTIFICATIONS_STATUS_FAILED'),
                            subtitle: t('TENANTS_TENANT_DELETE_FAILED', { tenant: tenantId, message: error.message }),
                          }),
                      })
                    }
                  />
                </Stack>
              )}
            </TabPanel>
            <TabPanel>
              {selected === 'groups' && (
                <MembershipList<Group>
                  engine={engine}
                  title={t('TENANTS_TENANT_GROUPS')}
                  listPath="/group"
                  query={{ memberOfTenant: tenantId }}
                  columns={groupColumns}
                  defaultSortBy="id"
                  emptyText={t('TENANTS_NO_GROUPS', { tenant: name })}
                />
              )}
            </TabPanel>
            <TabPanel>
              {selected === 'users' && (
                <MembershipList<User>
                  engine={engine}
                  title={t('TENANTS_TENANT_USERS')}
                  listPath="/user"
                  query={{ memberOfTenant: tenantId }}
                  columns={userColumns}
                  defaultSortBy="userId"
                  emptyText={t('TENANTS_NO_USERS', { tenant: name })}
                />
              )}
            </TabPanel>
          </TabPanels>
        </Tabs>
      )}
    </PageFrame>
  );
}
