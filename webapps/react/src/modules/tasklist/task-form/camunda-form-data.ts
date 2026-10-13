import { parseEngineDate } from '../../../shared/format';
import { toLocalDateTimeText, type Variables } from '../../../shared/variables';

/** The parts of a Camunda Form (form-js) schema the Tasklist looks at. */
export interface FormSchema {
  components: { key?: string; valuesKey?: string }[];
  [property: string]: unknown;
}

const isJson = (variable: Variables[string]) =>
  variable.type === 'Json' || variable.valueInfo?.serializationDataFormat === 'application/json';

/** Variables that feed the options of a select, radio or checklist field. */
const valuesKeys = (schema: FormSchema) =>
  new Map(schema.components.filter((c) => c.key && c.valuesKey).map((c) => [c.key!, c.valuesKey!]));

/**
 * Turns the task's form variables into the data form-js shows, like the
 * AngularJS Tasklist: dates in local time without offset, JSON parsed,
 * option lists given as plain strings expanded to { label, value }.
 */
export function toFormData(variables: Variables, schema: FormSchema): Record<string, unknown> {
  const optionSources = new Set(valuesKeys(schema).values());
  const data: Record<string, unknown> = {};
  for (const [name, variable] of Object.entries(variables)) {
    let value = variable.value;
    if (variable.type === 'Date') {
      const date = parseEngineDate(value as string);
      value = date ? toLocalDateTimeText(date) : value;
    } else if (isJson(variable) && typeof value === 'string') {
      value = JSON.parse(value);
      if (optionSources.has(name) && Array.isArray(value) && value.every((v) => typeof v === 'string')) {
        value = value.map((v) => ({ label: v, value: v }));
      }
    }
    data[name] = value;
  }
  return data;
}

/**
 * Turns submitted form data into variables. Plain values go without type
 * (the engine picks String, Boolean, Integer, …); objects and lists keep the
 * type of the existing variable, or of the variable that fed their options,
 * else they become Json.
 */
export function toSubmitVariables(data: Record<string, unknown>, variables: Variables, schema: FormSchema): Variables {
  const optionSourceOf = valuesKeys(schema);
  const result: Variables = {};
  for (const [name, value] of Object.entries(data)) {
    if (value !== null && typeof value === 'object') {
      const existing = variables[name] ?? variables[optionSourceOf.get(name) ?? ''];
      result[name] = {
        type: existing?.type ?? 'Json',
        valueInfo: existing?.valueInfo,
        value: JSON.stringify(value),
      };
    } else {
      result[name] = { value };
    }
  }
  return result;
}
