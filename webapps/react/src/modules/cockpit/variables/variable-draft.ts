import { parseEngineDate } from '../../../shared/format';
import {
  isPrimitiveType,
  toLocalDateTimeText,
  toVariableValue,
  validateValue,
  type VariableValue,
} from '../../../shared/variables';

/** The types a variable can be given in the Cockpit, in the classic order. */
export const EDITABLE_TYPES = ['String', 'Boolean', 'Short', 'Integer', 'Long', 'Double', 'Date', 'Null', 'Object', 'Json', 'Xml'];

/** Binary variables: their content is uploaded and downloaded, not edited. */
export const isBinary = (type: string) => type === 'Bytes' || type === 'File';

/** A variable being added or edited, as the user enters it. */
export interface VariableDraft {
  name: string;
  type: string;
  /** the value as text ("true"/"false" for Boolean); the serialized value of an Object */
  text: string;
  objectTypeName: string;
  serializationDataFormat: string;
}

export const emptyDraft = (): VariableDraft => ({
  name: '',
  type: 'String',
  text: '',
  objectTypeName: '',
  serializationDataFormat: '',
});

/** The draft of an existing variable (read without deserializing values). */
export function draftOf(variable: { name: string; type: string; value: unknown; valueInfo?: Record<string, unknown> }): VariableDraft {
  const info = variable.valueInfo ?? {};
  const text =
    variable.value === null || variable.value === undefined
      ? ''
      : variable.type === 'Date'
        ? toLocalDateTimeText(parseEngineDate(String(variable.value)) ?? new Date(NaN))
        : typeof variable.value === 'object'
          ? JSON.stringify(variable.value)
          : String(variable.value);
  return {
    name: variable.name,
    type: variable.type,
    text,
    objectTypeName: typeof info.objectTypeName === 'string' ? info.objectTypeName : '',
    serializationDataFormat: typeof info.serializationDataFormat === 'string' ? info.serializationDataFormat : '',
  };
}

/**
 * What keeps the draft from being saved: 'required' (a field is empty, the
 * save button stays disabled) or an i18n key (cockpit) with its values.
 */
export type DraftProblem = 'required' | { key: string; values?: Record<string, string> } | null;

export function problemOf(draft: VariableDraft, withName: boolean): DraftProblem {
  if (withName && !draft.name.trim()) {
    return 'required';
  }
  if (draft.type === 'Object') {
    return draft.objectTypeName.trim() && draft.serializationDataFormat.trim() ? null : 'required';
  }
  if (!isPrimitiveType(draft.type)) {
    return null;
  }
  switch (validateValue(draft.type, draft.text)) {
    case null:
      return null;
    case 'REQUIRED_FIELD':
      return 'required';
    case 'INVALID_DATE':
      return { key: 'VARIABLE_ADD_VARIABLE_SUPPORTED' };
    default:
      return { key: 'VARIABLE_ADD_VARIABLE_ONLY', values: { type: draft.type } };
  }
}

/** The value the REST API expects for a valid draft. */
export function valueOf(draft: VariableDraft): VariableValue {
  if (isPrimitiveType(draft.type)) {
    return toVariableValue(draft.type, draft.text);
  }
  switch (draft.type) {
    case 'Null':
      return { type: 'Null', value: null };
    case 'Object':
      return {
        type: 'Object',
        value: draft.text,
        valueInfo: { objectTypeName: draft.objectTypeName.trim(), serializationDataFormat: draft.serializationDataFormat.trim() },
      };
    default:
      return { type: draft.type, value: draft.text };
  }
}
