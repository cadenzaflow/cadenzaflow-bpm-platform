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
  /** criteria of one group exclude each other, e.g. with and without failures */
  group?: string;
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

const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

/**
 * The value of a variable criterion, read as the AngularJS webapps read it:
 * true and false are booleans, 42 is a number, NULL is no value,
 * yyyy-MM-ddTHH:mm:ss is a date (local time) and anything else is text.
 * Quotes force text: '42' and "42" are the text 42.
 */
export function parseVariableValue(text: string): unknown {
  const value = text.trim();
  if (/^".*"$/.test(value) || /^'.*'$/.test(value)) {
    return value.slice(1, -1);
  }
  if (value === 'true' || value === 'false') {
    return value === 'true';
  }
  if (value === 'NULL') {
    return null;
  }
  if (value !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  if (DATE_TIME.test(value)) {
    const date = parseLocalDateTime(value);
    return date ? toEngineDate(date) : value;
  }
  return value;
}

/**
 * The value of a "like" comparison. Text without a wildcard is looked for
 * anywhere in the value (%text%), as in the AngularJS webapps; text with
 * % or _ is the pattern itself. \% and \_ are the characters, not wildcards.
 */
export function likePattern(text: string): string {
  return /[%_]/.test(text.replace(/\\[%_]/g, '')) ? text : `%${text}%`;
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

const unite = (a: unknown[], b: unknown[]) => [...new Set([...a, ...b])];

/**
 * The query of a list: what is always asked for plus the search. Where both
 * name a list (the activities selected in the diagram and an activity
 * criterion), the lists add up; the search does not undo the selection.
 */
export function withFixedQuery(fixed: Record<string, unknown> | undefined, searched: Record<string, unknown>): Record<string, unknown> {
  const query = { ...fixed, ...searched };
  for (const [key, value] of Object.entries(fixed ?? {})) {
    if (Array.isArray(value) && Array.isArray(searched[key])) {
      query[key] = unite(value, searched[key] as unknown[]);
    }
  }
  return query;
}

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
      const value = criterion.operator === 'like' ? likePattern(criterion.value.trim()) : parseVariableValue(criterion.value);
      list.push({ name: criterion.name!.trim(), operator: criterion.operator, value });
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
          query[`${type.key}Like`] = likePattern(String(value));
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
          // several criteria of a list type add up, e.g. one activity each
          query[type.key] = Array.isArray(value) && Array.isArray(query[type.key]) ? unite(query[type.key] as unknown[], value) : value;
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
