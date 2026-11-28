/**
 * The processes, the form and the decision of the tests. They are deployed
 * once per engine (the engine skips resources it has already), so the tests
 * can run again on the same engine.
 */
const BPMN = 'xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:camunda="http://camunda.org/schema/1.0/bpmn" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" targetNamespace="e2e"';

/**
 * A drawing for the elements of a process, so the pages have a diagram to
 * show: the nodes of the first row from left to right; a node of the second
 * row sits below the node named as its column. Flows run along the row, or
 * down from their source and then right to their target.
 */
type Node = [id: string, kind: 'event' | 'task' | 'gateway', below?: string];

function diagram(processId: string, nodes: Node[], flows: [id: string, from: string, to: string][]): string {
  const size = { event: [36, 36], task: [100, 80], gateway: [50, 50] } as const;
  const boxes = new Map<string, { x: number; y: number; width: number; height: number }>();
  let x = 150;
  for (const [id, kind, below] of nodes) {
    const [width, height] = size[kind];
    if (below) {
      const column = boxes.get(below)!;
      boxes.set(id, { x: column.x + (column.width - width) / 2, y: 260 - height / 2, width, height });
    } else {
      boxes.set(id, { x, y: 120 - height / 2, width, height });
      x += width + 60;
    }
  }
  const shapes = nodes
    .map(([id]) => {
      const box = boxes.get(id)!;
      return `<bpmndi:BPMNShape id="${id}_di" bpmnElement="${id}"><dc:Bounds x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" /></bpmndi:BPMNShape>`;
    })
    .join('');
  const edges = flows
    .map(([id, from, to]) => {
      const source = boxes.get(from)!;
      const target = boxes.get(to)!;
      const sourceY = source.y + source.height / 2;
      const targetY = target.y + target.height / 2;
      const waypoints =
        sourceY === targetY
          ? [[source.x + source.width, sourceY], [target.x, targetY]]
          : [[source.x + source.width / 2, source.y + source.height], [source.x + source.width / 2, targetY], [target.x, targetY]];
      return `<bpmndi:BPMNEdge id="${id}_di" bpmnElement="${id}">${waypoints.map(([wx, wy]) => `<di:waypoint x="${wx}" y="${wy}" />`).join('')}</bpmndi:BPMNEdge>`;
    })
    .join('');
  return `<bpmndi:BPMNDiagram id="${processId}_diagram" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI"><bpmndi:BPMNPlane id="${processId}_plane" bpmnElement="${processId}">${shapes}${edges}</bpmndi:BPMNPlane></bpmndi:BPMNDiagram>`;
}

/**
 * e2e-order: a user task with a Camunda Form, then an external task when
 * the order was approved.
 */
const order = `<?xml version="1.0" encoding="UTF-8"?>
<definitions ${BPMN}>
  <process id="e2e-order" name="E2E Order" isExecutable="true" camunda:historyTimeToLive="5">
    <startEvent id="ordered" name="Ordered" />
    <sequenceFlow id="toCheck" sourceRef="ordered" targetRef="check" />
    <userTask id="check" name="Check order" camunda:formRef="e2e-order-form" camunda:formRefBinding="latest" camunda:candidateGroups="sales" />
    <sequenceFlow id="toDecision" sourceRef="check" targetRef="approved" />
    <exclusiveGateway id="approved" name="Approved?" default="toRejected" />
    <sequenceFlow id="toShip" sourceRef="approved" targetRef="ship">
      <conditionExpression xsi:type="tFormalExpression">\${approved == true}</conditionExpression>
    </sequenceFlow>
    <sequenceFlow id="toRejected" sourceRef="approved" targetRef="rejected" />
    <serviceTask id="ship" name="Ship order" camunda:type="external" camunda:topic="e2e-ship" />
    <sequenceFlow id="toShipped" sourceRef="ship" targetRef="shipped" />
    <endEvent id="shipped" name="Shipped" />
    <endEvent id="rejected" name="Rejected" />
  </process>
  ${diagram(
    'e2e-order',
    [['ordered', 'event'], ['check', 'task'], ['approved', 'gateway'], ['ship', 'task'], ['shipped', 'event'], ['rejected', 'event', 'ship']],
    [['toCheck', 'ordered', 'check'], ['toDecision', 'check', 'approved'], ['toShip', 'approved', 'ship'], ['toShipped', 'ship', 'shipped'], ['toRejected', 'approved', 'rejected']],
  )}
</definitions>`;

/** The Camunda Form of "Check order". */
const orderForm = JSON.stringify({
  type: 'default',
  id: 'e2e-order-form',
  schemaVersion: 16,
  components: [
    { type: 'textfield', id: 'customerField', key: 'customer', label: 'Customer', validate: { required: true } },
    { type: 'number', id: 'amountField', key: 'amount', label: 'Amount' },
    { type: 'checkbox', id: 'approvedField', key: 'approved', label: 'Approved' },
  ],
});

/** e2e-plain: a user task without a form (the generic form), started with a generic start form. */
const plain = `<?xml version="1.0" encoding="UTF-8"?>
<definitions ${BPMN}>
  <process id="e2e-plain" name="E2E Plain" isExecutable="true" camunda:historyTimeToLive="5">
    <startEvent id="begun" />
    <sequenceFlow id="toReview" sourceRef="begun" targetRef="review" />
    <userTask id="review" name="Review request" />
    <sequenceFlow id="toDone" sourceRef="review" targetRef="done" />
    <endEvent id="done" />
  </process>
  ${diagram('e2e-plain', [['begun', 'event'], ['review', 'task'], ['done', 'event']], [['toReview', 'begun', 'review'], ['toDone', 'review', 'done']])}
</definitions>`;

/** e2e-wait: waits at a timer that is due in ten years, so it has a job that never runs by itself. */
const wait = `<?xml version="1.0" encoding="UTF-8"?>
<definitions ${BPMN}>
  <process id="e2e-wait" name="E2E Wait" isExecutable="true" camunda:historyTimeToLive="5">
    <startEvent id="begun" />
    <sequenceFlow id="toTimer" sourceRef="begun" targetRef="later" />
    <intermediateCatchEvent id="later" name="Much later">
      <timerEventDefinition><timeDuration xsi:type="tFormalExpression">P10Y</timeDuration></timerEventDefinition>
    </intermediateCatchEvent>
    <sequenceFlow id="toDone" sourceRef="later" targetRef="done" />
    <endEvent id="done" />
  </process>
  ${diagram('e2e-wait', [['begun', 'event'], ['later', 'event'], ['done', 'event']], [['toTimer', 'begun', 'later'], ['toDone', 'later', 'done']])}
</definitions>`;

/**
 * e2e-failing: waits at a timer like e2e-wait; when the timer job is run, the
 * service task after it fails (there is no such bean), so the job has an
 * exception to show.
 */
const failing = `<?xml version="1.0" encoding="UTF-8"?>
<definitions ${BPMN}>
  <process id="e2e-failing" name="E2E Failing" isExecutable="true" camunda:historyTimeToLive="5">
    <startEvent id="begun" />
    <sequenceFlow id="toTimer" sourceRef="begun" targetRef="later" />
    <intermediateCatchEvent id="later" name="Much later">
      <timerEventDefinition><timeDuration xsi:type="tFormalExpression">P10Y</timeDuration></timerEventDefinition>
    </intermediateCatchEvent>
    <sequenceFlow id="toWork" sourceRef="later" targetRef="work" />
    <serviceTask id="work" name="Work that fails" camunda:expression="\${e2eBeanThatDoesNotExist.run()}" />
    <sequenceFlow id="toDone" sourceRef="work" targetRef="done" />
    <endEvent id="done" />
  </process>
  ${diagram('e2e-failing', [['begun', 'event'], ['later', 'event'], ['work', 'task'], ['done', 'event']], [['toTimer', 'begun', 'later'], ['toWork', 'later', 'work'], ['toDone', 'work', 'done']])}
</definitions>`;

/** e2e-parent: calls e2e-plain. */
const parent = `<?xml version="1.0" encoding="UTF-8"?>
<definitions ${BPMN}>
  <process id="e2e-parent" name="E2E Parent" isExecutable="true" camunda:historyTimeToLive="5">
    <startEvent id="begun" />
    <sequenceFlow id="toCall" sourceRef="begun" targetRef="call" />
    <callActivity id="call" name="Review it" calledElement="e2e-plain" />
    <sequenceFlow id="toDone" sourceRef="call" targetRef="done" />
    <endEvent id="done" />
  </process>
  ${diagram('e2e-parent', [['begun', 'event'], ['call', 'task'], ['done', 'event']], [['toCall', 'begun', 'call'], ['toDone', 'call', 'done']])}
</definitions>`;

/** e2e-discount: a decision table, the discount for an amount. */
const discount = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" xmlns:camunda="http://camunda.org/schema/1.0/dmn" id="e2e-decisions" name="E2E Decisions" namespace="e2e">
  <decision id="e2e-discount" name="E2E Discount" camunda:historyTimeToLive="5">
    <decisionTable id="discountTable" hitPolicy="FIRST">
      <input id="amountInput" label="Order amount">
        <inputExpression id="amountExpression" typeRef="double"><text>amount</text></inputExpression>
      </input>
      <output id="discountOutput" label="Discount in percent" name="discount" typeRef="integer" />
      <rule id="largeOrder">
        <inputEntry id="largeOrderInput"><text>&gt;= 1000</text></inputEntry>
        <outputEntry id="largeOrderOutput"><text>10</text></outputEntry>
      </rule>
      <rule id="smallOrder">
        <inputEntry id="smallOrderInput"><text>&lt; 1000</text></inputEntry>
        <outputEntry id="smallOrderOutput"><text>0</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`;

export const DEPLOYMENT_NAME = 'e2e';

export const RESOURCES: Record<string, string> = {
  'e2e-order.bpmn': order,
  'e2e-order.form': orderForm,
  'e2e-plain.bpmn': plain,
  'e2e-wait.bpmn': wait,
  'e2e-failing.bpmn': failing,
  'e2e-parent.bpmn': parent,
  'e2e-discount.dmn': discount,
};
