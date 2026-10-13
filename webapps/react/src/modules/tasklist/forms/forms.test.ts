import { describe, expect, it } from 'vitest';
import { externalFormUrl, resolveForm, type FormInfo } from './form-key';
import { rowErrors, toVariables } from './GenericForm';
import type { FormTarget } from './target';

const task: FormTarget = { kind: 'task', taskId: 't1', processInstanceId: 'pi1' };
const start: FormTarget = { kind: 'start', processDefinitionId: 'invoice:2', processDefinitionKey: 'invoice' };

const form = (key: string | null, extra: Partial<FormInfo> = {}): FormInfo => ({
  key,
  contextPath: null,
  camundaFormRef: null,
  ...extra,
});
const deployedForm = '/api/engine/engine/default/task/t1/deployed-form';

describe('resolveTaskForm', () => {
  it('uses the generic form without form key', () => {
    expect(resolveForm(form(null), 'default', task)).toEqual({ type: 'generic' });
  });

  it('loads Camunda Forms referenced by the task from the deployment', () => {
    expect(resolveForm(form(null, { camundaFormRef: { key: 'f' } }), 'default', task)).toEqual({
      type: 'camunda-forms',
      url: deployedForm,
    });
    expect(resolveForm(form('camunda-forms:deployment:a.form'), 'default', task)).toEqual({
      type: 'camunda-forms',
      url: deployedForm,
    });
  });

  it('resolves embedded forms of the process application and of the deployment', () => {
    expect(resolveForm(form('embedded:app:forms/a.html', { contextPath: '/invoice/' }), 'default', task)).toEqual({
      type: 'embedded',
      url: '/invoice/forms/a.html',
    });
    expect(resolveForm(form('embedded:deployment:a.html'), 'default', task)).toEqual({
      type: 'embedded',
      url: deployedForm,
    });
    expect(resolveForm(form('embedded:/forms/a.html'), 'default', task)).toEqual({
      type: 'embedded',
      url: '/forms/a.html',
    });
  });

  it('fails for app: keys without context path', () => {
    expect(resolveForm(form('embedded:app:a.html'), 'default', task)).toEqual({
      type: 'error',
      message: 'EMPTY_CONTEXT_PATH',
    });
  });

  it('treats other keys as external forms', () => {
    expect(resolveForm(form('https://forms.example.org/review'), 'default', task)).toEqual({
      type: 'external',
      url: 'https://forms.example.org/review',
    });
  });
});

describe('start forms', () => {
  it('load deployed start forms from the process definition', () => {
    expect(resolveForm(form('embedded:deployment:start.html'), 'default', start)).toEqual({
      type: 'embedded',
      url: '/api/engine/engine/default/process-definition/invoice%3A2/deployed-start-form',
    });
  });
});

describe('externalFormUrl', () => {
  it('adds task id and callback URL to the form URL', () => {
    expect(externalFormUrl('https://x.org/f?lang=de', task, 'http://h/app/tasklist/default/')).toBe(
      'https://x.org/f?lang=de&taskId=t1&callbackUrl=http%3A%2F%2Fh%2Fapp%2Ftasklist%2Fdefault%2F',
    );
    expect(externalFormUrl('/forms/f.html', task, 'cb', 'http://host/app/')).toBe(
      'http://host/forms/f.html?taskId=t1&callbackUrl=cb',
    );
  });

  it('passes the process definition key for start forms', () => {
    expect(externalFormUrl('/forms/start.html', start, 'cb', 'http://host/app/')).toBe(
      'http://host/forms/start.html?processDefinitionKey=invoice&callbackUrl=cb',
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
