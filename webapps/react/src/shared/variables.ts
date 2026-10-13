/** A process variable as the engine REST API reads and writes it. */
export interface VariableValue {
  /** Without type the engine derives it from the JSON value. */
  type?: string;
  value: unknown;
  valueInfo?: Record<string, unknown>;
}

export type Variables = Record<string, VariableValue>;

/** Types a user can enter in a generic form. */
export const PRIMITIVE_TYPES = ['Boolean', 'Short', 'Integer', 'Long', 'Double', 'String', 'Date'] as const;
export type PrimitiveType = (typeof PRIMITIVE_TYPES)[number];

export function isPrimitiveType(type: string): type is PrimitiveType {
  return (PRIMITIVE_TYPES as readonly string[]).includes(type);
}

const INTEGER = /^[-+]?\d+$/;
const DOUBLE = /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/;
const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

const RANGES: Record<'Short' | 'Integer' | 'Long', [number, number]> = {
  Short: [-32768, 32767],
  Integer: [-2147483648, 2147483647],
  Long: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
};

/** Parses "yyyy-MM-ddTHH:mm[:ss]" as local time. */
export function parseLocalDateTime(text: string): Date | null {
  const match = LOCAL_DATE_TIME.exec(text.trim());
  if (!match) {
    return null;
  }
  const [year, month, day, hours, minutes, seconds] = match.slice(1).map((part) => Number(part ?? 0));
  const date = new Date(year, month - 1, day, hours, minutes, seconds);
  // rejects 2026-02-31 and the like, which Date would roll over
  return date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

const pad = (n: number, width = 2) => String(Math.abs(n)).padStart(width, '0');

/** "2026-10-13T11:49:55.000+0300", the date format of the engine REST API. */
export function toEngineDate(date: Date): string {
  const offset = -date.getTimezoneOffset();
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}` +
    `${offset >= 0 ? '+' : '-'}${pad(Math.floor(Math.abs(offset) / 60))}${pad(Math.abs(offset) % 60)}`
  );
}

/** Engine date → "yyyy-MM-ddTHH:mm:ss" in local time, for editing. */
export function toLocalDateTimeText(date: Date): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/** @return the i18n key of the problem, or null when the text is a valid value of the type */
export function validateValue(type: PrimitiveType, text: string | boolean): string | null {
  if (type === 'Boolean' || type === 'String') {
    return null;
  }
  const value = String(text).trim();
  if (!value) {
    return 'REQUIRED_FIELD';
  }
  if (type === 'Date') {
    return parseLocalDateTime(value) ? null : 'INVALID_DATE';
  }
  if (type === 'Double') {
    return DOUBLE.test(value) ? null : 'INVALID_VALUE_FOR_TYPE';
  }
  const range = RANGES[type as keyof typeof RANGES];
  return INTEGER.test(value) && Number(value) >= range[0] && Number(value) <= range[1] ? null : 'INVALID_VALUE_FOR_TYPE';
}

/** Converts what the user entered into the value the REST API expects for the type. */
export function toVariableValue(type: PrimitiveType, text: string | boolean): VariableValue {
  switch (type) {
    case 'Boolean':
      return { type, value: text === true || text === 'true' };
    case 'String':
      return { type, value: String(text) };
    case 'Date':
      return { type, value: toEngineDate(parseLocalDateTime(String(text))!) };
    default:
      return { type, value: Number(String(text).trim()) };
  }
}
