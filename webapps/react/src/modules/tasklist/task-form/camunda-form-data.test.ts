import { describe, expect, it } from 'vitest';
import { toEngineDate } from '../../../shared/variables';
import { toFormData, toSubmitVariables, type FormSchema } from './camunda-form-data';

const schema: FormSchema = {
  components: [
    { key: 'customer' },
    { key: 'tags', valuesKey: 'tagOptions' },
  ],
};

describe('toFormData', () => {
  it('shows dates in local time, parses JSON and expands option lists', () => {
    const due = toEngineDate(new Date(2026, 9, 20, 13, 0, 0));
    expect(
      toFormData(
        {
          customer: { type: 'String', value: 'ACME' },
          due: { type: 'Date', value: due },
          order: { type: 'Json', value: '{"id":7}' },
          tagOptions: { type: 'Json', value: '["red","blue"]' },
        },
        schema,
      ),
    ).toEqual({
      customer: 'ACME',
      due: '2026-10-20T13:00:00',
      order: { id: 7 },
      tagOptions: [
        { label: 'red', value: 'red' },
        { label: 'blue', value: 'blue' },
      ],
    });
  });
});

describe('toSubmitVariables', () => {
  it('sends plain values untyped and objects as JSON of the right type', () => {
    const variables = {
      order: { type: 'Object', value: '{}', valueInfo: { objectTypeName: 'Order', serializationDataFormat: 'application/json' } },
      tagOptions: { type: 'Json', value: '[]' },
    };
    expect(
      toSubmitVariables({ customer: 'Initech', approved: true, order: { id: 7 }, tags: ['red'], extra: { a: 1 } }, variables, schema),
    ).toEqual({
      customer: { value: 'Initech' },
      approved: { value: true },
      order: { type: 'Object', valueInfo: variables.order.valueInfo, value: '{"id":7}' },
      tags: { type: 'Json', valueInfo: undefined, value: '["red"]' },
      extra: { type: 'Json', valueInfo: undefined, value: '{"a":1}' },
    });
  });
});
