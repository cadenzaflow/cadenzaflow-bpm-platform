/** State of the decision instance page in the query string: the tab (inputs or outputs). */
export interface DecisionInstanceSearch {
  tab?: string;
}

export function validateDecisionInstanceSearch(search: Record<string, unknown>): DecisionInstanceSearch {
  return { tab: typeof search.tab === 'string' && search.tab ? search.tab : undefined };
}
