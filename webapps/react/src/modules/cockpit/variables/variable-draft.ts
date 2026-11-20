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

/** The types whose content is a file. */
export const BINARY_TYPES = ['Bytes', 'File'];

/** Binary variables: their content is uploaded and downloaded, not edited. */
export const isBinary = (type: string) => BINARY_TYPES.includes(type);

/** A variable being added or edited, as the user enters it. */
export interface VariableDraft {
  name: string;
  type: string;
  /** the value as text ("true"/"false" for Boolean); the serialized value of an Object */
  text: string;
  /** no value: the variable keeps its type and is set to null */
  isNull: boolean;
  objectTypeName: string;
  serializationDataFormat: string;
}

export const emptyDraft = (): VariableDraft => ({
  name: '',
  type: 'String',
  text: '',
  isNull: false,
  objectTypeName: '',
  serializationDataFormat: '',
});

/** The draft of an existing variable (read without deserializing values). */
export function draftOf(variable: { name: string; type: string; value: unknown; valueInfo?: Record<string, unknown> }): VariableDraft {
  const info = variable.valueInfo ?? {};
  const isNull = variable.value === null || variable.value === undefined;
  const text = isNull
    ? ''
    : variable.type === 'Date'
      ? // with its milliseconds, so that saving an unchanged date keeps it
        toLocalDateTimeText(parseEngineDate(String(variable.value)) ?? new Date(NaN), true)
      : typeof variable.value === 'object'
        ? JSON.stringify(variable.value)
        : String(variable.value);
  return {
    name: variable.name,
    type: variable.type,
    text,
    isNull: isNull && variable.type !== 'Null' && !isBinary(variable.type),
    objectTypeName: typeof info.objectTypeName === 'string' ? info.objectTypeName : '',
    serializationDataFormat: typeof info.serializationDataFormat === 'string' ? info.serializationDataFormat : '',
  };
}

/**
 * What keeps the draft from being saved: 'required' (a field is empty, the
 * save button stays disabled) or an i18n key (cockpit) with its values.
 */
export type DraftProblem = 'required' | { key: string; values?: Record<string, string> } | null;

/** @return why the text is not JSON, or null */
export function jsonProblem(text: string): string | null {
  try {
    JSON.parse(text);
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}

function isXml(text: string): boolean {
  return new DOMParser().parseFromString(text, 'application/xml').getElementsByTagName('parsererror').length === 0;
}

export function problemOf(draft: VariableDraft, withName: boolean): DraftProblem {
  if (withName && !draft.name.trim()) {
    return 'required';
  }
  if (draft.type === 'Object' && !(draft.objectTypeName.trim() && draft.serializationDataFormat.trim())) {
    return 'required';
  }
  if (draft.type === 'Null' || draft.isNull || isBinary(draft.type)) {
    return null;
  }
  if (draft.type === 'Object') {
    // as the classic inspect dialog: a JSON-serialized object has to be JSON
    const problem = draft.serializationDataFormat.trim() === 'application/json' ? jsonProblem(draft.text) : null;
    return problem ? { key: 'VARIABLE_INSPECT_MESSAGE_ERR_1', values: { exception: problem } } : null;
  }
  if (draft.type === 'Json' || draft.type === 'Xml') {
    if (!draft.text.trim()) {
      return 'required';
    }
    const valid = draft.type === 'Json' ? !jsonProblem(draft.text) : isXml(draft.text);
    return valid ? null : { key: 'VARIABLE_ADD_VARIABLE_ONLY', values: { type: draft.type } };
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
  const valueInfo =
    draft.type === 'Object'
      ? { objectTypeName: draft.objectTypeName.trim(), serializationDataFormat: draft.serializationDataFormat.trim() }
      : undefined;
  if (draft.type === 'Null') {
    return { type: 'Null', value: null };
  }
  if (draft.isNull) {
    return valueInfo ? { type: draft.type, value: null, valueInfo } : { type: draft.type, value: null };
  }
  if (isPrimitiveType(draft.type)) {
    return toVariableValue(draft.type, draft.text);
  }
  return valueInfo ? { type: 'Object', value: draft.text, valueInfo } : { type: draft.type, value: draft.text };
}
