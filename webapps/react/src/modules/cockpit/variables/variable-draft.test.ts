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
    ).toEqual({ name: 'order', type: 'Object', text: '{"id":1}', objectTypeName: 'com.example.Order', serializationDataFormat: 'application/json' });
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
});
