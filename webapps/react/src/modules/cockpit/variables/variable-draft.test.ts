import { describe, expect, it } from 'vitest';
import { draftOf, emptyDraft, problemOf, valueOf } from './variable-draft';

describe('variable drafts', () => {
  it('edits existing values as text', () => {
    expect(draftOf({ name: 'amount', type: 'Double', value: 30.5 }).text).toBe('30.5');
    expect(draftOf({ name: 'approved', type: 'Boolean', value: false }).text).toBe('false');
    expect(draftOf({ name: 'nothing', type: 'Null', value: null }).text).toBe('');
    expect(draftOf({ name: 'due', type: 'Date', value: '2026-10-14T09:30:00.000+0000' }).text).toMatch(/^2026-10-1\dT\d\d:30:00$/);
    expect(
      draftOf({
        name: 'order',
        type: 'Object',
        value: '{"id":1}',
        valueInfo: { objectTypeName: 'com.example.Order', serializationDataFormat: 'application/json' },
      }),
    ).toEqual({
      name: 'order',
      type: 'Object',
      text: '{"id":1}',
      isNull: false,
      objectTypeName: 'com.example.Order',
      serializationDataFormat: 'application/json',
    });
  });

  it('needs a name, a valid value and, for objects, the type name and format', () => {
    expect(problemOf(emptyDraft(), true)).toBe('required');
    expect(problemOf({ ...emptyDraft(), name: 'note' }, true)).toBeNull();
    expect(problemOf({ ...emptyDraft(), type: 'Integer', text: '' }, false)).toBe('required');
    expect(problemOf({ ...emptyDraft(), type: 'Integer', text: '1.5' }, false)).toEqual({
      key: 'VARIABLE_ADD_VARIABLE_ONLY',
      values: { type: 'Integer' },
    });
    expect(problemOf({ ...emptyDraft(), type: 'Date', text: '14.10.2026' }, false)).toEqual({ key: 'VARIABLE_ADD_VARIABLE_SUPPORTED' });
    expect(problemOf({ ...emptyDraft(), type: 'Object', text: '{}', objectTypeName: 'java.util.HashMap' }, false)).toBe('required');
    expect(problemOf({ ...emptyDraft(), type: 'Null' }, false)).toBeNull();
  });

  it('converts drafts into REST values', () => {
    expect(valueOf({ ...emptyDraft(), type: 'Long', text: ' 42 ' })).toEqual({ type: 'Long', value: 42 });
    expect(valueOf({ ...emptyDraft(), type: 'Boolean', text: 'true' })).toEqual({ type: 'Boolean', value: true });
    expect(valueOf({ ...emptyDraft(), type: 'Null', text: 'ignored' })).toEqual({ type: 'Null', value: null });
    expect(valueOf({ ...emptyDraft(), type: 'Json', text: '{"a":1}' })).toEqual({ type: 'Json', value: '{"a":1}' });
    expect(
      valueOf({ ...emptyDraft(), type: 'Object', text: '{}', objectTypeName: ' java.util.HashMap ', serializationDataFormat: 'application/json' }),
    ).toEqual({ type: 'Object', value: '{}', valueInfo: { objectTypeName: 'java.util.HashMap', serializationDataFormat: 'application/json' } });
  });

  it('keeps the type of a variable without a value, and sets a value to null', () => {
    const empty = draftOf({ name: 'count', type: 'Integer', value: null });
    expect(empty.isNull).toBe(true);
    expect(problemOf(empty, false)).toBeNull();
    expect(valueOf(empty)).toEqual({ type: 'Integer', value: null });
    // taking the null away asks for a value again
    expect(problemOf({ ...empty, isNull: false }, false)).toBe('required');

    expect(valueOf({ ...emptyDraft(), type: 'Date', text: '2026-10-14T09:30:00', isNull: true })).toEqual({ type: 'Date', value: null });
    expect(
      valueOf({ ...emptyDraft(), type: 'Object', text: '{}', isNull: true, objectTypeName: 'java.util.HashMap', serializationDataFormat: 'application/json' }),
    ).toEqual({ type: 'Object', value: null, valueInfo: { objectTypeName: 'java.util.HashMap', serializationDataFormat: 'application/json' } });
    expect(draftOf({ name: 'nothing', type: 'Null', value: null }).isNull).toBe(false);
    expect(draftOf({ name: 'scan', type: 'File', value: null }).isNull).toBe(false);
  });

  it('keeps the milliseconds of a date', () => {
    const draft = draftOf({ name: 'due', type: 'Date', value: '2026-10-14T09:30:00.250+0000' });
    expect(draft.text).toMatch(/:30:00\.250$/);
    expect(problemOf(draft, false)).toBeNull();
    expect(String(valueOf(draft).value)).toMatch(/:30:00\.250[+-]\d{4}$/);
  });

  it('wants Json and Xml values, and a JSON-serialized object, to be well-formed', () => {
    const json = { ...emptyDraft(), type: 'Json' };
    expect(problemOf(json, false)).toBe('required');
    expect(problemOf({ ...json, text: '{"a":' }, false)).toEqual({ key: 'VARIABLE_ADD_VARIABLE_ONLY', values: { type: 'Json' } });
    expect(problemOf({ ...json, text: '{"a":1}' }, false)).toBeNull();

    const xml = { ...emptyDraft(), type: 'Xml' };
    expect(problemOf({ ...xml, text: '<order><id>1</order>' }, false)).toEqual({ key: 'VARIABLE_ADD_VARIABLE_ONLY', values: { type: 'Xml' } });
    expect(problemOf({ ...xml, text: '<order><id>1</id></order>' }, false)).toBeNull();

    const object = { ...emptyDraft(), type: 'Object', objectTypeName: 'java.util.HashMap', serializationDataFormat: 'application/json' };
    expect(problemOf({ ...object, text: '{"a"' }, false)).toMatchObject({ key: 'VARIABLE_INSPECT_MESSAGE_ERR_1' });
    expect(problemOf({ ...object, text: '{"a":1}' }, false)).toBeNull();
    // another format is the engine's to check
    expect(problemOf({ ...object, serializationDataFormat: 'application/x-java-serialized-object', text: 'rO0AB' }, false)).toBeNull();
  });
});
