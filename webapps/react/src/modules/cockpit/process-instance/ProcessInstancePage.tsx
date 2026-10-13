import { lazy, Suspense, useMemo } from 'react';
import {
  InlineNotification,
  SkeletonPlaceholder,
  SkeletonText,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tag,
} from '@carbon/react';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../../shared/api/client';
import { elementNames } from '../../../shared/diagram/bpmn-names';
import { PluginPoint, PluginView } from '../../../shared/plugins/PluginPoint';
import { useDiagramPlugins, usePluginPoint } from '../../../shared/plugins/plugins';
import { PageFrame } from '../../../shared/ui/PageFrame';
import { useProcessDefinition, useProcessDefinitionXml } from '../process-definition/api';
import { ActivityTree } from './ActivityTree';
import {
  activityBadges,
  activityInstanceOfExecution,
  activityOf,
  allInstances,
  instancesOf,
  treeIdOf,
  treeSelection,
  useActivityInstances,
  useProcessInstance,
  useSuperProcessInstance,
  type ActivityInstance,
} from './api';
import { DeploymentLink } from '../repository/DeploymentLink';
import { InstanceActions } from './InstanceActions';
import { InstanceLink } from './InstanceLink';
import { listOf, textOf, toggle, type ProcessInstanceSearch } from './search';
import { instanceTabs } from './tabs/registry';

const BpmnDiagram = lazy(() => import('../../../shared/diagram/BpmnDiagram'));

const route = getRouteApi('/cockpit/$engine/process-instance/$id');

/**
 * A running process instance as in the classic Cockpit: its details and the
 * activity instance tree on the left, the diagram with the running activity
 * instances, and tabs below. Selecting activities in the diagram or activity
 * instances in the tree filters the tabs (Ctrl/Cmd adds).
 */
export function ProcessInstancePage() {
  const { t } = useTranslation('cockpit');
  const { engine, id } = route.useParams();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const instance = useProcessInstance(engine, id);
  const definition = useProcessDefinition(engine, instance.data?.definitionId ?? '', !!instance.data);
  const xml = useProcessDefinitionXml(engine, instance.data?.definitionId);
  const tree = useActivityInstances(engine, id);
  const superInstance = useSuperProcessInstance(engine, id);
  const names = useMemo(() => elementNames(xml.data), [xml.data]);
  const badges = useMemo(() => (tree.data ? activityBadges(tree.data) : undefined), [tree.data]);
  const badgeLabels = useMemo(
    () => ({ count: t('PLUGIN_ACTIVITY_INSTANCE_RUNNING_ACTIVITY_INSTANCES'), incidents: t('PLUGIN_ACTIVITY_INSTANCE_OPEN_INCIDENTS') }),
    [t],
  );
  const activityIds = listOf(search.activityIds);
  const activityInstanceIds = listOf(search.activityInstanceIds);
  const pluginTabs = usePluginPoint('cockpit', 'cockpit.processInstance.runtime.tab');
  const onViewer = useDiagramPlugins('cockpit', 'cockpit.processInstance.diagram.plugin', engine, { processInstanceId: id });
  // the built-in tabs, then those of plugins
  const tabs = [
    ...instanceTabs.map((tab) => ({ id: tab.id, label: tab.label, plugin: undefined })),
    ...pluginTabs.map((plugin) => ({ id: plugin.id, label: plugin.label ?? plugin.id, plugin })),
  ];
  const tabIndex = Math.max(0, tabs.findIndex((tab) => tab.id === search.tab));
  const definitionName = definition.data ? definition.data.name || definition.data.key : '';

  const activityInstanceNames = useMemo(() => {
    const labels = new Map<string, string>();
    // by tree id: a transition instance may have the process instance's id
    for (const node of tree.data ? [tree.data, ...allInstances(tree.data)] : []) {
      labels.set(treeIdOf(node), node.activityName || names.get(activityOf(node)) || node.activityId);
    }
    return labels;
  }, [tree.data, names]);

  const executionActivityInstances = useMemo(() => (tree.data ? activityInstanceOfExecution(tree.data) : new Map<string, string>()), [tree.data]);

  const update = (changes: Partial<ProcessInstanceSearch>) =>
    navigate({ search: (previous: ProcessInstanceSearch) => ({ ...previous, ...changes }) });
  // another selection or tab starts the tab's list on its first page
  const select = (changes: Partial<ProcessInstanceSearch>) => update({ ...changes, page: undefined });

  // a diagram click selects the activity and all its instances
  const selectActivity = (activityId: string, add: boolean) => {
    const next = activityId ? toggle(activityIds, activityId, add) : [];
    select({
      activityIds: textOf(next),
      activityInstanceIds: textOf(tree.data ? instancesOf(tree.data, next) : []),
    });
  };

  // a tree click selects the activity instance (the root: the whole instance, no filter)
  const selectInstance = (node: ActivityInstance, add: boolean) => {
    if (!tree.data || node === tree.data) {
      select({ activityIds: undefined, activityInstanceIds: undefined });
      return;
    }
    const next = toggle(activityInstanceIds, node.id, add);
    const selectedActivities = allInstances(tree.data)
      .filter((other) => next.includes(other.id))
      .map(activityOf);
    select({ activityIds: textOf([...new Set(selectedActivities)]), activityInstanceIds: textOf(next) });
  };

  const selectInstanceById = (activityInstanceId: string) => {
    const node = tree.data && [tree.data, ...allInstances(tree.data)].find((other) => treeIdOf(other) === activityInstanceId);
    if (node) {
      selectInstance(node, false);
    }
  };

  const value = (text: string | number | null | undefined) =>
    text === null || text === undefined || text === '' ? <span className="cz-null">{t('PROCESS_INSTANCE_NULL')}</span> : text;

  const notFound = instance.error instanceof ApiError && instance.error.status === 404;

  return (
    <PageFrame
      wide
      title={definitionName || id}
      breadcrumbs={[
        <Link key="processes" to="/cockpit/$engine/processes" params={{ engine }}>
          {t('COCKPIT_PROCESSES')}
        </Link>,
        ...(definition.data
          ? [
              <Link key="definition" to="/cockpit/$engine/process-definition/$id" params={{ engine, id: definition.data.id }}>
                {definitionName}
              </Link>,
            ]
          : []),
        id,
      ]}
      actions={
        instance.data && (
          <>
            <InstanceActions
              engine={engine}
              instance={instance.data}
              onCanceled={() =>
                navigate({ to: '/cockpit/$engine/process-definition/$id', params: { engine, id: instance.data.definitionId } })
              }
              scopeOf={(executionId) => {
                const activityInstanceId = executionActivityInstances.get(executionId);
                return activityInstanceId && activityInstanceNames.get(activityInstanceId);
              }}
            />
            <PluginPoint module="cockpit" point="cockpit.processInstance.runtime.action" engine={engine} props={{ processInstanceId: id }} className="cz-plugin-inline" />
          </>
        )
      }
    >
      {instance.isError && (
        <InlineNotification
          kind="error"
          lowContrast
          hideCloseButton
          title={t('PROCESS_INSTANCE_STATUS_FAILED_RUNNING_PROCESS')}
          subtitle={notFound ? t('PROCESS_INSTANCE_MESSAGE_5', { id }) : instance.error.message}
        />
      )}
      {!instance.isError && (
        <div className="cz-definition">
          <aside className="cz-definition__info">
            {(instance.isPending || definition.isPending) && <SkeletonText paragraph lineCount={8} />}
            {instance.data && definition.data && (
              <dl>
                <dt>{t('PROCESS_INSTANCE_INSTANCE_ID')}</dt>
                <dd className="cz-definition__id">
                  {instance.data.id}
                  {instance.data.suspended && (
                    <Tag size="sm" type="gray" className="cz-instance-state">
                      {t('PLUGIN_PROCESS_INSTANCE_SUSPENDED')}
                    </Tag>
                  )}
                </dd>
                <dt>{t('PROCESS_INSTANCE_BUSINESS_KEY')}</dt>
                <dd>{value(instance.data.businessKey)}</dd>
                <dt>{t('PROCESS_INSTANCE_DEFINITION_VERSION')}</dt>
                <dd>{definition.data.version}</dd>
                <dt>{t('PROCESS_INSTANCE_DEFINITION_ID')}</dt>
                <dd className="cz-definition__id">
                  <Link to="/cockpit/$engine/process-definition/$id" params={{ engine, id: definition.data.id }}>
                    {definition.data.id}
                  </Link>
                </dd>
                <dt>{t('PROCESS_INSTANCE_DEFINITION_KEY')}</dt>
                <dd>{definition.data.key}</dd>
                <dt>{t('PROCESS_INSTANCE_DEFINITION_NAME')}</dt>
                <dd>{value(definition.data.name)}</dd>
                <dt>{t('PROCESS_INSTANCE_TENANT_ID')}</dt>
                <dd>{value(instance.data.tenantId)}</dd>
                <dt>{t('PROCESS_INSTANCE_DEPLOYMENT_ID')}</dt>
                <dd className="cz-definition__id">
                  <DeploymentLink engine={engine} deploymentId={definition.data.deploymentId} resourceName={definition.data.resource} />
                </dd>
                <dt>{t('PROCESS_INSTANCE_SUPER_PROCESS_INSTANCE_ID')}</dt>
                <dd className="cz-definition__id">
                  {superInstance.data ? <InstanceLink engine={engine} id={superInstance.data.id} /> : value(null)}
                </dd>
              </dl>
            )}
            <div className="cz-activity-tree">
              {tree.isPending && <SkeletonText paragraph lineCount={4} />}
              {tree.isError && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={tree.error.message} />}
              {tree.data && (
                <ActivityTree
                  root={tree.data}
                  names={names}
                  selected={treeSelection(tree.data, activityIds, activityInstanceIds)}
                  onSelect={selectInstance}
                />
              )}
            </div>
          </aside>
          <div className="cz-definition__main">
            {xml.isError && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={xml.error.message} />}
            {instance.isPending || xml.isPending ? (
              <SkeletonPlaceholder className="cz-diagram-skeleton" />
            ) : (
              xml.data && (
                <Suspense fallback={<SkeletonPlaceholder className="cz-diagram-skeleton" />}>
                  <BpmnDiagram
                    xml={xml.data}
                    badges={badges}
                    badgeLabels={badgeLabels}
                    selected={activityIds}
                    onElementClick={selectActivity}
                    onViewer={onViewer}
                  />
                </Suspense>
              )
            )}
            {instance.data && definition.data && (
              <Tabs selectedIndex={tabIndex} onChange={({ selectedIndex }) =>
                  update({ tab: tabs[selectedIndex].id, searchQuery: undefined, page: undefined, sortBy: undefined, sortOrder: undefined })
                }>
                <TabList aria-label={id}>
                  {tabs.map((tab) => (
                    <Tab key={tab.id}>{t(tab.label)}</Tab>
                  ))}
                </TabList>
                <TabPanels>
                  {tabs.map((tab, index) => {
                    const BuiltIn = instanceTabs[index]?.component;
                    return (
                      <TabPanel key={tab.id}>
                        {index === tabIndex && tab.plugin && (
                          <PluginView plugin={tab.plugin} engine={engine} props={{ processInstanceId: id }} />
                        )}
                        {index === tabIndex && !tab.plugin && (
                          <BuiltIn
                            engine={engine}
                            instance={instance.data}
                            definition={definition.data}
                            activityIds={activityIds}
                            activityInstanceIds={activityInstanceIds}
                            activityNames={names}
                            activityInstanceNames={activityInstanceNames}
                            executionActivityInstances={executionActivityInstances}
                            onActivitySelect={(activityId) => selectActivity(activityId, false)}
                            onActivityInstanceSelect={selectInstanceById}
                            search={search}
                            onSearchChange={update}
                          />
                        )}
                      </TabPanel>
                    );
                  })}
                </TabPanels>
              </Tabs>
            )}
          </div>
        </div>
      )}
    </PageFrame>
  );
}
