import { validateListSearch, type ListSearch } from '../../../shared/search/list-search';

/**
 * State of the process definition page in the query string: the tab, the
 * activities selected in the diagram (they filter the instances) and the
 * search, sorting and page of the instance list.
 */
export interface ProcessDefinitionSearch extends ListSearch {
  tab?: string;
  /** comma separated activity ids, as in the classic Cockpit */
  activityIds?: string;
  /** only instances called by instances of this (calling) definition */
  parentProcessDefinitionId?: string;
}

export function validateProcessDefinitionSearch(search: Record<string, unknown>): ProcessDefinitionSearch {
  const text = (value: unknown) => (typeof value === 'string' && value ? value : undefined);
  return {
    ...validateListSearch(search),
    tab: text(search.tab),
    activityIds: text(search.activityIds),
    parentProcessDefinitionId: text(search.parentProcessDefinitionId),
  };
}

export const selectedActivities = (search: ProcessDefinitionSearch) => (search.activityIds ?? '').split(',').filter(Boolean);
