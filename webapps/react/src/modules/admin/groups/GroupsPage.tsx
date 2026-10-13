import { Button } from '@carbon/react';
import { Add } from '@carbon/icons-react';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { PageFrame } from '../../../shared/ui/PageFrame';
import type { Column } from '../../../shared/ui/ListTable';
import { useResourceAccess, type Group } from '../api';
import { ResourceList } from '../components/ResourceList';
import { GROUP_CRITERIA } from '../resources';
import type { AdminListSearch } from '../search';

const route = getRouteApi('/admin/$engine/groups');

export function GroupsPage() {
  const { t } = useTranslation('admin');
  const { engine } = route.useParams();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const access = useResourceAccess(engine, '/group');

  const groupLink = (group: Group, text: string) => (
    <Link to="/admin/$engine/groups/$groupId" params={{ engine, groupId: group.id }}>
      {text}
    </Link>
  );
  const columns: Column<Group>[] = [
    { key: 'id', header: t('GROUPS_GROUP_ID'), sortBy: 'id', render: (group) => groupLink(group, group.id) },
    { key: 'name', header: t('GROUPS_GROUP_NAME'), sortBy: 'name', render: (group) => group.name },
    { key: 'type', header: t('GROUPS_GROUP_TYPE'), sortBy: 'type', render: (group) => group.type },
    { key: 'action', header: t('GROUPS_ACTION'), render: (group) => groupLink(group, t('GROUPS_ACTION_EDIT')) },
  ];

  return (
    <PageFrame
      title={t('GROUPS_LIST_GROUPS')}
      breadcrumbs={[t('GROUPS_GROUPS')]}
      actions={
        access.data?.has('create') && (
          <Button size="md" renderIcon={Add} onClick={() => navigate({ to: '/admin/$engine/group-create', params: { engine } })}>
            {t('GROUPS_CREATE_GROUP')}
          </Button>
        )
      }
    >
      <ResourceList<Group>
        engine={engine}
        listPath="/group"
        criteria={GROUP_CRITERIA}
        defaultSortBy="id"
        columns={columns}
        emptyText={t('GROUPS_NO_GROUPS')}
        search={search}
        onSearchChange={(changes) => navigate({ search: (previous: AdminListSearch) => ({ ...previous, ...changes }) })}
      />
    </PageFrame>
  );
}
