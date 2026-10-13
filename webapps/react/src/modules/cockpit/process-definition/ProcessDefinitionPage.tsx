import { lazy, Suspense, useMemo } from 'react';
import {
  InlineNotification,
  Select,
  SelectItem,
  SkeletonPlaceholder,
  SkeletonText,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
} from '@carbon/react';
import { Link, getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { PluginPoint, PluginView } from '../../../shared/plugins/PluginPoint';
import { useDiagramPlugins, usePluginPoint } from '../../../shared/plugins/plugins';
import { PageFrame } from '../../../shared/ui/PageFrame';
import { useActivityBadges, useProcessDefinition, useProcessDefinitionXml, useRunningInstances, useVersions } from './api';
import { TimeToLive } from '../components/TimeToLive';
import { DeploymentLink } from '../repository/DeploymentLink';
import { DefinitionSuspension } from './DefinitionSuspension';
import { selectedActivities, type ProcessDefinitionSearch } from './search';
import { definitionTabs } from './tabs/registry';

const BpmnDiagram = lazy(() => import('../../../shared/diagram/BpmnDiagram'));

const route = getRouteApi('/cockpit/$engine/process-definition/$id');

/**
 * A process definition as in the classic Cockpit: its details on the left,
 * the diagram with running instances and incidents per activity, and tabs
 * below. Clicking activities filters the instance list (Ctrl/Cmd adds).
 */
export function ProcessDefinitionPage() {
  const { t } = useTranslation('cockpit');
  const { engine, id } = route.useParams();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const definition = useProcessDefinition(engine, id);
  // reached from a calling definition: its instances are filtered by it
  const parent = useProcessDefinition(engine, search.parentProcessDefinitionId ?? '', !!search.parentProcessDefinitionId);
  const xml = useProcessDefinitionXml(engine, id);
  const badges = useActivityBadges(engine, id);
  const versions = useVersions(engine, definition.data);
  const running = useRunningInstances(engine, definition.data);
  const activityIds = selectedActivities(search);
  const badgeLabels = useMemo(
    () => ({ count: t('PLUGIN_PROCESS_DEF_RUNNING_INSTANCES'), incidents: t('PLUGIN_PROCESS_DEF_INCIDENTS') }),
    [t],
  );
  const pluginTabs = usePluginPoint('cockpit', 'cockpit.processDefinition.runtime.tab');
  const onViewer = useDiagramPlugins('cockpit', 'cockpit.processDefinition.diagram.plugin', engine, { processDefinitionId: id });
  // the built-in tabs, then those of plugins
  const tabs = [
    ...definitionTabs.map((tab) => ({ id: tab.id, label: tab.label, plugin: undefined })),
    ...pluginTabs.map((plugin) => ({ id: plugin.id, label: plugin.label ?? plugin.id, plugin })),
  ];
  const tabIndex = Math.max(0, tabs.findIndex((tab) => tab.id === search.tab));
  const name = definition.data ? definition.data.name || definition.data.key : id;

  const update = (changes: Partial<ProcessDefinitionSearch>) =>
    navigate({ search: (previous: ProcessDefinitionSearch) => ({ ...previous, ...changes }) });
  const selectActivity = (activityId: string, add: boolean) => {
    const next = !activityId
      ? []
      : add
        ? activityIds.includes(activityId)
          ? activityIds.filter((other) => other !== activityId)
          : [...activityIds, activityId]
        : activityIds.length === 1 && activityIds[0] === activityId
          ? []
          : [activityId];
    update({ activityIds: next.length ? next.join(',') : undefined, page: undefined });
  };

  const value = (text: string | number | null | undefined) =>
    text === null || text === undefined || text === '' ? <span className="cz-null">{t('PROCESS_DEFINITION_NULL')}</span> : text;

  return (
    <PageFrame
      wide
      title={name}
      breadcrumbs={[
        <Link key="processes" to="/cockpit/$engine/processes" params={{ engine }}>
          {t('COCKPIT_PROCESSES')}
        </Link>,
        ...(parent.data
          ? [
              <Link key="parent" to="/cockpit/$engine/process-definition/$id" params={{ engine, id: parent.data.id }}>
                {parent.data.name || parent.data.key}
              </Link>,
            ]
          : []),
        name,
      ]}
      actions={
        <>
          {definition.data && <DefinitionSuspension engine={engine} definition={definition.data} />}
          <PluginPoint module="cockpit" point="cockpit.processDefinition.runtime.action" engine={engine} props={{ processDefinitionId: id }} className="cz-plugin-inline" />
        </>
      }
    >
      {definition.isError && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={definition.error.message} />}
      <div className="cz-definition">
        <aside className="cz-definition__info">
          {definition.isPending && <SkeletonText paragraph lineCount={8} />}
          {definition.data && (
            <dl>
              <dt>{t('PROCESS_DEFINITION_DEFINITION_VERSION')}</dt>
              <dd>
                {versions.data && versions.data.length > 1 ? (
                  <Select
                    id="cz-definition-version"
                    labelText={t('PROCESS_DEFINITION_DEFINITION_VERSION')}
                    hideLabel
                    size="sm"
                    value={id}
                    onChange={(event) =>
                      navigate({ to: '/cockpit/$engine/process-definition/$id', params: { engine, id: event.target.value } })
                    }
                  >
                    {versions.data.map((version) => (
                      <SelectItem key={version.id} value={version.id} text={String(version.version)} />
                    ))}
                  </Select>
                ) : (
                  definition.data.version
                )}
              </dd>
              <dt>{t('PROCESS_DEFINITION_VERSION_TAG')}</dt>
              <dd>{value(definition.data.versionTag)}</dd>
              <dt>{t('PROCESS_DEFINITION_DEFINITION_ID')}</dt>
              <dd className="cz-definition__id">{definition.data.id}</dd>
              <dt>{t('PROCESS_DEFINITION_DEFINITION_KEY')}</dt>
              <dd>{definition.data.key}</dd>
              <dt>{t('PROCESS_DEFINITION_DEFINITION_NAME')}</dt>
              <dd>{value(definition.data.name)}</dd>
              <dt>{t('PROCESS_DEFINITION_HISTORY_TIME_TO_LIVE')}</dt>
              <dd>
                <TimeToLive
                  engine={engine}
                  resource="process-definition"
                  id={definition.data.id}
                  value={definition.data.historyTimeToLive}
                />
              </dd>
              <dt>{t('PROCESS_DEFINITION_TENANT_ID')}</dt>
              <dd>{value(definition.data.tenantId)}</dd>
              <dt>{t('PROCESS_DEFINITION_DEPLOYMENT_ID')}</dt>
              <dd className="cz-definition__id">
                <DeploymentLink engine={engine} deploymentId={definition.data.deploymentId} resourceName={definition.data.resource} />
              </dd>
              <dt>{t('PROCESS_DEFINITION_INSTANCES_RUNNING')}</dt>
              <dd>
                {running.data ? (
                  <ul>
                    <li>
                      {t('PROCESS_DEFINITION_CURRENT_VERSION')} {running.data.current.toLocaleString()}
                    </li>
                    <li>
                      {t('PROCESS_DEFINITION_ALL_VERSIONS')} {running.data.all.toLocaleString()}
                    </li>
                  </ul>
                ) : (
                  <SkeletonText />
                )}
              </dd>
            </dl>
          )}
        </aside>
        <div className="cz-definition__main">
          {xml.isError && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={xml.error.message} />}
          {xml.isPending ? (
            <SkeletonPlaceholder className="cz-diagram-skeleton" />
          ) : (
            xml.data && (
              <Suspense fallback={<SkeletonPlaceholder className="cz-diagram-skeleton" />}>
                <BpmnDiagram
                  xml={xml.data}
                  badges={badges.data}
                  badgeLabels={badgeLabels}
                  selected={activityIds}
                  onElementClick={selectActivity}
                  onViewer={onViewer}
                />
              </Suspense>
            )
          )}
          {definition.data && (
            <Tabs
              selectedIndex={tabIndex}
              onChange={({ selectedIndex }) => update({ tab: tabs[selectedIndex].id })}
            >
              <TabList aria-label={name}>
                {tabs.map((tab) => (
                  <Tab key={tab.id}>{t(tab.label)}</Tab>
                ))}
              </TabList>
              <TabPanels>
                {tabs.map((tab, index) => {
                  const BuiltIn = definitionTabs[index]?.component;
                  return (
                    <TabPanel key={tab.id}>
                      {index === tabIndex &&
                        (tab.plugin ? (
                          <PluginView plugin={tab.plugin} engine={engine} props={{ processDefinitionId: id }} />
                        ) : (
                          <BuiltIn engine={engine} definition={definition.data} activityIds={activityIds} search={search} onSearchChange={update} />
                        ))}
                    </TabPanel>
                  );
                })}
              </TabPanels>
            </Tabs>
          )}
        </div>
      </div>
    </PageFrame>
  );
}
