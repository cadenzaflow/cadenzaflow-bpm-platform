import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import i18next from 'i18next';
import { initI18n } from '../../../shared/i18n';
import { json, logIn, renderApp } from '../../../test/app';
import type { DecisionDefinition, DecisionInstance } from './api';
import { tableValue } from './DecisionInstancePage';

const ENGINE = '/api/engine/engine/default';

const definition: DecisionDefinition = {
  id: 'approver:2',
  key: 'approver',
  name: 'Assign Approver',
  version: 2,
  versionTag: null,
  tenantId: null,
  deploymentId: 'd-1',
  resource: 'approver.dmn',
  historyTimeToLive: 30,
  decisionRequirementsDefinitionId: null,
};

const evaluation: DecisionInstance = {
  id: 'di-1',
  decisionDefinitionId: 'approver:2',
  decisionDefinitionKey: 'approver',
  decisionDefinitionName: 'Assign Approver',
  evaluationTime: '2026-10-13T12:30:00.000+0000',
  tenantId: null,
  processDefinitionId: 'invoice:2',
  processDefinitionKey: 'invoice',
  processInstanceId: 'pi-1',
  caseDefinitionKey: null,
  caseInstanceId: null,
  activityId: 'assignApprover',
  activityInstanceId: 'assignApprover:1',
  decisionRequirementsDefinitionId: null,
  removalTime: null,
  inputs: [{ id: 'in-1', clauseId: 'category', clauseName: 'Invoice Category', type: 'String', value: 'Travel' }],
  outputs: [
    { id: 'out-1', clauseId: 'group', clauseName: 'Approver Group', ruleId: 'rule-1', variableName: 'group', type: 'String', value: 'accounting' },
  ],
};

function fakeBackend() {
  let loggedIn = false;
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET';
    const [path, queryString] = url.split('?');
    const query = new URLSearchParams(queryString);
    if (path === '/api/admin/auth/user/default') {
      return loggedIn ? json({ userId: 'demo', authorizedApps: ['cockpit'] }) : json({}, 404);
    }
    if (path === '/api/admin/auth/user/default/login/cockpit' && method === 'POST') {
      loggedIn = true;
      return json({ userId: 'demo', authorizedApps: ['cockpit'] });
    }
    if (path === `${ENGINE}/user/demo/profile`) {
      return json({ id: 'demo', firstName: 'Demo', lastName: 'Demo' });
    }
    if (path === `${ENGINE}/decision-definition/count`) {
      return json({ count: 2 });
    }
    if (path === `${ENGINE}/decision-definition` && query.get('latestVersion') === 'true') {
      return json([definition, { ...definition, id: 'size:1', key: 'size', name: null, tenantId: 'tenant-a' }]);
    }
    if (path === `${ENGINE}/decision-definition` && query.get('key') === 'approver') {
      return json([definition, { ...definition, id: 'approver:1', version: 1 }]);
    }
    if (path === `${ENGINE}/decision-definition/approver%3A2`) {
      return json(definition);
    }
    if (path === `${ENGINE}/decision-definition/approver%3A2/xml`) {
      // no DMN rendering in jsdom
      return json({ message: 'no diagram' }, 404);
    }
    if (path === `${ENGINE}/history/decision-instance/count`) {
      return json({ count: 1 });
    }
    if (path === `${ENGINE}/history/decision-instance` && query.get('decisionInstanceId') === 'di-1') {
      return json([evaluation]);
    }
    if (path === `${ENGINE}/history/decision-instance` && query.get('decisionInstanceId') === 'gone') {
      return json([]);
    }
    if (path === `${ENGINE}/history/decision-instance`) {
      return json([evaluation]);
    }
    return json({ message: `unexpected ${method} ${url}` }, 500);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeAll(() => initI18n('en'));
afterEach(() => vi.unstubAllGlobals());

describe('cockpit decisions', () => {
  it('lists the latest decision definitions', async () => {
    fakeBackend();
    renderApp('/app/react/cockpit/default/decisions');
    await logIn();

    expect(await screen.findByRole('link', { name: 'Assign Approver' })).toHaveAttribute(
      'href',
      '/app/react/cockpit/default/decision-definition/approver%3A2',
    );
    // without a name, the key
    expect(screen.getByRole('link', { name: 'size' })).toBeInTheDocument();
    expect(screen.getByText('tenant-a')).toBeInTheDocument();
    expect(screen.getByText('2 decision definitions deployed')).toBeInTheDocument();
  });

  it('shows a decision definition with its evaluations', async () => {
    const fetchMock = fakeBackend();
    renderApp(
      '/app/react/cockpit/default/decision-definition/approver:2?searchQuery=[{"type":"evaluated","operator":"Before","value":"2026-10-14T00:00"}]',
    );
    await logIn();

    expect(await screen.findByLabelText('Definition Version:')).toHaveValue('approver:2');
    const row = within((await screen.findByRole('link', { name: 'di-1' })).closest('tr')!);
    expect(row.getByRole('link', { name: 'invoice' })).toHaveAttribute('href', '/app/react/cockpit/default/process-definition/invoice%3A2');
    expect(row.getByRole('link', { name: 'pi-1' })).toHaveAttribute('href', '/app/react/cockpit/default/process-instance/pi-1');
    const list = fetchMock.mock.calls.find(([url]) => url.startsWith(`${ENGINE}/history/decision-instance?`))?.[0];
    expect(list).toContain('decisionDefinitionId=approver%3A2');
    expect(list).toContain('evaluatedBefore=2026-10-14T00%3A00%3A00.000');
    expect(list).toContain('sortBy=evaluationTime&sortOrder=desc');
  });

  it('shows the inputs and outputs of an evaluation', async () => {
    fakeBackend();
    renderApp('/app/react/cockpit/default/decision-instance/di-1');
    const user = await logIn();

    expect(await screen.findByText('Invoice Category')).toBeInTheDocument();
    expect(screen.getByText('Travel')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Assign Approver' })).toHaveAttribute(
      'href',
      '/app/react/cockpit/default/decision-definition/approver%3A2',
    );
    await user.click(screen.getByRole('tab', { name: 'Outputs' }));
    expect(await screen.findByText('accounting')).toBeVisible();
  });

  it('says when an evaluation does not exist', async () => {
    fakeBackend();
    renderApp('/app/react/cockpit/default/decision-instance/gone');
    await logIn();

    expect(await screen.findByText('No decision instance with ID gone')).toBeInTheDocument();
  });

  it('shows values in the decision table, objects and binaries only by type', () => {
    const t = i18next.getFixedT('en', 'cockpit');
    expect(tableValue({ id: 'v', clauseId: 'c', clauseName: null, type: 'Double', value: 30.5 }, t, 'en')).toEqual({ text: '30.5' });
    expect(tableValue({ id: 'v', clauseId: 'c', clauseName: null, type: 'Null', value: null }, t, 'en')).toEqual({ text: 'null' });
    expect(tableValue({ id: 'v', clauseId: 'c', clauseName: null, type: 'Object', value: 'rO0AB' }, t, 'en')).toEqual({
      text: '[Object]',
      hidden: true,
      title: 'Variable value of type Object is not shown',
    });
  });
});
