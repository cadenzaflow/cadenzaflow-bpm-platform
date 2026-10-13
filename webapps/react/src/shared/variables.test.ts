import { describe, expect, it } from 'vitest';
import { parseEngineDate } from './format';
import { parseLocalDateTime, toEngineDate, toLocalDateTimeText, toVariableValue, validateValue } from './variables';

describe('validateValue', () => {
  it('checks numbers against their type', () => {
    expect(validateValue('Short', '32767')).toBeNull();
    expect(validateValue('Short', '32768')).toBe('INVALID_VALUE_FOR_TYPE');
    expect(validateValue('Integer', '1.5')).toBe('INVALID_VALUE_FOR_TYPE');
    expect(validateValue('Long', '-9007199254740991')).toBeNull();
    expect(validateValue('Double', '1e-3')).toBeNull();
    expect(validateValue('Double', 'abc')).toBe('INVALID_VALUE_FOR_TYPE');
    expect(validateValue('Integer', ' ')).toBe('REQUIRED_FIELD');
  });

  it('accepts any string and boolean, and dates in yyyy-MM-ddTHH:mm:ss', () => {
    expect(validateValue('String', '')).toBeNull();
    expect(validateValue('Boolean', false)).toBeNull();
    expect(validateValue('Date', '2026-10-13T11:49:55')).toBeNull();
    expect(validateValue('Date', '2026-02-31T10:00:00')).toBe('INVALID_DATE');
    expect(validateValue('Date', '13.10.2026')).toBe('INVALID_DATE');
  });
});

describe('dates', () => {
  it('parses local date and time', () => {
    expect(parseLocalDateTime('2026-10-13T11:49')).toEqual(new Date(2026, 9, 13, 11, 49, 0));
  });

  it('writes the engine format with the local offset and round-trips', () => {
    const date = new Date(2026, 9, 13, 11, 49, 55, 851);
    const text = toEngineDate(date);
    expect(text).toMatch(/^2026-10-13T11:49:55\.851[+-]\d{4}$/);
    expect(parseEngineDate(text)).toEqual(date);
    expect(toLocalDateTimeText(date)).toBe('2026-10-13T11:49:55');
  });
});

describe('toVariableValue', () => {
  it('converts the entered text into the REST value of the type', () => {
    expect(toVariableValue('Integer', ' 42 ')).toEqual({ type: 'Integer', value: 42 });
    expect(toVariableValue('Double', '1.5')).toEqual({ type: 'Double', value: 1.5 });
    expect(toVariableValue('Boolean', true)).toEqual({ type: 'Boolean', value: true });
    expect(toVariableValue('String', 'x')).toEqual({ type: 'String', value: 'x' });
    expect(toVariableValue('Date', '2026-10-13T11:49:55').value).toBe(toEngineDate(new Date(2026, 9, 13, 11, 49, 55)));
  });
});
