import { useState } from 'react';
import { Button, InlineNotification, PaginationNav, SkeletonText } from '@carbon/react';
import { useTranslation } from 'react-i18next';
import { notify } from '../../../shared/notifications';
import { ADMIN_PAGE_SIZE, useIds, usePage, type Group, type Sorting, type Tenant, type User } from '../api';
import { ListTable, type Column } from '../components/ListTable';
import { MembershipModal } from '../components/MembershipModal';
import { useUserMemberships } from './api';

interface UserMembershipsTabProps {
  engine: string;
  profile: User;
  kind: 'group' | 'tenant';
  /** the page's "Add to a group/tenant" button was pressed */
  adding: boolean;
  onAddingDone: () => void;
}

type Membership = Group | Tenant;

/** The groups or tenants of a user: list, remove, add. */
export function UserMembershipsTab({ engine, profile, kind, adding, onAddingDone }: UserMembershipsTabProps) {
  const { t } = useTranslation('admin');
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<Sorting>({ sortBy: 'id', sortOrder: 'asc' });
  const listPath = kind === 'group' ? '/group' : '/tenant';
  const memberQuery = kind === 'group' ? { member: profile.id } : { userMember: profile.id };
  const memberships = usePage<Membership>(engine, listPath, memberQuery, page, sorting);
  const memberIds = useIds(engine, listPath, memberQuery);
  const { add, remove } = useUserMemberships(engine, profile.id, kind);
  const pageCount = memberships.data ? Math.ceil(memberships.data.count / ADMIN_PAGE_SIZE) : 0;
  const names = { firstname: profile.firstName ?? '', lastname: profile.lastName ?? '' };

  const columns: Column<Membership>[] =
    kind === 'group'
      ? [
          { key: 'id', header: t('USERS_GROUP_ID'), sortBy: 'id', render: (group) => group.id },
          { key: 'name', header: t('USERS_GROUP_NAME'), sortBy: 'name', render: (group) => group.name },
          { key: 'type', header: t('USERS_GROUP_TYPE'), sortBy: 'type', render: (group) => (group as Group).type },
        ]
      : [
          { key: 'id', header: t('USERS_TENANT_ID'), sortBy: 'id', render: (tenant) => tenant.id },
          { key: 'name', header: t('USERS_TENANT_NAME'), sortBy: 'name', render: (tenant) => tenant.name },
        ];

  const removeMembership = (id: string) =>
    remove.mutate(id, {
      onSuccess: () =>
        notify({
          kind: 'success',
          title: t(kind === 'group' ? 'USERS_USER_DELETE_FROM_GROUP' : 'USERS_USER_DELETE_FROM_TENANT', { user: profile.id }),
        }),
      onError: (error) =>
        notify({
          kind: 'error',
          title: t('NOTIFICATIONS_STATUS_FAILED'),
          subtitle: t(kind === 'group' ? 'USERS_USER_DELETE_FROM_GROUP_FAILED' : 'USERS_USER_DELETE_FROM_TENANT_FAILED', {
            user: profile.id,
            message: error.message,
          }),
        }),
    });

  return (
    <div className="cz-admin-memberships">
      <h2 className="cz-admin-form__section">
        {t(kind === 'group' ? 'USERS_FIRSTNAME_LASTNAME_GROUPS' : 'USERS_FIRSTNAME_LASTNAME_TENANTS', names)}
      </h2>
      {memberships.isPending && <SkeletonText paragraph lineCount={3} />}
      {memberships.isError && (
        <InlineNotification kind="error" lowContrast hideCloseButton subtitle={memberships.error.message} />
      )}
      {memberships.data?.items.length === 0 && (
        <p className="cz-admin-empty">{t(kind === 'group' ? 'USERS_NOT_MEMBER_GROUP' : 'USERS_NOT_MEMBER_TENTANT', names)}</p>
      )}
      {!!memberships.data?.items.length && (
        <ListTable
          columns={[
            ...columns,
            {
              key: 'action',
              header: t('USERS_ACTION'),
              render: (item) => (
                <Button kind="ghost" size="sm" disabled={remove.isPending} onClick={() => removeMembership(item.id)}>
                  {t('USERS_REMOVE')}
                </Button>
              ),
            },
          ]}
          items={memberships.data.items}
          rowKey={(item) => item.id}
          sorting={sorting}
          sortable={memberships.data.sortable}
          onSortingChange={setSorting}
        />
      )}
      {pageCount > 1 && (
        <PaginationNav totalItems={pageCount} page={page - 1} itemsShown={7} onChange={(index: number) => setPage(index + 1)} />
      )}
      {adding && (
        <MembershipModal<Membership>
          engine={engine}
          title={t(kind === 'group' ? 'GROUP_MEMBERSHIP_GROUP_SELECT_GROUPS' : 'USER_MEMBERSHIP_TENANT_SELECT_TENANTS')}
          listPath={listPath}
          columns={
            kind === 'group'
              ? [
                  { key: 'id', header: t('GROUP_MEMBERSHIP_GROUP_GROUP_ID'), sortBy: 'id', render: (group) => group.id },
                  { key: 'name', header: t('GROUP_MEMBERSHIP_GROUP_GROUP_NAME'), sortBy: 'name', render: (group) => group.name },
                  { key: 'type', header: t('GROUP_MEMBERSHIP_GROUP_GROUP_TYPE'), sortBy: 'type', render: (group) => (group as Group).type },
                ]
              : [
                  { key: 'id', header: t('USER_MEMBERSHIP_TENANT_TENANT_ID'), sortBy: 'id', render: (tenant) => tenant.id },
                  { key: 'name', header: t('USER_MEMBERSHIP_TENANT_TENANT_NAME'), sortBy: 'name', render: (tenant) => tenant.name },
                ]
          }
          defaultSortBy="id"
          memberIds={memberIds.data}
          emptyText={t(kind === 'group' ? 'GROUP_MEMBERSHIP_GROUP_MESSAGE_AVAILABLE_GROUPS' : 'USER_MEMBERSHIP_TENANT_MESSAGE_AVAILABLE_TENANTS')}
          emptyPageText={t(
            kind === 'group' ? 'GROUP_MEMBERSHIP_GROUP_MESSAGE_AVAILABLE_GROUPS_PAGE' : 'USER_MEMBERSHIP_TENANT_MESSAGE_AVAILABLE_TENANTS',
          )}
          addLabel={t(kind === 'group' ? 'GROUP_MEMBERSHIP_GROUP_ADD_GROUPS' : 'USERS_ADD_TO_A_TENANT')}
          onAdd={(ids) =>
            add.mutateAsync(ids).then(
              () => {
                notify({
                  kind: 'success',
                  title: t(kind === 'group' ? 'GROUP_MEMBERSHIP_GROUP_MESSAGE_SUCCESS' : 'USER_MEMBERSHIP_TENANT_MESSAGE_SUCCESS'),
                });
                onAddingDone();
              },
              (error: Error) => notify({ kind: 'error', title: t('NOTIFICATIONS_STATUS_FAILED'), subtitle: error.message }),
            )
          }
          onClose={onAddingDone}
        />
      )}
    </div>
  );
}
