import { Tag } from '@carbon/react';
import { WarningFilled } from '@carbon/icons-react';
import { useTranslation } from 'react-i18next';
import { cockpitUrl } from '../../../../shared/api/client';
import { formatDateTime } from '../../../../shared/format';
import { VARIABLE_OPERATORS, type CriterionType } from '../../../../shared/search/criteria';
import type { Column } from '../../../../shared/ui/ListTable';
import { SearchableList } from '../../../../shared/ui/SearchableList';
import type { DefinitionTab, DefinitionTabProps } from './registry';

/** A running process instance as the Cockpit plugin API lists it. */
interface InstanceOverview {
  id: string;
  businessKey: string | null;
  startTime: string;
  incidents: { incidentType: string; incidentCount: number }[];
  /** 1 active, 2 suspended */
  suspensionState: number;
}

const INSTANCE_CRITERIA: CriterionType[] = [
  { key: 'businessKey', label: 'PROCESS_INSTANCE_ID_BUSINESS_KEY', kind: 'property', operators: ['eq'] },
  { key: 'activityIdIn', label: 'PROCESS_INSTANCE_ID_ACTIVITY_ID', kind: 'property', operators: ['In'], valueType: 'list' },
  { key: 'started', label: 'PROCESS_INSTANCE_ID_START_DATE', kind: 'property', operators: ['Before', 'After'], valueType: 'date' },
  { key: 'variables', label: 'PROCESS_INSTANCE_ID_VARIABLE', kind: 'variable', operators: VARIABLE_OPERATORS },
  { key: 'withIncident', label: 'PLUGIN_PROCESS_INSTANCE_WITH_INCIDENTS', kind: 'flag', operators: [] },
];

/** The running instances of the definition, filtered by the activities selected in the diagram. */
function InstancesTab({ engine, definition, activityIds, search, onSearchChange }: DefinitionTabProps) {
  const { t, i18n } = useTranslation('cockpit');

  const columns: Column<InstanceOverview>[] = [
    {
      key: 'state',
      header: t('PLUGIN_PROCESS_INSTANCE_STATE'),
      render: (instance) => (
        <>
          {instance.incidents.length > 0 && (
            <span className="cz-incident-count" title={t('PLUGIN_PROCESS_INSTANCE_WITH_INCIDENTS')}>
              <WarningFilled aria-label={t('PLUGIN_PROCESS_INSTANCE_WITH_INCIDENTS')} />
            </span>
          )}
          {instance.suspensionState === 2 && (
            <Tag size="sm" type="gray">
              {t('PROCESS_DEFINITION_SUSPENDED')}
            </Tag>
          )}
        </>
      ),
    },
    { key: 'id', header: t('PLUGIN_PROCESS_INSTANCE_ID'), render: (instance) => instance.id },
    {
      key: 'startTime',
      header: t('PLUGIN_PROCESS_INSTANCE_START_TIME'),
      sortBy: 'startTime',
      render: (instance) => formatDateTime(instance.startTime, i18n.language),
    },
    { key: 'businessKey', header: t('PLUGIN_PROCESS_INSTANCE_BUSINESS_KEY'), render: (instance) => instance.businessKey },
  ];

  return (
    <SearchableList<InstanceOverview>
      scope={['cockpit', engine, 'list']}
      listUrl={cockpitUrl(engine, '/process-instance')}
      countUrl={cockpitUrl(engine, '/process-instance/count')}
      method="POST"
      namespace="cockpit"
      criteria={INSTANCE_CRITERIA}
      fixedQuery={{
        processDefinitionId: definition.id,
        activityIdIn: activityIds.length ? activityIds : undefined,
        parentProcessDefinitionId: search.parentProcessDefinitionId,
      }}
      defaultSortBy="startTime"
      defaultSortOrder="desc"
      columns={columns}
      emptyText={t('PLUGIN_PROCESS_INSTANCE_NO_PROCESS')}
      search={search}
      onSearchChange={onSearchChange}
    />
  );
}

export const tab: DefinitionTab = {
  id: 'process-instances-table',
  label: 'PLUGIN_PROCESS_INSTANCES_LABEL',
  order: 10,
  component: InstancesTab,
};
