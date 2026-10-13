import { validateListSearch, type ListSearch } from '../../../shared/search/list-search';

/** State of the decision definition page in the query string: the tab and the evaluations' search, sorting and page. */
export interface DecisionDefinitionSearch extends ListSearch {
  tab?: string;
}

export function validateDecisionDefinitionSearch(search: Record<string, unknown>): DecisionDefinitionSearch {
  return { ...validateListSearch(search), tab: typeof search.tab === 'string' && search.tab ? search.tab : undefined };
}

/** State of the decision instance page in the query string: the tab (inputs, outputs or of a plugin). */
export interface DecisionInstanceSearch {
  tab?: string;
}

export function validateDecisionInstanceSearch(search: Record<string, unknown>): DecisionInstanceSearch {
  return { tab: typeof search.tab === 'string' && search.tab ? search.tab : undefined };
}
