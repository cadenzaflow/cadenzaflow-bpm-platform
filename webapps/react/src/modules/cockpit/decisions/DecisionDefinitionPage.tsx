import { lazy, Suspense, useMemo } from 'react';
import { InlineNotification, Select, SelectItem, SkeletonPlaceholder, SkeletonText } from '@carbon/react';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { engineUrl } from '../../../shared/api/client';
import { formatDateTime } from '../../../shared/format';
import type { CriterionType } from '../../../shared/search/criteria';
import type { ListSearch } from '../../../shared/search/list-search';
import type { Column } from '../../../shared/ui/ListTable';
import { PageFrame } from '../../../shared/ui/PageFrame';
import { SearchableList } from '../../../shared/ui/SearchableList';
import { TimeToLive } from '../components/TimeToLive';
import { InstanceLink } from '../process-instance/InstanceLink';
import { DeploymentLink } from '../repository/DeploymentLink';
import { useDecisionDefinition, useDecisionVersions, useDecisionXml, type DecisionInstance } from './api';

const DmnViewer = lazy(() => import('../../../shared/diagram/DmnViewer'));

const route = getRouteApi('/cockpit/$engine/decision-definition/$id');

const INSTANCE_CRITERIA: CriterionType[] = [
  { key: 'decisionInstanceId', label: 'PLUGIN_DECISION_DEFINITION_VALUE_TYPE_ID', kind: 'property', operators: ['eq'] },
  { key: 'processDefinitionId', label: 'PLUGIN_DECISION_DEFINITION_VALUE_PROCESS_DEFINITION_ID', kind: 'property', operators: ['eq'] },
  { key: 'processDefinitionKey', label: 'PLUGIN_DECISION_DEFINITION_VALUE_PROCESS_DEFINITION_KEY', kind: 'property', operators: ['eq'] },
  { key: 'processInstanceId', label: 'PLUGIN_DECISION_DEFINITION_VALUE_PROCESS_INSTANCE_ID', kind: 'property', operators: ['eq'] },
  { key: 'caseDefinitionId', label: 'PLUGIN_DECISION_DEFINITION_VALUE_CASE_DEFINITION_ID', kind: 'property', operators: ['eq'] },
  { key: 'caseDefinitionKey', label: 'PLUGIN_DECISION_DEFINITION_VALUE_CASE_DEFINITION_KEY', kind: 'property', operators: ['eq'] },
  { key: 'caseInstanceId', label: 'PLUGIN_DECISION_DEFINITION_VALUE_CASE_INSTANCE_ID', kind: 'property', operators: ['eq'] },
  { key: 'activityIdIn', label: 'PLUGIN_DECISION_DEFINITION_VALUE_ACTIVITY_ID', kind: 'property', operators: ['eq'], valueType: 'list' },
  { key: 'activityInstanceIdIn', label: 'PLUGIN_DECISION_DEFINITION_VALUE_ACTIVITY_INSTANCE_ID', kind: 'property', operators: ['eq'], valueType: 'list' },
  // evaluatedBefore / evaluatedAfter
  { key: 'evaluated', label: 'PLUGIN_DECISION_DEFINITION_VALUE_EVALUATED_DATE', kind: 'property', operators: ['Before', 'After'], valueType: 'date' },
  { key: 'userId', label: 'PLUGIN_DECISION_DEFINITION_VALUE_USER_ID', kind: 'property', operators: ['eq'] },
];

/**
 * A decision definition as in the classic Cockpit: its details on the left,
 * the decision table (or literal expression) and its evaluations below.
 */
export function DecisionDefinitionPage() {
  const { t, i18n } = useTranslation('cockpit');
  const { engine, id } = route.useParams();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const definition = useDecisionDefinition(engine, id);
  const xml = useDecisionXml(engine, id);
  const versions = useDecisionVersions(engine, definition.data);
  const fixedQuery = useMemo(() => ({ decisionDefinitionId: id }), [id]);
  const name = definition.data ? definition.data.name || definition.data.key : id;

  const value = (text: string | number | null | undefined) =>
    text === null || text === undefined || text === '' ? <span className="cz-null">{t('DECISION_DEFINITION_NULL')}</span> : text;

  const columns: Column<DecisionInstance>[] = [
    {
      key: 'id',
      header: t('PLUGIN_DECISION_ID'),
      render: (instance) => (
        <Link to="/cockpit/$engine/decision-instance/$id" params={{ engine, id: instance.id }} className="cz-instance-link">
          {instance.id}
        </Link>
      ),
    },
    {
      key: 'evaluationTime',
      header: t('PLUGIN_DECISION_EVALUATION_TIME'),
      sortBy: 'evaluationTime',
      render: (instance) => formatDateTime(instance.evaluationTime, i18n.language),
    },
    {
      key: 'caller',
      header: t('PLUGIN_DECISION_CALLING_PROCESS_CASE'),
      render: (instance) =>
        instance.processDefinitionKey && instance.processDefinitionId ? (
          <Link to="/cockpit/$engine/process-definition/$id" params={{ engine, id: instance.processDefinitionId }}>
            {instance.processDefinitionKey}
          </Link>
        ) : (
          instance.caseDefinitionKey
        ),
    },
    {
      key: 'callingInstance',
      header: t('PLUGIN_DECISION_CALLING_INSTANCE_ID'),
      render: (instance) => (instance.processInstanceId ? <InstanceLink engine={engine} id={instance.processInstanceId} /> : instance.caseInstanceId),
    },
    { key: 'activityId', header: t('PLUGIN_DECISION_ACTIVITY_ID'), render: (instance) => instance.activityId },
  ];

  return (
    <PageFrame
      wide
      title={name}
      breadcrumbs={[
        <Link key="decisions" to="/cockpit/$engine/decisions" params={{ engine }}>
          {t('DECISION_DEFINITION_DECISIONS')}
        </Link>,
        name,
      ]}
    >
      {definition.isError && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={definition.error.message} />}
      <div className="cz-definition">
        <aside className="cz-definition__info">
          {definition.isPending && <SkeletonText paragraph lineCount={8} />}
          {definition.data && (
            <dl>
              <dt>{t('DECISION_DEFINITION_DEFINITION_VERSION')}</dt>
              <dd>
                {versions.data && versions.data.length > 1 ? (
                  <Select
                    id="cz-decision-version"
                    labelText={t('DECISION_DEFINITION_DEFINITION_VERSION')}
                    hideLabel
                    size="sm"
                    value={id}
                    onChange={(event) => navigate({ to: '/cockpit/$engine/decision-definition/$id', params: { engine, id: event.target.value } })}
                  >
                    {versions.data.map((version) => (
                      <SelectItem key={version.id} value={version.id} text={String(version.version)} />
                    ))}
                  </Select>
                ) : (
                  definition.data.version
                )}
              </dd>
              <dt>{t('DECISION_DEFINITION_VERSION_TAG')}</dt>
              <dd>{value(definition.data.versionTag)}</dd>
              <dt>{t('DECISION_DEFINITION_DEFINITION_ID')}</dt>
              <dd className="cz-definition__id">{definition.data.id}</dd>
              <dt>{t('DECISION_DEFINITION_DEFINITION_KEY')}</dt>
              <dd>{definition.data.key}</dd>
              <dt>{t('DECISION_DEFINITION_DEFINITION_NAME')}</dt>
              <dd>{value(definition.data.name)}</dd>
              <dt>{t('DECISION_DEFINITION_HISTORY_TIME_TO_LIVE')}</dt>
              <dd>
                <TimeToLive engine={engine} resource="decision-definition" id={definition.data.id} value={definition.data.historyTimeToLive} />
              </dd>
              <dt>{t('DECISION_DEFINITION_TENANT_ID')}</dt>
              <dd>{value(definition.data.tenantId)}</dd>
              <dt>{t('DECISION_DEFINITION_DEPLOYMENT_ID')}</dt>
              <dd className="cz-definition__id">
                <DeploymentLink engine={engine} deploymentId={definition.data.deploymentId} resourceName={definition.data.resource} />
              </dd>
              <dt>{t('DECISION_DEFINITION_DECISION_REQUIREMENTS_DEFINITION')}</dt>
              <dd className="cz-definition__id">{value(definition.data.decisionRequirementsDefinitionId)}</dd>
            </dl>
          )}
        </aside>
        <div className="cz-definition__main">
          {xml.isError && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={xml.error.message} />}
          {xml.isPending || definition.isPending ? (
            <SkeletonPlaceholder className="cz-diagram-skeleton" />
          ) : (
            xml.data &&
            definition.data && (
              <Suspense fallback={<SkeletonPlaceholder className="cz-diagram-skeleton" />}>
                <DmnViewer xml={xml.data} decision={definition.data.key} />
              </Suspense>
            )
          )}
          <section>
            <h2 className="cz-section-title">{t('DECISION_DEFINITION_LABEL')}</h2>
            <SearchableList<DecisionInstance>
              scope={['cockpit', engine, 'list']}
              listUrl={engineUrl(engine, '/history/decision-instance')}
              countUrl={engineUrl(engine, '/history/decision-instance/count')}
              namespace="cockpit"
              criteria={INSTANCE_CRITERIA}
              fixedQuery={fixedQuery}
              defaultSortBy="evaluationTime"
              defaultSortOrder="desc"
              columns={columns}
              emptyText={t('PLUGIN_DECISION_TABLE_NOT_FOUND')}
              search={search}
              onSearchChange={(changes) => navigate({ search: (previous: ListSearch) => ({ ...previous, ...changes }) })}
            />
          </section>
        </div>
      </div>
    </PageFrame>
  );
}
