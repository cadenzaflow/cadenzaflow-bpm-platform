import { Button } from '@carbon/react';
import { Add } from '@carbon/icons-react';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useResourceAccess, type Tenant } from '../api';
import { AdminPage } from '../components/AdminPage';
import type { Column } from '../components/ListTable';
import { ResourceList } from '../components/ResourceList';
import { TENANT_CRITERIA } from '../resources';
import type { AdminListSearch } from '../search';

const route = getRouteApi('/admin/$engine/tenants');

export function TenantsPage() {
  const { t } = useTranslation('admin');
  const { engine } = route.useParams();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const access = useResourceAccess(engine, '/tenant');

  const tenantLink = (tenant: Tenant, text: string) => (
    <Link to="/admin/$engine/tenants/$tenantId" params={{ engine, tenantId: tenant.id }}>
      {text}
    </Link>
  );
  const columns: Column<Tenant>[] = [
    { key: 'id', header: t('PLUGIN_SEARCH_TENANTS_ID'), sortBy: 'id', render: (tenant) => tenantLink(tenant, tenant.id) },
    { key: 'name', header: t('TENANTS_NAME'), sortBy: 'name', render: (tenant) => tenant.name },
    { key: 'action', header: t('TENANTS_ACTION'), render: (tenant) => tenantLink(tenant, t('TENANTS_EDIT')) },
  ];

  return (
    <AdminPage
      title={t('TENANTS_LIST_OF_TENANTS')}
      breadcrumbs={[t('TENANTS_TENANTS')]}
      actions={
        access.data?.has('create') && (
          <Button size="md" renderIcon={Add} onClick={() => navigate({ to: '/admin/$engine/tenant-create', params: { engine } })}>
            {t('TENANTS_CREATE_TENANT')}
          </Button>
        )
      }
    >
      <ResourceList<Tenant>
        engine={engine}
        listPath="/tenant"
        criteria={TENANT_CRITERIA}
        defaultSortBy="id"
        columns={columns}
        emptyText={t('TENANTS_NO_TENANTS')}
        search={search}
        onSearchChange={(changes) => navigate({ search: (previous: AdminListSearch) => ({ ...previous, ...changes }) })}
      />
    </AdminPage>
  );
}
