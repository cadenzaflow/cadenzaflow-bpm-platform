import { describe, expect, it } from 'vitest';
import { activityBadges, activityInstanceOfExecution, instancesOf, treeIdOf, treeSelection, type ActivityInstance } from './api';

/** A process instance with a multi-instance task (two instances, one incident) and a waiting async continuation. */
const root: ActivityInstance = {
  id: 'pi-1',
  activityId: 'order:1',
  activityName: 'Order',
  activityType: 'processDefinition',
  executionIds: ['pi-1'],
  childActivityInstances: [
    {
      id: 'check#multiInstanceBody:a1',
      activityId: 'check#multiInstanceBody',
      activityName: 'Check',
      activityType: 'multiInstanceBody',
      childActivityInstances: [
        { id: 'check:a2', activityId: 'check', activityName: 'Check', activityType: 'userTask', executionIds: ['ex-2'] },
        { id: 'check:a3', activityId: 'check', activityName: 'Check', activityType: 'userTask', incidents: [{ id: 'i1', activityId: 'check' }] },
      ],
    },
  ],
  childTransitionInstances: [{ id: 'pi-1', executionId: 'pi-1', activityId: 'ship', activityName: 'Ship', activityType: 'serviceTask' }],
};

describe('activity instance tree', () => {
  it('counts the instances and incidents per activity, a multi-instance body with its activity', () => {
    expect(activityBadges(root)).toEqual({ check: { count: 2, incidents: 1 }, ship: { count: 1, incidents: 0 } });
  });

  it('finds the instances of activities, with the multi-instance body', () => {
    expect(instancesOf(root, ['check'])).toEqual(['check#multiInstanceBody:a1', 'check:a2', 'check:a3']);
    expect(instancesOf(root, ['ship'])).toEqual(['pi-1']);
  });

  it('keeps a transition instance apart from the process instance with the same id', () => {
    expect(treeIdOf(root)).toBe('pi-1');
    expect(treeSelection(root, [], [])).toEqual(['pi-1']);
    expect(treeSelection(root, ['ship'], ['pi-1'])).toEqual(['transition:pi-1']);
    expect(treeSelection(root, ['check'], ['check:a2'])).toEqual(['check:a2']);
  });

  it('finds the innermost activity instance of an execution', () => {
    const executions = activityInstanceOfExecution(root);
    expect(executions.get('ex-2')).toBe('check:a2');
    // the async continuation waits in the process instance's own execution
    expect(executions.get('pi-1')).toBe('pi-1');
  });
});
