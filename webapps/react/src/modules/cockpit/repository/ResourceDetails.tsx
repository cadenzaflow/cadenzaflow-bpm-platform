import { lazy, Suspense, type ReactNode } from 'react';
import { Button, InlineNotification, SkeletonPlaceholder, SkeletonText } from '@carbon/react';
import { Download } from '@carbon/icons-react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { PluginPoint } from '../../../shared/plugins/PluginPoint';
import { ListTable, type Column } from '../../../shared/ui/ListTable';
import {
  resourceDataUrl,
  resourceType,
  useDecisionRequirements,
  useDefinitionInstanceCount,
  useResourceDefinitions,
  useResourceText,
  type DeploymentResource,
  type ResourceDefinition,
  type ResourceType,
} from './api';

const BpmnDiagram = lazy(() => import('../../../shared/diagram/BpmnDiagram'));
const DmnViewer = lazy(() => import('../../../shared/diagram/DmnViewer'));
const FormPreview = lazy(() => import('../../../shared/diagram/FormPreview'));

function InstanceCount({ engine, type, definitionId }: { engine: string; type: ResourceType; definitionId: string }) {
  const { t } = useTranslation('cockpit');
  const count = useDefinitionInstanceCount(engine, type, definitionId);
  if (count.isPending) {
    return <span className="cz-null">{t('REPOSITORY_DEPLOYMENT_LOADING')}</span>;
  }
  return count.isError ? t('REPOSITORY_DEPLOYMENT_COULD_NOT_LOAD') : count.data.toLocaleString();
}

/** The definitions deployed from a BPMN, DMN or CMMN resource; for DMN also its decision requirements definition. */
function Definitions({ engine, resource, type }: { engine: string; resource: DeploymentResource; type: ResourceType }) {
  const { t } = useTranslation('cockpit');
  const definitions = useResourceDefinitions(engine, resource);
  const requirements = useDecisionRequirements(engine, type === 'dmn' ? definitions.data?.[0]?.decisionRequirementsDefinitionId : undefined);

  const name = (definition: ResourceDefinition) => definition.name || definition.key || definition.id;
  const columns: Column<ResourceDefinition>[] = [
    {
      key: 'name',
      header: t('REPOSITORY_DEPLOYMENT_NAME'),
      render: (definition) =>
        type === 'bpmn' ? (
          <Link to="/cockpit/$engine/process-definition/$id" params={{ engine, id: definition.id }}>
            {name(definition)}
          </Link>
        ) : type === 'dmn' ? (
          <Link to="/cockpit/$engine/decision-definition/$id" params={{ engine, id: definition.id }}>
            {name(definition)}
          </Link>
        ) : (
          name(definition)
        ),
    },
    { key: 'key', header: t('REPOSITORY_DEPLOYMENT_KEY'), render: (definition) => definition.key },
    type === 'dmn'
      ? { key: 'version', header: t('REPOSITORY_DEPLOYMENT_VERSION'), render: (definition) => definition.version }
      : {
          key: 'instances',
          header: t('REPOSITORY_DEPLOYMENT_INSTANCE_COUNTS'),
          render: (definition) => <InstanceCount engine={engine} type={type} definitionId={definition.id} />,
        },
  ];
  const requirementColumns: Column<ResourceDefinition>[] = [
    { key: 'name', header: t('REPOSITORY_DEPLOYMENT_NAME'), render: name },
    { key: 'key', header: t('REPOSITORY_DEPLOYMENT_KEY'), render: (definition) => definition.key },
    { key: 'version', header: t('REPOSITORY_DEPLOYMENT_VERSION'), render: (definition) => definition.version },
  ];

  return (
    <section className="cz-repository__definitions">
      <h3 className="cz-section-title">{t('DEFINITIONS_DEFINITIONS')}</h3>
      {definitions.isPending && <SkeletonText paragraph lineCount={2} />}
      {definitions.isError && (
        <InlineNotification kind="error" lowContrast hideCloseButton title={t('REPOSITORY_DEPLOYMENT_RESOURCE_CTRL_MSN')} subtitle={definitions.error.message} />
      )}
      {definitions.data?.length === 0 && <p className="cz-list-empty">{t('REPOSITORY_DEPLOYMENT_DEFINITIONS_TEXT_EMPTY_1')}</p>}
      {!!definitions.data?.length && <ListTable columns={columns} items={definitions.data} rowKey={(definition) => definition.id} />}
      {type === 'dmn' && definitions.data && (
        <>
          <h3 className="cz-section-title">{t('REPOSITORY_DEPLOYMENT_DECISION_TEXT')}</h3>
          {requirements.data ? (
            <ListTable columns={requirementColumns} items={[requirements.data]} rowKey={(definition) => definition.id} />
          ) : (
            !requirements.isLoading && <p className="cz-list-empty">{t('REPOSITORY_DEPLOYMENT_DEFINITIONS_TEXT_EMPTY_2')}</p>
          )}
        </>
      )}
    </section>
  );
}

/**
 * The selected resource: BPMN and DMN as diagrams, Camunda Forms as a
 * read-only form, images as images and everything else as text (HTML files
 * too: they are never rendered), with a download link and, for BPMN, DMN and
 * CMMN, the definitions deployed from it.
 */
export function ResourceDetails({ engine, resource }: { engine: string; resource: DeploymentResource | undefined }) {
  const { t } = useTranslation('cockpit');
  const text = useResourceText(engine, resource);
  const definitions = useResourceDefinitions(engine, resource);

  if (!resource) {
    return (
      <section className="cz-repository__column cz-repository__details">
        <p className="cz-list-empty">{t('REPOSITORY_DEPLOYMENT_RESOURCE_DIRECTIVES_SELECT_SRC')}</p>
      </section>
    );
  }

  const type = resourceType(resource.name);
  const slash = resource.name.lastIndexOf('/');
  const version = type !== 'dmn' ? definitions.data?.[0]?.version : undefined;
  const skeleton = <SkeletonPlaceholder className="cz-diagram-skeleton" />;
  const source = (content: string) => (
    <pre className="cz-repository__source">
      <code>{content}</code>
    </pre>
  );

  let content: ReactNode = null;
  if (type === 'image') {
    content = <img className="cz-repository__image" src={resourceDataUrl(engine, resource)} alt={resource.name} />;
  } else if (text.isPending) {
    content = skeleton;
  } else if (text.isError) {
    content = (
      <InlineNotification kind="error" lowContrast hideCloseButton title={t('REPOSITORY_DEPLOYMENT_RESOURCE_DIRECTIVES_RETURN_2')} subtitle={text.error.message} />
    );
  } else if (type === 'bpmn') {
    content = (
      <Suspense fallback={skeleton}>
        <BpmnDiagram xml={text.data} />
      </Suspense>
    );
  } else if (type === 'dmn') {
    content = (
      <Suspense fallback={skeleton}>
        <DmnViewer xml={text.data} />
      </Suspense>
    );
  } else if (type === 'form') {
    content = (
      <>
        <h3 className="cz-section-title">{t('REPOSITORY_RESOURCES_FORM_PREVIEW')}</h3>
        <Suspense fallback={skeleton}>
          <FormPreview schema={text.data} errorTitle={t('FORM_FAILURE')} />
        </Suspense>
        <h3 className="cz-section-title">{t('REPOSITORY_RESOURCES_RAW_DATA')}</h3>
        {source(text.data)}
      </>
    );
  } else {
    content = source(text.data);
  }

  return (
    <section className="cz-repository__column cz-repository__details">
      <header className="cz-repository__details-header">
        <div>
          {slash >= 0 && <span className="cz-repository__path">{resource.name.slice(0, slash + 1)}</span>}
          <h2 className="cz-repository__file">{resource.name.slice(slash + 1)}</h2>
          {version !== undefined && (
            <p className="cz-repository__version">
              {t('REPOSITORY_DEPLOYMENT_RESOURCE_DIRECTIVES_VERSION')} {version}
            </p>
          )}
        </div>
        <span className="cz-row-actions">
          <PluginPoint
            module="cockpit"
            point="cockpit.repository.resource.action"
            engine={engine}
            props={{ deploymentId: resource.deploymentId, resourceId: resource.id }}
            className="cz-plugin-inline"
          />
          <Button kind="tertiary" size="sm" renderIcon={Download} href={resourceDataUrl(engine, resource)}>
            {t('REPOSITORY_DEPLOYMENT_DOWNLOAD_DOWNLOAD')}
          </Button>
        </span>
      </header>
      {content}
      {['bpmn', 'dmn', 'cmmn'].includes(type) && <Definitions engine={engine} resource={resource} type={type} />}
      <PluginPoint
        module="cockpit"
        point="cockpit.repository.resource.detail"
        engine={engine}
        props={{ deploymentId: resource.deploymentId, resourceId: resource.id }}
        className="cz-plugin-section"
      />
    </section>
  );
}
