import { describe, expect, it } from 'vitest';
import { externalFormUrl, resolveTaskForm, type FormInfo } from './form-key';
import { rowErrors, toVariables } from './GenericForm';

const form = (key: string | null, extra: Partial<FormInfo> = {}): FormInfo => ({
  key,
  contextPath: null,
  camundaFormRef: null,
  ...extra,
});
const deployedForm = '/api/engine/engine/default/task/t1/deployed-form';

describe('resolveTaskForm', () => {
  it('uses the generic form without form key', () => {
    expect(resolveTaskForm(form(null), 'default', 't1')).toEqual({ type: 'generic' });
  });

  it('loads Camunda Forms referenced by the task from the deployment', () => {
    expect(resolveTaskForm(form(null, { camundaFormRef: { key: 'f' } }), 'default', 't1')).toEqual({
      type: 'camunda-forms',
      url: deployedForm,
    });
    expect(resolveTaskForm(form('camunda-forms:deployment:a.form'), 'default', 't1')).toEqual({
      type: 'camunda-forms',
      url: deployedForm,
    });
  });

  it('resolves embedded forms of the process application and of the deployment', () => {
    expect(resolveTaskForm(form('embedded:app:forms/a.html', { contextPath: '/invoice/' }), 'default', 't1')).toEqual({
      type: 'embedded',
      url: '/invoice/forms/a.html',
    });
    expect(resolveTaskForm(form('embedded:deployment:a.html'), 'default', 't1')).toEqual({
      type: 'embedded',
      url: deployedForm,
    });
    expect(resolveTaskForm(form('embedded:/forms/a.html'), 'default', 't1')).toEqual({
      type: 'embedded',
      url: '/forms/a.html',
    });
  });

  it('fails for app: keys without context path', () => {
    expect(resolveTaskForm(form('embedded:app:a.html'), 'default', 't1')).toEqual({
      type: 'error',
      message: 'EMPTY_CONTEXT_PATH',
    });
  });

  it('treats other keys as external forms', () => {
    expect(resolveTaskForm(form('https://forms.example.org/review'), 'default', 't1')).toEqual({
      type: 'external',
      url: 'https://forms.example.org/review',
    });
  });
});

describe('externalFormUrl', () => {
  it('adds task id and callback URL to the form URL', () => {
    expect(externalFormUrl('https://x.org/f?lang=de', 't1', 'http://h/app/tasklist/default/')).toBe(
      'https://x.org/f?lang=de&taskId=t1&callbackUrl=http%3A%2F%2Fh%2Fapp%2Ftasklist%2Fdefault%2F',
    );
    expect(externalFormUrl('/forms/f.html', 't1', 'cb', 'http://host/app/')).toBe(
      'http://host/forms/f.html?taskId=t1&callbackUrl=cb',
    );
  });
});

describe('generic form rows', () => {
  const row = (name: string, type: string, value: string | boolean) => ({ id: Math.random(), name, type, value });

  it('requires a unique name, a type and a valid value', () => {
    const rows = [row('', '', ''), row('a', 'Integer', 'x'), row('a', 'String', '')];
    expect(rowErrors(rows[0], rows)).toEqual({ name: 'REQUIRED_FIELD', type: 'REQUIRED_FIELD' });
    expect(rowErrors(rows[1], rows)).toEqual({ name: 'REQUIRE_UNIQUE_NAME', value: 'INVALID_VALUE_FOR_TYPE' });
  });

  it('converts rows into typed variables and leaves files out', () => {
    expect(
      toVariables([
        row('count', 'Integer', '42'),
        row('ok', 'Boolean', true),
        { ...row('order', 'Object', '{"a":1}'), valueInfo: { objectTypeName: 'Order' } },
        row('invoice', 'File', ''),
      ]),
    ).toEqual({
      count: { type: 'Integer', value: 42 },
      ok: { type: 'Boolean', value: true },
      order: { type: 'Object', value: '{"a":1}', valueInfo: { objectTypeName: 'Order' } },
    });
  });
});
