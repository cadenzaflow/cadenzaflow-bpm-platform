import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { initI18n } from '../../shared/i18n';
import { json, logIn, renderApp } from '../../test/app';

const ENGINE = '/api/engine/engine/default';
const COCKPIT = '/api/cockpit/plugin/base/default';

// bpmn-js does not draw in jsdom: a diagram that shows the drill-down button of each call activity
vi.mock('../../shared/diagram/BpmnDiagram', () => ({
  default: function FakeDiagram({ xml, drilldown }: { xml: string; drilldown?: (id: string) => { label: string; onClick?: () => void } | undefined }) {
    const callActivities = [...xml.matchAll(/<callActivity id="([^"]+)"/g)].map((match) => match[1]);
    return (
      <div>
        {callActivities.map((id) => {
          const link = drilldown?.(id);
          return (
            link && (
              <button key={id} type="button" aria-label={`${id}: ${link.label}`} disabled={!link.onClick} onClick={link.onClick}>
                {id}
              </button>
            )
          );
        })}
      </div>
    );
  },
}));

/** calls the child in the BPMN, two definitions decided at runtime, and one not resolvable yet */
const XML = `<definitions><process id="parent">
  <callActivity id="callStatic" calledElement="child" />
  <callActivity id="callDynamic" calledElement="\${which}" />
  <callActivity id="callNone" calledElement="\${later}" />
</process></definitions>`;
const parent = { id: 'parent:1', key: 'parent', name: 'Parent', version: 1, deploymentId: 'd1', tenantId: null, suspended: false };
const called = (id: string, activityId: string) => ({ id, key: id.split(':')[0], name: id, version: 1, calledFromActivityIds: [activityId] });

function fakeBackend() {
  let loggedIn = false;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET';
      const [path] = url.split('?');
      if (path === '/api/admin/auth/user/default') {
        return loggedIn ? json({ userId: 'demo', authorizedApps: ['cockpit'] }) : json({}, 404);
      }
      if (path === '/api/admin/auth/user/default/login/cockpit' && method === 'POST') {
        loggedIn = true;
        return json({ userId: 'demo', authorizedApps: ['cockpit'] });
      }
      if (path === `${ENGINE}/process-definition/parent%3A1`) {
        return json(parent);
      }
      if (path === `${ENGINE}/process-definition/parent%3A1/xml`) {
        return json({ id: 'parent:1', bpmn20Xml: XML });
      }
      if (path === `${ENGINE}/process-definition/parent%3A1/static-called-process-definitions`) {
        return json([called('child:1', 'callStatic')]);
      }
      if (path === `${COCKPIT}/process-definition/parent%3A1/called-process-definitions` && method === 'POST') {
        return json([called('a:1', 'callDynamic'), called('b:1', 'callDynamic')]);
      }
      if (path === `${ENGINE}/process-instance/pi-1`) {
        return json({ id: 'pi-1', definitionId: 'parent:1', businessKey: null, suspended: false, ended: false, tenantId: null });
      }
      if (path === `${ENGINE}/process-instance/pi-1/activity-instances`) {
        const instance = (id: string, activityId: string) => ({ id, activityId, activityName: activityId, activityType: 'callActivity', executionIds: [id] });
        return json({
          id: 'pi-1',
          activityId: 'parent:1',
          activityName: 'Parent',
          activityType: 'processDefinition',
          executionIds: ['pi-1'],
          childActivityInstances: [instance('ai-1', 'callStatic'), instance('ai-2', 'callDynamic'), instance('ai-3', 'callDynamic')],
          childTransitionInstances: [],
        });
      }
      if (path === `${COCKPIT}/process-instance/pi-1/called-process-instances` && method === 'POST') {
        const instance = (id: string, callActivityId: string, callActivityInstanceId: string) => ({
          id,
          businessKey: null,
          processDefinitionId: 'child:1',
          processDefinitionKey: 'child',
          processDefinitionName: 'Child',
          callActivityId,
          callActivityInstanceId,
          incidents: [],
        });
        return json([instance('child-pi', 'callStatic', 'ai-1'), instance('a-pi', 'callDynamic', 'ai-2'), instance('b-pi', 'callDynamic', 'ai-3')]);
      }
      // the rest of the pages is not under test
      return json({ message: `not in this test: ${method} ${url}` }, 404);
    }),
  );
}

beforeAll(() => initI18n('en'));
afterEach(() => vi.unstubAllGlobals());

describe('call activities on the diagram', () => {
  it('lead from a process definition to the definition they call', async () => {
    fakeBackend();
    const history = renderApp('/app/react/cockpit/default/process-definition/parent:1');
    const user = await logIn();

    // called in the BPMN: the called definition, coming from this one
    await user.click(await screen.findByRole('button', { name: 'callStatic: Show Called Process Definition' }));
    await waitFor(() => expect(decodeURIComponent(history.location.pathname)).toContain('/process-definition/child:1'));
    expect(history.location.search).toContain('parentProcessDefinitionId=parent');

    history.back();
    // calling several definitions right now: the tab lists them
    await user.click(await screen.findByRole('button', { name: 'callDynamic: Show currently called process definitions' }));
    await waitFor(() => expect(history.location.search).toContain('tab=call-process-definitions-table'));
    expect(history.location.search).toContain('activityIds=callDynamic');
    // nothing to show yet
    expect(screen.getByRole('button', { name: 'callNone: Called Process Definition will be resolved at runtime' })).toBeDisabled();
  });

  it('lead from a process instance to the instance they called', async () => {
    fakeBackend();
    const history = renderApp('/app/react/cockpit/default/process-instance/pi-1');
    const user = await logIn();

    // no instance called from callNone: no button
    expect(await screen.findByRole('button', { name: 'callStatic: Show Called Process Instances' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^callNone/ })).not.toBeInTheDocument();

    // called twice: the tab lists both called instances
    await user.click(screen.getByRole('button', { name: 'callDynamic: Show Called Process Instances' }));
    await waitFor(() => expect(history.location.search).toContain('tab=called-process-instances-tab'));
    expect(decodeURIComponent(history.location.search)).toContain('activityInstanceIds=ai-2,ai-3');

    // called once: the called instance
    await user.click(screen.getByRole('button', { name: 'callStatic: Show Called Process Instances' }));
    await waitFor(() => expect(history.location.pathname).toContain('/process-instance/child-pi'));
  });
});
