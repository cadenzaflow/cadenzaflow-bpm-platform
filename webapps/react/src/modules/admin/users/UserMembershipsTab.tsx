import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { notify } from '../../../shared/notifications';
import type { Column } from '../../../shared/ui/ListTable';
import { useIds, type Group, type Tenant, type User } from '../api';
import { MembershipList } from '../components/MembershipList';
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
  const group = kind === 'group';
  const listPath = group ? '/group' : '/tenant';
  const query = group ? { member: profile.id } : { userMember: profile.id };
  const memberIds = useIds(engine, listPath, query);
  const { add, remove } = useUserMemberships(engine, profile.id, kind);
  const names = { firstname: profile.firstName ?? '', lastname: profile.lastName ?? '' };

  const idColumn = (header: string): Column<Membership> => ({
    key: 'id',
    header,
    sortBy: 'id',
    render: (item) =>
      group ? (
        <Link to="/admin/$engine/groups/$groupId" params={{ engine, groupId: item.id }}>
          {item.id}
        </Link>
      ) : (
        <Link to="/admin/$engine/tenants/$tenantId" params={{ engine, tenantId: item.id }}>
          {item.id}
        </Link>
      ),
  });
  const columns = (idHeader: string, nameHeader: string, typeHeader: string): Column<Membership>[] => [
    idColumn(idHeader),
    { key: 'name', header: nameHeader, sortBy: 'name', render: (item) => item.name },
    ...(group ? [{ key: 'type', header: typeHeader, sortBy: 'type', render: (item: Membership) => (item as Group).type }] : []),
  ];

  return (
    <>
      <MembershipList<Membership>
        engine={engine}
        title={t(group ? 'USERS_FIRSTNAME_LASTNAME_GROUPS' : 'USERS_FIRSTNAME_LASTNAME_TENANTS', names)}
        listPath={listPath}
        query={query}
        columns={group ? columns(t('USERS_GROUP_ID'), t('USERS_GROUP_NAME'), t('USERS_GROUP_TYPE')) : columns(t('USERS_TENANT_ID'), t('USERS_TENANT_NAME'), '')}
        defaultSortBy="id"
        emptyText={t(group ? 'USERS_NOT_MEMBER_GROUP' : 'USERS_NOT_MEMBER_TENTANT', names)}
        remove={{
          header: t('USERS_ACTION'),
          label: t('USERS_REMOVE'),
          busy: remove.isPending,
          run: (id) =>
            remove.mutate(id, {
              onSuccess: () =>
                notify({
                  kind: 'success',
                  title: t(group ? 'USERS_USER_DELETE_FROM_GROUP' : 'USERS_USER_DELETE_FROM_TENANT', { user: profile.id }),
                }),
              onError: (error) =>
                notify({
                  kind: 'error',
                  title: t('NOTIFICATIONS_STATUS_FAILED'),
                  subtitle: t(group ? 'USERS_USER_DELETE_FROM_GROUP_FAILED' : 'USERS_USER_DELETE_FROM_TENANT_FAILED', {
                    user: profile.id,
                    message: error.message,
                  }),
                }),
            }),
        }}
      />
      {adding && (
        <MembershipModal<Membership>
          engine={engine}
          title={t(group ? 'GROUP_MEMBERSHIP_GROUP_SELECT_GROUPS' : 'USER_MEMBERSHIP_TENANT_SELECT_TENANTS')}
          listPath={listPath}
          columns={
            group
              ? columns(t('GROUP_MEMBERSHIP_GROUP_GROUP_ID'), t('GROUP_MEMBERSHIP_GROUP_GROUP_NAME'), t('GROUP_MEMBERSHIP_GROUP_GROUP_TYPE'))
              : columns(t('USER_MEMBERSHIP_TENANT_TENANT_ID'), t('USER_MEMBERSHIP_TENANT_TENANT_NAME'), '')
          }
          defaultSortBy="id"
          memberIds={memberIds.data}
          emptyText={t(group ? 'GROUP_MEMBERSHIP_GROUP_MESSAGE_AVAILABLE_GROUPS' : 'USER_MEMBERSHIP_TENANT_MESSAGE_AVAILABLE_TENANTS')}
          emptyPageText={t(group ? 'GROUP_MEMBERSHIP_GROUP_MESSAGE_AVAILABLE_GROUPS_PAGE' : 'USER_MEMBERSHIP_TENANT_MESSAGE_AVAILABLE_TENANTS')}
          addLabel={t(group ? 'GROUP_MEMBERSHIP_GROUP_ADD_GROUPS' : 'USERS_ADD_TO_A_TENANT')}
          onAdd={(ids) =>
            add.mutateAsync(ids).then(
              () => {
                notify({
                  kind: 'success',
                  title: t(group ? 'GROUP_MEMBERSHIP_GROUP_MESSAGE_SUCCESS' : 'USER_MEMBERSHIP_TENANT_MESSAGE_SUCCESS'),
                });
                onAddingDone();
              },
              (error: Error) => notify({ kind: 'error', title: t('NOTIFICATIONS_STATUS_FAILED'), subtitle: error.message }),
            )
          }
          onClose={onAddingDone}
        />
      )}
    </>
  );
}
