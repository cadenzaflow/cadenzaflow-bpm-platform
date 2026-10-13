import { parseLocalDateTime, toEngineDate } from '../variables';

/**
 * Search criteria for engine REST queries, like the search pills of the
 * AngularJS webapps:
 * - variable: name, operator and value, e.g. processVariables amount > 100
 * - property: a query property with an operator, e.g. name Like "invoice"
 * - flag: a property that is simply switched on, e.g. withoutDueDate
 */
export interface CriterionType {
  key: string;
  /** i18n key */
  label: string;
  kind: 'variable' | 'property' | 'flag';
  /** operator keys; the first is the default */
  operators: string[];
  valueType?: 'text' | 'number' | 'date' | 'list';
  /** REST parameter per operator where it is not the key plus the operator, e.g. { Before: 'before' } */
  params?: Record<string, string>;
}

export interface Criterion {
  type: string;
  name?: string;
  operator: string;
  value: string;
}

export interface SearchState {
  criteria: Criterion[];
  /** true: any criterion may match (orQueries), false: all must match */
  matchAny: boolean;
}

export const VARIABLE_OPERATORS = ['eq', 'neq', 'gt', 'gteq', 'lt', 'lteq', 'like'];

/** i18n keys (or plain symbols) of the operators */
export const OPERATOR_LABELS: Record<string, string> = {
  eq: '=',
  neq: '!=',
  gt: 'SEARCH_GREATER_THAN',
  gteq: 'SEARCH_GREATER_THAN_EQUALS',
  lt: 'SEARCH_LESS_THAN',
  lteq: 'SEARCH_LESS_THAN_EQUALS',
  like: 'LIKE',
  Like: 'LIKE',
  Before: 'BEFORE',
  After: 'AFTER',
  min: 'SEARCH_GREATER_THAN_EQUALS',
  max: 'SEARCH_LESS_THAN_EQUALS',
  In: 'in',
};

/** "true" → true, "42" → 42, anything else stays text; quotes force text: "42" → '42'. */
export function parseVariableValue(text: string): unknown {
  const value = text.trim();
  if (/^".*"$/.test(value)) {
    return value.slice(1, -1);
  }
  if (value === 'true' || value === 'false') {
    return value === 'true';
  }
  if (value !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return value;
}

export function isComplete(criterion: Criterion, type: CriterionType | undefined): boolean {
  if (!type) {
    return false;
  }
  if (type.kind === 'flag') {
    return true;
  }
  if (type.kind === 'variable' && !criterion.name?.trim()) {
    return false;
  }
  if (type.valueType === 'date') {
    return !!parseLocalDateTime(criterion.value);
  }
  if (type.valueType === 'number') {
    return criterion.value.trim() !== '' && !Number.isNaN(Number(criterion.value));
  }
  return criterion.value.trim() !== '';
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Turns the complete criteria into the body of a task / instance query. */
export function toQuery(state: SearchState, types: CriterionType[]): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  for (const criterion of state.criteria) {
    const type = types.find((t) => t.key === criterion.type);
    if (!type || !isComplete(criterion, type)) {
      continue;
    }
    if (type.kind === 'flag') {
      query[type.key] = true;
    } else if (type.kind === 'variable') {
      const list = (query[type.key] as unknown[] | undefined) ?? [];
      list.push({ name: criterion.name!.trim(), operator: criterion.operator, value: parseVariableValue(criterion.value) });
      query[type.key] = list;
    } else {
      const value =
        type.valueType === 'date'
          ? toEngineDate(parseLocalDateTime(criterion.value)!)
          : type.valueType === 'number'
            ? Number(criterion.value)
            : type.valueType === 'list'
              ? criterion.value.split(',').map((part) => part.trim()).filter(Boolean)
              : criterion.value.trim();
      switch (criterion.operator) {
        case 'Like':
          query[`${type.key}Like`] = `%${value}%`;
          break;
        case 'Before':
        case 'After':
          query[type.params?.[criterion.operator] ?? `${type.key}${criterion.operator}`] = value;
          break;
        case 'min':
        case 'max':
          query[`${criterion.operator}${capitalize(type.key)}`] = value;
          break;
        default:
          query[type.key] = value;
      }
    }
  }
  return state.matchAny && Object.keys(query).length > 0 ? { orQueries: [query] } : query;
}

/** For the URL: criteria as JSON, invalid input gives an empty search. */
export function parseCriteria(json: string | undefined): Criterion[] {
  if (!json) {
    return [];
  }
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed)
      ? parsed.filter((c) => c && typeof c.type === 'string' && typeof c.operator === 'string').map((c) => ({
          type: c.type,
          name: typeof c.name === 'string' ? c.name : undefined,
          operator: c.operator,
          value: typeof c.value === 'string' ? c.value : '',
        }))
      : [];
  } catch {
    return [];
  }
}
