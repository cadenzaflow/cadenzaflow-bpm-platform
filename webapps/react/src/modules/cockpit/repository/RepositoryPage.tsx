import { useEffect } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { PageFrame } from '../../../shared/ui/PageFrame';
import { useResources } from './api';
import { DeploymentsColumn } from './DeploymentsColumn';
import { ResourceDetails } from './ResourceDetails';
import { ResourcesColumn } from './ResourcesColumn';
import type { RepositorySearch } from './search';

const route = getRouteApi('/cockpit/$engine/repository');

/**
 * The deployments with their resources, as the classic Cockpit's repository:
 * deployments | resources of the selected deployment | the selected resource.
 */
export function RepositoryPage() {
  const { t } = useTranslation('cockpit');
  const { engine } = route.useParams();
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const resources = useResources(engine, search.deployment);
  const resource = resources.data?.find((candidate) =>
    search.resource ? candidate.id === search.resource : candidate.name === search.resourceName,
  );

  const update = (changes: Partial<RepositorySearch>, replace = false) =>
    navigate({ search: (previous: RepositorySearch) => ({ ...previous, ...changes }), replace });

  // a link names the resource (e.g. from a definition): it becomes the selection
  useEffect(() => {
    if (resource && !search.resource) {
      update({ resource: resource.id, resourceName: undefined }, true);
    }
  }, [resource, search.resource]);

  return (
    <PageFrame wide title={t('REPOSITORY_CONTROLLER_CAM_TITLE_SET')} breadcrumbs={[t('REPOSITORY_CONTROLLER_CAM_BREAD_CRUMB')]}>
      <div className="cz-repository">
        <DeploymentsColumn
          engine={engine}
          search={search}
          onSearchChange={(changes) => update(changes)}
          onSelect={(deployment, replace) => {
            if (deployment !== search.deployment) {
              update({ deployment, resource: undefined, resourceName: undefined }, replace);
            }
          }}
        />
        <ResourcesColumn
          engine={engine}
          deploymentId={search.deployment}
          selected={resource?.id}
          onSelect={(id) => update({ resource: id, resourceName: undefined })}
        />
        <ResourceDetails engine={engine} resource={resource} />
      </div>
    </PageFrame>
  );
}
