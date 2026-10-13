import { VARIABLE_OPERATORS, type CriterionType } from '../../shared/search/criteria';

/** What the Tasklist can search for (task query of the engine REST API; CMMN criteria left out). */
export const TASK_CRITERIA: CriterionType[] = [
  { key: 'processVariables', label: 'PROCESS_VARIABLE', kind: 'variable', operators: VARIABLE_OPERATORS },
  { key: 'taskVariables', label: 'TASK_VARIABLE', kind: 'variable', operators: VARIABLE_OPERATORS },
  { key: 'name', label: 'TASK_NAME', kind: 'property', operators: ['Like', 'eq'] },
  { key: 'assignee', label: 'ASSIGNEE', kind: 'property', operators: ['Like', 'eq'] },
  { key: 'candidateGroup', label: 'CANDIDATE_GROUP', kind: 'property', operators: ['eq'] },
  { key: 'candidateUser', label: 'CANDIDATE_USER', kind: 'property', operators: ['eq'] },
  { key: 'involvedUser', label: 'INVOLVED_USER', kind: 'property', operators: ['eq'] },
  { key: 'owner', label: 'OWNER', kind: 'property', operators: ['eq'] },
  { key: 'processInstanceBusinessKey', label: 'PROCESS_INSTANCE_BUSINESS_KEY', kind: 'property', operators: ['Like', 'eq'] },
  { key: 'processDefinitionName', label: 'PROCESS_DEFINITION_NAME', kind: 'property', operators: ['Like', 'eq'] },
  { key: 'processDefinitionKey', label: 'PROCESS_DEFINITION_KEY', kind: 'property', operators: ['eq'] },
  { key: 'processDefinitionId', label: 'PROCESS_DEFINITION_ID', kind: 'property', operators: ['eq'] },
  { key: 'processInstanceIdIn', label: 'PROCESS_INSTANCE_ID', kind: 'property', operators: ['In'], valueType: 'list' },
  { key: 'executionId', label: 'EXECUTION_ID', kind: 'property', operators: ['eq'] },
  { key: 'taskDefinitionKey', label: 'TASK_DEFINITION_KEY', kind: 'property', operators: ['Like', 'eq'] },
  { key: 'description', label: 'DESCRIPTION', kind: 'property', operators: ['Like', 'eq'] },
  { key: 'priority', label: 'PRIORITY', kind: 'property', operators: ['eq', 'min', 'max'], valueType: 'number' },
  { key: 'due', label: 'DUE_DATE', kind: 'property', operators: ['Before', 'After'], valueType: 'date' },
  { key: 'withoutDueDate', label: 'WITHOUT_DUE_DATE', kind: 'flag', operators: [] },
  { key: 'followUp', label: 'FOLLOW_UP_DATE', kind: 'property', operators: ['Before', 'After'], valueType: 'date' },
  { key: 'created', label: 'CREATION_DATE', kind: 'property', operators: ['Before', 'After'], valueType: 'date' },
  { key: 'delegationState', label: 'DELEGATION_STATE', kind: 'property', operators: ['eq'] },
  { key: 'tenantIdIn', label: 'TENANT_ID', kind: 'property', operators: ['In'], valueType: 'list' },
  { key: 'withoutTenantId', label: 'WITHOUT_TENANT_ID', kind: 'flag', operators: [] },
];

export interface Sorting {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

/** Sort fields of the task query, with their i18n keys. */
export const SORT_FIELDS: { key: string; label: string }[] = [
  { key: 'created', label: 'CREATION_DATE' },
  { key: 'dueDate', label: 'DUE_DATE' },
  { key: 'followUpDate', label: 'FOLLOW_UP_DATE' },
  { key: 'priority', label: 'PRIORITY' },
  { key: 'name', label: 'TASK_NAME' },
  { key: 'assignee', label: 'ASSIGNEE' },
];

export const DEFAULT_SORTING: Sorting = { sortBy: 'created', sortOrder: 'desc' };

/** ?sorting=[{"sortBy":"created","sortOrder":"desc"}], the AngularJS Tasklist's format; first entry used. */
export function parseSorting(json: string | undefined): Sorting {
  try {
    const first = json ? JSON.parse(json)[0] : undefined;
    if (first && SORT_FIELDS.some((field) => field.key === first.sortBy)) {
      return { sortBy: first.sortBy, sortOrder: first.sortOrder === 'asc' ? 'asc' : 'desc' };
    }
  } catch {
    // fall back to the default
  }
  return DEFAULT_SORTING;
}
