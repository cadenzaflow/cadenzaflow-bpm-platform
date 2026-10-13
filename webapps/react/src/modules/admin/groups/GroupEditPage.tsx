import { useState } from 'react';
import {
  Button,
  Form,
  InlineNotification,
  SkeletonText,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  TextInput,
} from '@carbon/react';
import { Add } from '@carbon/icons-react';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { notify } from '../../../shared/notifications';
import { useIds, type Group, type Tenant, type User } from '../api';
import { AdminPage } from '../components/AdminPage';
import { DeleteSection } from '../components/DeleteSection';
import type { Column } from '../components/ListTable';
import { MembershipList } from '../components/MembershipList';
import { MembershipModal } from '../components/MembershipModal';
import { useGroupTenants, useIdentityItem } from '../resources';
import type { AdminEditSearch } from '../search';

const route = getRouteApi('/admin/$engine/groups/$groupId');

const TABS = ['group', 'tenants', 'users'] as const;
const TAB_LABELS = { group: 'GROUP_EDIT_INFORMATION', tenants: 'GROUP_EDIT_TENANTS_LINK', users: 'GROUP_EDIT_USERS' };

/** Information (name, type, delete), tenants and users of a group; ?tab= selects one. */
export function GroupEditPage() {
  const { t } = useTranslation('admin');
  const { engine, groupId } = route.useParams();
  const { tab } = route.useSearch();
  const navigate = route.useNavigate();
  const { item: group, update, remove } = useIdentityItem<Group>(engine, '/group', groupId);
  const tenants = useGroupTenants(engine, groupId);
  const tenantIds = useIds(engine, '/tenant', { groupMember: groupId });
  const [edited, setEdited] = useState<Group | null>(null);
  const [adding, setAdding] = useState(false);
  const selectedIndex = Math.max(0, TABS.indexOf(tab as (typeof TABS)[number]));
  const selected = TABS[selectedIndex];
  const name = group.data?.name || groupId;
  const form = edited ?? group.data;

  const tenantColumns = (idHeader: string, nameHeader: string): Column<Tenant>[] => [
    {
      key: 'id',
      header: idHeader,
      sortBy: 'id',
      render: (tenant) => (
        <Link to="/admin/$engine/tenants/$tenantId" params={{ engine, tenantId: tenant.id }}>
          {tenant.id}
        </Link>
      ),
    },
    { key: 'name', header: nameHeader, sortBy: 'name', render: (tenant) => tenant.name },
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
    <AdminPage
      title={t('GROUP_EDIT_EDIT_GROUP', { group: name })}
      breadcrumbs={[
        <Link key="groups" to="/admin/$engine/groups" params={{ engine }}>
          {t('GROUPS_GROUPS')}
        </Link>,
        name,
      ]}
      actions={
        group.data &&
        selected === 'tenants' && (
          <Button size="md" renderIcon={Add} onClick={() => setAdding(true)}>
            {t('GROUP_EDIT_ADD_TO_TENANT')}
          </Button>
        )
      }
    >
      {group.isPending && <SkeletonText paragraph lineCount={4} />}
      {group.isError && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={group.error.message} />}
      {group.data && form && (
        <Tabs
          selectedIndex={selectedIndex}
          onChange={({ selectedIndex: index }) =>
            navigate({ search: (previous: AdminEditSearch) => ({ ...previous, tab: TABS[index] }), replace: true })
          }
        >
          <TabList aria-label={t('GROUP_EDIT_GROUP_DETAILS')}>
            {TABS.map((id) => (
              <Tab key={id}>{t(TAB_LABELS[id])}</Tab>
            ))}
          </TabList>
          <TabPanels>
            <TabPanel>
              {selected === 'group' && (
                <Stack gap={7} className="cz-admin-form">
                  <Form
                    onSubmit={(event) => {
                      event.preventDefault();
                      update.mutate(form, {
                        onSuccess: () => {
                          setEdited(null);
                          notify({ kind: 'success', title: t('GROUP_EDIT_UPDATE_SUCCESS') });
                        },
                        onError: (error) =>
                          notify({
                            kind: 'error',
                            title: t('NOTIFICATIONS_STATUS_FAILED'),
                            subtitle: t('GROUP_EDIT_UPDATE_FAILED', { message: error.message }),
                          }),
                      });
                    }}
                  >
                    <Stack gap={6}>
                      <h2 className="cz-admin-form__section">{t('GROUP_EDIT_GROUP_DETAILS')}</h2>
                      <TextInput
                        id="cz-group-name"
                        labelText={t('GROUP_EDIT_GROUP_NAME')}
                        value={form.name ?? ''}
                        invalid={!form.name?.trim()}
                        invalidText={t('GROUP_EDIT_NAME_REQUIRED')}
                        onChange={(event) => setEdited({ ...form, name: event.target.value })}
                      />
                      <TextInput
                        id="cz-group-type"
                        labelText={t('GROUP_EDIT_GROUP_TYPE')}
                        value={form.type ?? ''}
                        onChange={(event) => setEdited({ ...form, type: event.target.value })}
                      />
                      <div>
                        <Button type="submit" disabled={!edited || !form.name?.trim() || update.isPending}>
                          {t('GROUP_EDIT_UPDATE_GROUP')}
                        </Button>
                      </div>
                    </Stack>
                  </Form>
                  <DeleteSection
                    label={t('GROUP_EDIT_DELETE_GROUP')}
                    warningTitle={t('GROUP_EDIT_WARNING')}
                    warningText={t('GROUP_EDIT_WARNING_DELETE')}
                    question={t('GROUP_EDIT_DELETE_CONFIRM', { group: groupId })}
                    busy={remove.isPending}
                    onDelete={() =>
                      remove.mutate(groupId, {
                        onSuccess: () => {
                          notify({ kind: 'success', title: t('GROUP_EDIT_DELETE_SUCCESS', { group: groupId }) });
                          navigate({ to: '/admin/$engine/groups', params: { engine } });
                        },
                        onError: (error) =>
                          notify({
                            kind: 'error',
                            title: t('NOTIFICATIONS_STATUS_FAILED'),
                            subtitle: t('GROUP_EDIT_DELETE_FAILED', { message: error.message }),
                          }),
                      })
                    }
                  />
                </Stack>
              )}
            </TabPanel>
            <TabPanel>
              {selected === 'tenants' && (
                <MembershipList<Tenant>
                  engine={engine}
                  title={t('GROUP_EDIT_TENANTS', { group: name })}
                  listPath="/tenant"
                  query={{ groupMember: groupId }}
                  columns={tenantColumns(t('GROUP_EDIT_TENANT_ID'), t('GROUP_EDIT_TENANT_NAME'))}
                  defaultSortBy="id"
                  emptyText={t('GROUP_EDIT_MESSAGE_GROUP', { group: name })}
                  remove={{
                    header: t('GROUP_EDIT_ACTION'),
                    label: t('GROUP_EDIT_REMOVE'),
                    busy: tenants.remove.isPending,
                    run: (tenantId) =>
                      tenants.remove.mutate(tenantId, {
                        onSuccess: () => notify({ kind: 'success', title: t('GROUP_EDIT_REMOVED_FROM_TENANT', { group: groupId }) }),
                        onError: (error) =>
                          notify({
                            kind: 'error',
                            title: t('NOTIFICATIONS_STATUS_FAILED'),
                            subtitle: t('GROUP_EDIT_REMOVED_FROM_TENANT_FAILED', { group: groupId, message: error.message }),
                          }),
                      }),
                  }}
                />
              )}
            </TabPanel>
            <TabPanel>
              {selected === 'users' && (
                <MembershipList<User>
                  engine={engine}
                  title={t('GROUP_EDIT_GROUP_USERS')}
                  listPath="/user"
                  query={{ memberOfGroup: groupId }}
                  columns={userColumns}
                  defaultSortBy="userId"
                  emptyText={t('GROUP_EDIT_MESSAGE_USERS', { group: name })}
                />
              )}
            </TabPanel>
          </TabPanels>
        </Tabs>
      )}
      {adding && (
        <MembershipModal<Tenant>
          engine={engine}
          title={t('GROUP_MEMBERSHIP_TENANT_SELECT_TENANTS')}
          listPath="/tenant"
          columns={tenantColumns(t('GROUP_MEMBERSHIP_TENANT_TENANT_ID'), t('GROUP_MEMBERSHIP_TENANT_TENANT_NAME'))}
          defaultSortBy="id"
          memberIds={tenantIds.data}
          emptyText={t('GROUP_MEMBERSHIP_TENANT_MESSAGE_AVAILABLE_TENANTS')}
          emptyPageText={t('GROUP_MEMBERSHIP_TENANT_MESSAGE_AVAILABLE_TENANTS')}
          addLabel={t('GROUP_EDIT_ADD_TO_TENANT')}
          onAdd={(ids) =>
            tenants.add.mutateAsync(ids).then(
              () => {
                notify({ kind: 'success', title: t('GROUP_MEMBERSHIP_TENANT_MESSAGE_SUCCESS') });
                setAdding(false);
              },
              (error: Error) => notify({ kind: 'error', title: t('NOTIFICATIONS_STATUS_FAILED'), subtitle: error.message }),
            )
          }
          onClose={() => setAdding(false)}
        />
      )}
    </AdminPage>
  );
}
