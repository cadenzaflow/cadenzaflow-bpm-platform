import { Link, getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { engineUrl } from '../../../shared/api/client';
import type { ListSearch } from '../../../shared/search/list-search';
import type { Column } from '../../../shared/ui/ListTable';
import { PageFrame } from '../../../shared/ui/PageFrame';
import { SearchableList } from '../../../shared/ui/SearchableList';
import { useCount } from '../api';
import type { DecisionDefinition } from './api';

const route = getRouteApi('/cockpit/$engine/decisions');

const LATEST = { latestVersion: true };

/** The deployed decision definitions (latest versions), as in the classic Cockpit. */
export function DecisionsPage() {
  const { t } = useTranslation('cockpit');
  const { engine } = route.useParams();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const deployed = useCount(engine, '/decision-definition/count', LATEST);

  const columns: Column<DecisionDefinition>[] = [
    {
      key: 'name',
      header: t('PLUGIN_DECISION_TABLE_NAME'),
      sortBy: 'name',
      render: (definition) => (
        <Link to="/cockpit/$engine/decision-definition/$id" params={{ engine, id: definition.id }}>
          {definition.name || definition.key}
        </Link>
      ),
    },
    { key: 'tenantId', header: t('PLUGIN_DECISION_TABLE_TENANT_ID'), sortBy: 'tenantId', render: (definition) => definition.tenantId },
  ];

  return (
    <PageFrame title={t('DECISION_INSTANCE_DECISIONS')} breadcrumbs={[t('DECISION_INSTANCE_DECISIONS')]}>
      {!!deployed.data && (
        <p className="cz-cockpit-count">
          {t(deployed.data === 1 ? 'PLUGIN_DECISION_TABLE_TITLE_DEFINITION' : 'PLUGIN_DECISION_TABLE_TITLE_DEFINITIONS', {
            count: deployed.data,
          })}
        </p>
      )}
      <SearchableList<DecisionDefinition>
        scope={['cockpit', engine, 'list']}
        listUrl={engineUrl(engine, '/decision-definition')}
        countUrl={engineUrl(engine, '/decision-definition/count')}
        fixedQuery={LATEST}
        defaultSortBy="name"
        columns={columns}
        emptyText={t('PLUGIN_DECISION_TABLE_NO_DECISION_TABLES_DEPLOYED')}
        search={search}
        onSearchChange={(changes) => navigate({ search: (previous: ListSearch) => ({ ...previous, ...changes }) })}
      />
    </PageFrame>
  );
}
