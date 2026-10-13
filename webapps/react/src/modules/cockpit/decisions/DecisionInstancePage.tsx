import { lazy, Suspense, useMemo, useState } from 'react';
import { InlineNotification, SkeletonPlaceholder, SkeletonText, Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import { Link, getRouteApi } from '@tanstack/react-router';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../../shared/api/client';
import type { DmnValue } from '../../../shared/diagram/DmnViewer';
import { formatDateTime } from '../../../shared/format';
import { ListTable, type Column, type Sorting } from '../../../shared/ui/ListTable';
import { PageFrame } from '../../../shared/ui/PageFrame';
import { InstanceLink } from '../process-instance/InstanceLink';
import { DeploymentLink } from '../repository/DeploymentLink';
import { useDecisionDefinition, useDecisionInstance, useDecisionXml, type DecisionValue } from './api';

const DmnViewer = lazy(() => import('../../../shared/diagram/DmnViewer'));

const route = getRouteApi('/cockpit/$engine/decision-instance/$id');

/** Types whose values are not shown in the table (custom objects stay serialized, binaries are not fetched). */
const NOT_SHOWN = ['Object', 'Bytes', 'File'];

const PREVIEW_LENGTH = 100;

export const TABS = [
  { id: 'decision-input-table', label: 'PLUGIN_INPUT_TABLE_LABEL' },
  { id: 'decision-output-table', label: 'PLUGIN_OUTPUT_TABLE_LABEL' },
] as const;

/** A value as text for the decision table, e.g. "100" or "[Object]". */
export function tableValue(value: DecisionValue, t: TFunction, language: string): Omit<DmnValue, 'columnId' | 'ruleId'> {
  if (NOT_SHOWN.includes(value.type)) {
    return { text: `[${value.type}]`, hidden: true, title: t('DECISION_INSTANCE_VALUE_NOT_SHOWN', { type: value.type }) };
  }
  if (value.value === null || value.value === undefined) {
    return { text: 'null' };
  }
  return { text: value.type === 'Date' ? formatDateTime(String(value.value), language) : String(value.value) };
}

const nameOf = (value: DecisionValue) => value.clauseName || value.clauseId || value.variableName || '';

/** Inputs or outputs of the evaluation: name, type and value; sorted in the table by a header click. */
function ValuesTable({ values, emptyText }: { values: DecisionValue[]; emptyText?: string }) {
  const { t, i18n } = useTranslation('cockpit');
  const [sorting, setSorting] = useState<Sorting | undefined>();
  const sorted = useMemo(() => {
    if (!sorting) {
      return values;
    }
    const key = (value: DecisionValue) => (sorting.sortBy === 'type' ? value.type : nameOf(value)).toLowerCase();
    const direction = sorting.sortOrder === 'asc' ? 1 : -1;
    return [...values].sort((a, b) => key(a).localeCompare(key(b)) * direction);
  }, [values, sorting]);

  const columns: Column<DecisionValue>[] = [
    { key: 'name', header: t('PLUGIN_VARIABLE_NAME'), sortBy: 'name', render: nameOf },
    {
      key: 'type',
      header: t('PLUGIN_VARIABLE_TYPE'),
      sortBy: 'type',
      render: (value) => (
        <>
          {value.type}
          {typeof value.valueInfo?.objectTypeName === 'string' && <span className="cz-variable-object-type">{value.valueInfo.objectTypeName}</span>}
        </>
      ),
    },
    {
      key: 'value',
      header: t('PLUGIN_VARIABLE_VALUE'),
      render: (value) => {
        if (['Bytes', 'File'].includes(value.type)) {
          return null;
        }
        if (value.value === null || value.value === undefined) {
          return <span className="cz-null">null</span>;
        }
        const text = value.type === 'Date' ? formatDateTime(String(value.value), i18n.language) : String(value.value);
        const code = ['Object', 'Json', 'Xml'].includes(value.type);
        return (
          <span className={code ? 'cz-variable-value cz-variable-value--code' : 'cz-variable-value'} title={text}>
            {text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH)}…` : text}
          </span>
        );
      },
    },
  ];

  if (!values.length) {
    return emptyText ? <p className="cz-list-empty">{emptyText}</p> : null;
  }
  return <ListTable columns={columns} items={sorted} rowKey={(value) => value.id} sorting={sorting} onSortingChange={setSorting} />;
}

/**
 * An evaluation of a decision, from the history: its details on the left,
 * the decision table with the fired rules and the values that went in and
 * came out, and the inputs and outputs as tables.
 */
export function DecisionInstancePage() {
  const { t, i18n } = useTranslation('cockpit');
  const { engine, id } = route.useParams();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const instance = useDecisionInstance(engine, id);
  const definition = useDecisionDefinition(engine, instance.data?.decisionDefinitionId);
  const xml = useDecisionXml(engine, instance.data?.decisionDefinitionId);
  const tabIndex = Math.max(0, TABS.findIndex((tab) => tab.id === search.tab));
  const inputs = instance.data?.inputs ?? [];
  const outputs = instance.data?.outputs ?? [];
  const name = instance.data ? instance.data.decisionDefinitionName || instance.data.decisionDefinitionKey : '';

  const rules = useMemo(() => [...new Set(outputs.map((output) => output.ruleId).filter((rule): rule is string => !!rule))], [outputs]);
  const tableInputs = useMemo(
    () => inputs.filter((input) => input.clauseId).map((input) => ({ columnId: input.clauseId!, ...tableValue(input, t, i18n.language) })),
    [inputs, t, i18n.language],
  );
  const tableOutputs = useMemo(
    () =>
      outputs
        .filter((output) => output.clauseId)
        .map((output) => ({ columnId: output.clauseId!, ruleId: output.ruleId ?? undefined, ...tableValue(output, t, i18n.language) })),
    [outputs, t, i18n.language],
  );

  const value = (text: string | number | null | undefined) =>
    text === null || text === undefined || text === '' ? <span className="cz-null">{t('DECISION_INSTANCE_NULL')}</span> : text;
  const notFound = instance.error instanceof ApiError && instance.error.status === 404;

  return (
    <PageFrame
      wide
      title={name || id}
      breadcrumbs={[
        <Link key="decisions" to="/cockpit/$engine/decisions" params={{ engine }}>
          {t('DECISION_INSTANCE_DECISIONS')}
        </Link>,
        ...(instance.data
          ? [
              <Link key="definition" to="/cockpit/$engine/decision-definition/$id" params={{ engine, id: instance.data.decisionDefinitionId }}>
                {name}
              </Link>,
            ]
          : []),
        id,
      ]}
    >
      {instance.isError && (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('SERVICES_RESOURCE_RESOLVER_DISPLAY_FAILED', { resourceName: 'decision instance' })}
          subtitle={notFound ? t('SERVICES_RESOURCE_RESOLVER_ID_NOT_FOUND', { resourceName: 'decision instance', id }) : instance.error.message}
        />
      )}
      {!instance.isError && (
        <div className="cz-definition">
          <aside className="cz-definition__info">
            {(instance.isPending || definition.isPending) && <SkeletonText paragraph lineCount={8} />}
            {instance.data && definition.data && (
              <dl>
                <dt>{t('DECISION_INSTANCE_INSTANCE_ID')}</dt>
                <dd className="cz-definition__id">{instance.data.id}</dd>
                <dt>{t('DECISION_INSTANCE_DEFINITION_VERSION')}</dt>
                <dd>{definition.data.version}</dd>
                <dt>{t('DECISION_INSTANCE_DEFINITION_ID')}</dt>
                <dd className="cz-definition__id">
                  <Link to="/cockpit/$engine/decision-definition/$id" params={{ engine, id: definition.data.id }}>
                    {definition.data.id}
                  </Link>
                </dd>
                <dt>{t('DECISION_INSTANCE_DEFINITION_KEY')}</dt>
                <dd>{instance.data.decisionDefinitionKey}</dd>
                <dt>{t('DECISION_INSTANCE_DEFINITION_NAME')}</dt>
                <dd>{value(instance.data.decisionDefinitionName)}</dd>
                <dt>{t('DECISION_INSTANCE_TENANT_ID')}</dt>
                <dd>{value(instance.data.tenantId)}</dd>
                <dt>{t('DECISION_INSTANCE_DEPLOYMENT_ID')}</dt>
                <dd className="cz-definition__id">
                  <DeploymentLink engine={engine} deploymentId={definition.data.deploymentId} resourceName={definition.data.resource} />
                </dd>
                <dt>{t('DECISION_INSTANCE_PROCESS_INSTANCE_ID')}</dt>
                <dd className="cz-definition__id">
                  {instance.data.processInstanceId ? <InstanceLink engine={engine} id={instance.data.processInstanceId} /> : value(null)}
                </dd>
                <dt>{t('DECISION_INSTANCE_CASE_INSTANCE_ID')}</dt>
                <dd className="cz-definition__id">{value(instance.data.caseInstanceId)}</dd>
                <dt>{t('DECISION_INSTANCE_DECISION_REQUIREMENTS_DEFINITION')}</dt>
                <dd className="cz-definition__id">{value(instance.data.decisionRequirementsDefinitionId)}</dd>
                <dt>{t('DECISION_INSTANCE_REMOVAL_TIME')}</dt>
                <dd>{value(instance.data.removalTime && formatDateTime(instance.data.removalTime, i18n.language))}</dd>
              </dl>
            )}
          </aside>
          <div className="cz-definition__main">
            {xml.isError && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={xml.error.message} />}
            {instance.isPending || xml.isPending ? (
              <SkeletonPlaceholder className="cz-diagram-skeleton" />
            ) : (
              xml.data &&
              instance.data && (
                <Suspense fallback={<SkeletonPlaceholder className="cz-diagram-skeleton" />}>
                  <DmnViewer xml={xml.data} decision={instance.data.decisionDefinitionKey} rules={rules} inputs={tableInputs} outputs={tableOutputs} />
                </Suspense>
              )
            )}
            {instance.data && (
              <Tabs selectedIndex={tabIndex} onChange={({ selectedIndex }) => navigate({ search: { tab: TABS[selectedIndex].id } })}>
                <TabList aria-label={id}>
                  {TABS.map((tab) => (
                    <Tab key={tab.id}>{t(tab.label)}</Tab>
                  ))}
                </TabList>
                <TabPanels>
                  <TabPanel>
                    <ValuesTable values={inputs} emptyText={t('PLUGIN_DECISION_LIS_NO_INPUT_TEXT')} />
                  </TabPanel>
                  <TabPanel>
                    <ValuesTable values={outputs} emptyText={t('PLUGIN_DECISION_LIS_NO_OUTPUT_TEXT')} />
                  </TabPanel>
                </TabPanels>
              </Tabs>
            )}
          </div>
        </div>
      )}
    </PageFrame>
  );
}
