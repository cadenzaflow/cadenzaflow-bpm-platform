import { describe, expect, it } from 'vitest';
import { toEngineDate } from '../variables';
import { isComplete, parseVariableValue, toQuery, type CriterionType } from './criteria';

const types: CriterionType[] = [
  { key: 'processVariables', label: 'PV', kind: 'variable', operators: ['eq', 'gt'] },
  { key: 'name', label: 'NAME', kind: 'property', operators: ['Like', 'eq'] },
  { key: 'priority', label: 'PRIORITY', kind: 'property', operators: ['eq', 'min', 'max'], valueType: 'number' },
  { key: 'due', label: 'DUE', kind: 'property', operators: ['Before', 'After'], valueType: 'date' },
  { key: 'tenantIdIn', label: 'TENANT', kind: 'property', operators: ['In'], valueType: 'list' },
  { key: 'withoutDueDate', label: 'WITHOUT', kind: 'flag', operators: [] },
];

describe('parseVariableValue', () => {
  it('reads booleans and numbers, quotes keep text', () => {
    expect(parseVariableValue('true')).toBe(true);
    expect(parseVariableValue(' 42 ')).toBe(42);
    expect(parseVariableValue('"42"')).toBe('42');
    expect(parseVariableValue('ACME')).toBe('ACME');
  });
});

describe('toQuery', () => {
  it('maps each kind of criterion onto the query', () => {
    expect(
      toQuery(
        {
          matchAny: false,
          criteria: [
            { type: 'processVariables', name: 'amount', operator: 'gt', value: '100' },
            { type: 'processVariables', name: 'approved', operator: 'eq', value: 'true' },
            { type: 'name', operator: 'Like', value: 'invoice' },
            { type: 'priority', operator: 'min', value: '50' },
            { type: 'due', operator: 'Before', value: '2026-10-20T13:00' },
            { type: 'tenantIdIn', operator: 'In', value: 'a, b' },
            { type: 'withoutDueDate', operator: '', value: '' },
          ],
        },
        types,
      ),
    ).toEqual({
      processVariables: [
        { name: 'amount', operator: 'gt', value: 100 },
        { name: 'approved', operator: 'eq', value: true },
      ],
      nameLike: '%invoice%',
      minPriority: 50,
      dueBefore: toEngineDate(new Date(2026, 9, 20, 13, 0)),
      tenantIdIn: ['a', 'b'],
      withoutDueDate: true,
    });
  });

  it('skips incomplete criteria and wraps "any" into orQueries', () => {
    expect(
      toQuery(
        {
          matchAny: true,
          criteria: [
            { type: 'name', operator: 'eq', value: 'Review' },
            { type: 'processVariables', operator: 'eq', value: '1' },
            { type: 'due', operator: 'After', value: 'soon' },
          ],
        },
        types,
      ),
    ).toEqual({ orQueries: [{ name: 'Review' }] });
    expect(isComplete({ type: 'priority', operator: 'eq', value: 'x' }, types[2])).toBe(false);
  });
});
