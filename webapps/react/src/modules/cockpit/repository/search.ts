import { validateListSearch, type ListSearch } from '../../../shared/search/list-search';

/**
 * State of the Deployments page in the query string: the search, sorting and
 * page of the deployments, the selected deployment and resource (or, from a
 * link, the resource by name).
 */
export interface RepositorySearch extends ListSearch {
  deployment?: string;
  resource?: string;
  resourceName?: string;
}

export function validateRepositorySearch(search: Record<string, unknown>): RepositorySearch {
  const text = (value: unknown) => (typeof value === 'string' && value ? value : undefined);
  return {
    ...validateListSearch(search),
    deployment: text(search.deployment),
    resource: text(search.resource),
    resourceName: text(search.resourceName),
  };
}

/** The path the resources of a deployment share (shown once, not on every resource). */
export function commonPath(names: string[]): string {
  const folders = names.map((name) => name.split('/').slice(0, -1));
  if (!folders.length) {
    return '';
  }
  const shared: string[] = [];
  for (let index = 0; index < folders[0].length; index++) {
    const part = folders[0][index];
    if (folders.every((folder) => folder[index] === part)) {
      shared.push(part);
    } else {
      break;
    }
  }
  return shared.length ? `${shared.join('/')}/` : '';
}
