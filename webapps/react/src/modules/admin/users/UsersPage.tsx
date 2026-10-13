import { Button } from '@carbon/react';
import { Add } from '@carbon/icons-react';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { PageFrame } from '../../../shared/ui/PageFrame';
import type { Column } from '../../../shared/ui/ListTable';
import { useResourceAccess, type User } from '../api';
import { ResourceList } from '../components/ResourceList';
import type { AdminListSearch } from '../search';
import { USER_CRITERIA } from './api';

const route = getRouteApi('/admin/$engine/users');

export function UsersPage() {
  const { t } = useTranslation('admin');
  const { engine } = route.useParams();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const access = useResourceAccess(engine, '/user');

  const userLink = (user: User, text: string) => (
    <Link to="/admin/$engine/users/$userId" params={{ engine, userId: user.id }}>
      {text}
    </Link>
  );
  const columns: Column<User>[] = [
    { key: 'id', header: t('USERS_ID'), sortBy: 'userId', render: (user) => userLink(user, user.id) },
    { key: 'firstName', header: t('PLUGIN_SEARCH_USER_FIRSTNAME'), sortBy: 'firstName', render: (user) => user.firstName },
    { key: 'lastName', header: t('PLUGIN_SEARCH_USER_LASTNAME'), sortBy: 'lastName', render: (user) => user.lastName },
    { key: 'email', header: t('USERS_EMAIL'), sortBy: 'email', render: (user) => user.email },
    { key: 'action', header: t('USERS_ACTION'), render: (user) => userLink(user, t('USERS_EDIT')) },
  ];

  return (
    <PageFrame
      title={t('USERS_LIST_OF_USERS')}
      breadcrumbs={[t('USERS_USERS')]}
      actions={
        access.data?.has('create') && (
          <Button size="md" renderIcon={Add} onClick={() => navigate({ to: '/admin/$engine/user-create', params: { engine } })}>
            {t('USERS_ADD_USER')}
          </Button>
        )
      }
    >
      <ResourceList<User>
        engine={engine}
        listPath="/user"
        criteria={USER_CRITERIA}
        defaultSortBy="userId"
        columns={columns}
        emptyText={t('USERS_NOT_FOUND')}
        search={search}
        onSearchChange={(changes) => navigate({ search: (previous: AdminListSearch) => ({ ...previous, ...changes }) })}
      />
    </PageFrame>
  );
}
