/**
 * Criteria of a task filter, as offered by the AngularJS Tasklist's filter
 * dialog (CMMN criteria left out; criteria of an existing filter that are
 * not listed here are kept unchanged). Labels are data, as there.
 */
export interface FilterCriterion {
  key: string;
  label: string;
  /** bool: switched on; list: comma separated; date: yyyy-MM-ddTHH:mm:ss */
  kind: 'text' | 'list' | 'bool' | 'number' | 'date';
  /** the value may be an expression like ${ currentUser() }, saved as <key>Expression */
  expression?: boolean;
  /** candidate criteria may include tasks that are assigned already */
  includeAssignedTasks?: boolean;
}

export const FILTER_CRITERIA: { group: string; criteria: FilterCriterion[] }[] = [
  {
    group: 'Process Instance',
    criteria: [
      { key: 'processInstanceId', label: 'ID', kind: 'text' },
      { key: 'processInstanceBusinessKey', label: 'Business Key', kind: 'text', expression: true },
      { key: 'processInstanceBusinessKeyLike', label: 'Business Key Like', kind: 'text', expression: true },
    ],
  },
  {
    group: 'Process definition',
    criteria: [
      { key: 'processDefinitionId', label: 'ID', kind: 'text' },
      { key: 'processDefinitionKey', label: 'Key', kind: 'text' },
      { key: 'processDefinitionKeyIn', label: 'Key In', kind: 'list' },
      { key: 'processDefinitionName', label: 'Name', kind: 'text' },
      { key: 'processDefinitionNameLike', label: 'Name Like', kind: 'text' },
    ],
  },
  {
    group: 'Other',
    criteria: [
      { key: 'active', label: 'Active', kind: 'bool' },
      { key: 'activityInstanceIdIn', label: 'Activity Instance ID In', kind: 'list' },
      { key: 'executionId', label: 'Execution ID', kind: 'text' },
    ],
  },
  {
    group: 'User / Group',
    criteria: [
      { key: 'assignee', label: 'Assignee', kind: 'text', expression: true },
      { key: 'assigneeIn', label: 'Assignee in', kind: 'list' },
      { key: 'assigneeLike', label: 'Assignee Like', kind: 'text', expression: true },
      { key: 'owner', label: 'Owner', kind: 'text', expression: true },
      { key: 'candidateGroup', label: 'Candidate Group', kind: 'text', expression: true, includeAssignedTasks: true },
      { key: 'candidateGroups', label: 'Candidate Groups', kind: 'list', expression: true, includeAssignedTasks: true },
      { key: 'candidateUser', label: 'Candidate User', kind: 'text', expression: true, includeAssignedTasks: true },
      { key: 'involvedUser', label: 'Involved User', kind: 'text', expression: true },
      { key: 'assigned', label: 'Assigned', kind: 'bool' },
      { key: 'unassigned', label: 'Unassigned', kind: 'bool' },
      { key: 'delegationState', label: 'Delegation State', kind: 'text' },
    ],
  },
  {
    group: 'Task',
    criteria: [
      { key: 'taskDefinitionKey', label: 'Definition Key', kind: 'text' },
      { key: 'taskDefinitionKeyIn', label: 'Definition Key In', kind: 'list' },
      { key: 'taskDefinitionKeyLike', label: 'Definition Key Like', kind: 'text' },
      { key: 'name', label: 'Name', kind: 'text' },
      { key: 'nameLike', label: 'Name Like', kind: 'text' },
      { key: 'description', label: 'Description', kind: 'text' },
      { key: 'descriptionLike', label: 'Description Like', kind: 'text' },
      { key: 'priority', label: 'Priority', kind: 'number' },
      { key: 'maxPriority', label: 'Priority Max', kind: 'number' },
      { key: 'minPriority', label: 'Priority Min', kind: 'number' },
      { key: 'tenantIdIn', label: 'Tenant ID In', kind: 'list' },
      { key: 'withoutTenantId', label: 'Without Tenant ID', kind: 'bool' },
      { key: 'withoutDueDate', label: 'Without Due Date', kind: 'bool' },
    ],
  },
  {
    group: 'Dates',
    criteria: [
      { key: 'createdBefore', label: 'Created Before', kind: 'date', expression: true },
      { key: 'createdAfter', label: 'Created After', kind: 'date', expression: true },
      { key: 'dueBefore', label: 'Due Before', kind: 'date', expression: true },
      { key: 'dueAfter', label: 'Due After', kind: 'date', expression: true },
      { key: 'followUpAfter', label: 'Follow Up After', kind: 'date', expression: true },
      { key: 'followUpBefore', label: 'Follow Up Before', kind: 'date', expression: true },
      { key: 'followUpBeforeOrNotExistent', label: 'Follow Up Before or Not Existent', kind: 'date', expression: true },
    ],
  },
];

const ALL = FILTER_CRITERIA.flatMap((group) => group.criteria);
export const findCriterion = (key: string) => ALL.find((criterion) => criterion.key === key);

/** A row of the dialog. */
export interface CriterionRow {
  key: string;
  value: string;
}

/** What the dialog edits of a filter's query. */
export interface FilterQueryForm {
  rows: CriterionRow[];
  includeAssignedTasks: boolean;
  matchAny: boolean;
  /** query entries the dialog does not offer (kept as they are) */
  preserved: Record<string, unknown>;
}

const EXPRESSION = /^\s*[#$]\{/;
export const isExpression = (value: string) => EXPRESSION.test(value);
const DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{0,4})?$/;

/** @return i18n key of the problem, or null */
export function validateRow(row: CriterionRow): string | null {
  const criterion = findCriterion(row.key);
  if (!criterion || criterion.kind === 'bool') {
    return null;
  }
  const value = row.value.trim();
  if (!value) {
    return 'REQUIRED_FIELD';
  }
  if (criterion.expression && isExpression(value)) {
    return null;
  }
  if (criterion.kind === 'number' && !/^-?\d+$/.test(value)) {
    return 'INVALID_VALUE_FOR_TYPE';
  }
  if (criterion.kind === 'date' && (!DATE.test(value) || Number.isNaN(new Date(value).getTime()))) {
    return 'INVALID_DATE';
  }
  return null;
}

/** Splits a stored filter query into dialog rows. */
export function fromFilterQuery(stored: Record<string, unknown> | undefined): FilterQueryForm {
  let query = stored ?? {};
  let matchAny = false;
  const orQueries = query.orQueries as Record<string, unknown>[] | undefined;
  if (Array.isArray(orQueries) && orQueries.length === 1 && Object.keys(query).length === 1) {
    query = orQueries[0];
    matchAny = true;
  }
  const form: FilterQueryForm = { rows: [], includeAssignedTasks: false, matchAny, preserved: {} };
  for (const [storedKey, value] of Object.entries(query)) {
    if (storedKey === 'includeAssignedTasks') {
      form.includeAssignedTasks = value === true;
      continue;
    }
    const key = storedKey.endsWith('Expression') ? storedKey.slice(0, -'Expression'.length) : storedKey;
    const criterion = findCriterion(key);
    // empty variable lists are what the engine stores for "no variables"
    const emptyList = Array.isArray(value) && value.length === 0;
    if (!criterion || (typeof value === 'object' && value !== null && !Array.isArray(value))) {
      if (!emptyList) {
        form.preserved[storedKey] = value;
      }
      continue;
    }
    if (criterion.kind === 'bool') {
      if (value === true) {
        form.rows.push({ key, value: 'true' });
      }
      continue;
    }
    form.rows.push({ key, value: Array.isArray(value) ? value.join(', ') : String(value ?? '') });
  }
  return form;
}

/** Builds the query to store from the dialog. */
export function toFilterQuery(form: FilterQueryForm): Record<string, unknown> {
  const query: Record<string, unknown> = { ...form.preserved };
  for (const row of form.rows) {
    const criterion = findCriterion(row.key);
    if (!criterion) {
      continue;
    }
    const value = row.value.trim();
    if (criterion.kind === 'bool') {
      query[row.key] = true;
    } else if (criterion.expression && isExpression(value)) {
      query[`${row.key}Expression`] = value;
    } else if (criterion.kind === 'list') {
      query[row.key] = value.split(',').map((part) => part.trim()).filter(Boolean);
    } else if (criterion.kind === 'number') {
      query[row.key] = Number(value);
    } else {
      query[row.key] = value;
    }
  }
  const usesCandidates = form.rows.some((row) => findCriterion(row.key)?.includeAssignedTasks);
  if (form.includeAssignedTasks && usesCandidates) {
    query.includeAssignedTasks = true;
  }
  return form.matchAny ? { orQueries: [query] } : query;
}
