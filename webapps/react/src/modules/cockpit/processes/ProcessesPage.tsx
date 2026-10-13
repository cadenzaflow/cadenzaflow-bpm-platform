import { Tag } from '@carbon/react';
import { WarningFilled } from '@carbon/icons-react';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { cockpitUrl } from '../../../shared/api/client';
import type { CriterionType } from '../../../shared/search/criteria';
import type { ListSearch } from '../../../shared/search/list-search';
import type { Column } from '../../../shared/ui/ListTable';
import { PageFrame } from '../../../shared/ui/PageFrame';
import { SearchableList } from '../../../shared/ui/SearchableList';
import { useCount } from '../api';

const route = getRouteApi('/cockpit/$engine/processes');

/** Latest version of a process definition with its running instances and open incidents (Cockpit plugin API). */
export interface ProcessDefinitionOverview {
  id: string;
  key: string;
  name: string | null;
  version: number;
  tenantId: string | null;
  /** 1 active, 2 suspended */
  suspensionState: number;
  instances: number;
  incidents: number;
}

const PROCESS_CRITERIA: CriterionType[] = [
  { key: 'name', label: 'PLUGIN_PROCESS_DEF_NAME', kind: 'property', operators: ['Like', 'eq'] },
  { key: 'key', label: 'PLUGIN_PROCESS_DEF_KEY', kind: 'property', operators: ['eq', 'Like'] },
];

/** The deployed process definitions (latest versions) with instances and incidents, as in the classic Cockpit. */
export function ProcessesPage() {
  const { t } = useTranslation('cockpit');
  const { engine } = route.useParams();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const deployed = useCount(engine, '/process-definition/count', { latestVersion: true });

  const columns: Column<ProcessDefinitionOverview>[] = [
    {
      key: 'state',
      header: t('PLUGIN_PROCESS_DEF_STATE'),
      render: (definition) =>
        definition.suspensionState === 2 ? (
          <Tag size="sm" type="gray">
            {t('PROCESS_DEFINITION_SUSPENDED')}
          </Tag>
        ) : null,
    },
    {
      key: 'incidents',
      header: t('PLUGIN_PROCESS_DEF_INCIDENTS'),
      sortBy: 'incidents',
      render: (definition) =>
        definition.incidents > 0 ? (
          <span className="cz-incident-count">
            <WarningFilled aria-hidden="true" />
            {definition.incidents.toLocaleString()}
          </span>
        ) : (
          '0'
        ),
    },
    {
      key: 'instances',
      header: t('PLUGIN_PROCESS_DEF_RUNNING_INSTANCES'),
      sortBy: 'instances',
      render: (definition) => definition.instances.toLocaleString(),
    },
    { key: 'key', header: t('PLUGIN_PROCESS_DEF_KEY'), sortBy: 'key', render: (definition) => definition.key },
    {
      key: 'name',
      header: t('PLUGIN_PROCESS_DEF_NAME'),
      sortBy: 'name',
      render: (definition) => (
        <Link to="/cockpit/$engine/process-definition/$id" params={{ engine, id: definition.id }}>
          {definition.name || definition.key}
        </Link>
      ),
    },
    { key: 'tenantId', header: t('PLUGIN_PROCESS_DEF_TENANT_ID'), sortBy: 'tenantId', render: (definition) => definition.tenantId },
  ];

  return (
    <PageFrame title={t('COCKPIT_PROCESSES')} breadcrumbs={[t('COCKPIT_PROCESSES')]}>
      {deployed.data !== undefined && (
        <p className="cz-cockpit-count">
          <strong>{deployed.data.toLocaleString()}</strong>{' '}
          {t(deployed.data === 1 ? 'PLUGIN_PROCESS_DEF_PROCESS_DEFINITION_DEPLOYED' : 'PLUGIN_PROCESS_DEF_PROCESS_DEFINITIONS_DEPLOYED')}
        </p>
      )}
      <SearchableList<ProcessDefinitionOverview>
        scope={['cockpit', engine, 'list']}
        listUrl={cockpitUrl(engine, '/process-definition/statistics')}
        countUrl={cockpitUrl(engine, '/process-definition/statistics-count')}
        namespace="cockpit"
        criteria={PROCESS_CRITERIA}
        defaultSortBy="name"
        columns={columns}
        emptyText={t('PLUGIN_PROCESS_DEF_NO_PROCESS_DEF')}
        search={search}
        onSearchChange={(changes) => navigate({ search: (previous: ListSearch) => ({ ...previous, ...changes }) })}
      />
    </PageFrame>
  );
}
