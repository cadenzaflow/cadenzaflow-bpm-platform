import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import DmnViewer from './DmnViewer';

afterEach(cleanup);

/** A decision table (DMN 1.1, as older deployments have it) with one input, one output and two rules. */
const dmn = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/DMN/20151101/dmn11.xsd" id="invoiceBusinessDecisions" name="Invoice Business Decisions" namespace="test">
  <decision id="invoiceClassification" name="Invoice Classification">
    <decisionTable id="table" hitPolicy="FIRST">
      <input id="amountInput" label="Invoice Amount">
        <inputExpression id="amountExpression" typeRef="double"><text>amount</text></inputExpression>
      </input>
      <output id="classificationOutput" label="Classification" name="invoiceClassification" typeRef="string" />
      <rule id="cheap">
        <inputEntry id="cheapIn"><text>&lt; 250</text></inputEntry>
        <outputEntry id="cheapOut"><text>"day-to-day expense"</text></outputEntry>
      </rule>
      <rule id="expensive">
        <inputEntry id="expensiveIn"><text>&gt;= 250</text></inputEntry>
        <outputEntry id="expensiveOut"><text>"budget"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
  <decision id="approver" name="Approver">
    <informationRequirement><requiredDecision href="#invoiceClassification" /></informationRequirement>
    <literalExpression id="approverExpression"><text>"accounting"</text></literalExpression>
  </decision>
</definitions>`;

describe('the DMN viewer', () => {
  it('shows the decision table of a decision', async () => {
    const { container } = render(<DmnViewer xml={dmn} decision="invoiceClassification" />);

    // dmn-js renders the table anew once it is opened: look at what stays
    await waitFor(() => expect(screen.getByText('Invoice Amount')).toBeInTheDocument());
    expect(screen.getByText('Classification')).toBeInTheDocument();
    expect(screen.getByText('"day-to-day expense"')).toBeInTheDocument();
    expect(screen.getByText('"budget"')).toBeInTheDocument();
    // alone: the decision cannot be left for the requirements diagram
    expect(container.querySelector('.view-drd-button')).toBeNull();
  });

  it('marks the rule that fired and shows the values of the evaluation', async () => {
    const { container } = render(
      <DmnViewer
        xml={dmn}
        decision="invoiceClassification"
        rules={['expensive']}
        inputs={[{ columnId: 'amountInput', text: '900' }]}
        outputs={[
          { columnId: 'classificationOutput', ruleId: 'expensive', text: 'budget' },
          { columnId: 'classificationOutput', ruleId: 'expensive', text: 'Object', hidden: true, title: 'not shown' },
        ]}
      />,
    );

    await waitFor(() => expect(container.querySelector('.cz-dmn-fired')).not.toBeNull());
    const fired = container.querySelectorAll('tr.cz-dmn-fired');
    expect(fired).toHaveLength(1);
    expect(fired[0]).toHaveTextContent('>= 250');
    expect(container.querySelector('.cz-dmn-input')).toHaveTextContent('= 900');
    const outputs = container.querySelectorAll('.cz-dmn-output');
    expect(outputs[0]).toHaveTextContent('= budget');
    expect(outputs[1]).toHaveClass('cz-dmn-output--hidden');
    expect(outputs[1]).toHaveAttribute('title', 'not shown');
  });

  it('takes the values and the mark away when another evaluation is shown', async () => {
    const { container, rerender } = render(
      <DmnViewer xml={dmn} decision="invoiceClassification" rules={['expensive']} inputs={[{ columnId: 'amountInput', text: '900' }]} />,
    );
    await waitFor(() => expect(container.querySelector('.cz-dmn-fired')).not.toBeNull());

    rerender(<DmnViewer xml={dmn} decision="invoiceClassification" rules={['cheap']} inputs={[{ columnId: 'amountInput', text: '30' }]} />);

    await waitFor(() => expect(container.querySelector('tr.cz-dmn-fired')).toHaveTextContent('< 250'));
    expect(container.querySelectorAll('tr.cz-dmn-fired')).toHaveLength(1);
    expect(container.querySelectorAll('.cz-dmn-input')).toHaveLength(1);
    expect(container.querySelector('.cz-dmn-input')).toHaveTextContent('= 30');
  });

  it('opens a decision by its name too, and shows a literal expression', async () => {
    render(<DmnViewer xml={dmn} decision="Approver" />);

    expect(await screen.findByText('"accounting"')).toBeInTheDocument();
  });

  it('says what is wrong with XML that is not DMN', async () => {
    const { container } = render(<DmnViewer xml="<definitions" decision="invoiceClassification" />);

    await waitFor(() => expect(container.querySelector('.cds--inline-notification')).not.toBeNull());
  });
});
