import { useEffect, useRef, useState } from 'react';
import { InlineNotification } from '@carbon/react';
import { migrateDiagram } from '@bpmn-io/dmn-migrate';
import Viewer from 'dmn-js/lib/Viewer';
import 'dmn-js/dist/assets/diagram-js.css';
import 'dmn-js/dist/assets/dmn-js-shared.css';
import 'dmn-js/dist/assets/dmn-js-drd.css';
import 'dmn-js/dist/assets/dmn-js-decision-table.css';
import 'dmn-js/dist/assets/dmn-js-literal-expression.css';
import 'dmn-js/dist/assets/dmn-js-boxed-expression.css';
import 'dmn-js/dist/assets/dmn-font/css/dmn.css';
import './dmn-viewer.scss';

/** A value an evaluation used or produced, shown next to its column (or cell) of the decision table. */
export interface DmnValue {
  /** the input or output clause id */
  columnId: string;
  /** outputs: the rule that produced the value */
  ruleId?: string;
  text: string;
  /** a value that is not shown (e.g. an object): its text names the type, the title explains */
  hidden?: boolean;
  title?: string;
}

interface DmnViewerProps {
  xml: string;
  /** id (or name) of the decision to open, alone (no way to its DRD); without it, the DRD */
  decision?: string;
  /** rules that fired, highlighted */
  rules?: string[];
  inputs?: DmnValue[];
  outputs?: DmnValue[];
}

// Older definitions name the DMN 1.1 namespace dmn11.xsd, which the migration does not know.
const fixNamespace = (xml: string) =>
  xml.replace('xmlns="http://www.omg.org/spec/DMN/20151101/dmn11.xsd"', 'xmlns="http://www.omg.org/spec/DMN/20151101/dmn.xsd"');

/** A viewer without the DRD view, so a decision cannot be left for its requirements diagram. */
class DecisionViewer extends Viewer {
  protected _getViewProviders() {
    return super._getViewProviders().filter((provider) => provider.id !== 'drd');
  }
}

function valueElement(value: DmnValue, className: string) {
  const span = document.createElement('span');
  span.className = value.hidden ? `${className} ${className}--hidden` : className;
  span.textContent = ` = ${value.text}`;
  if (value.title) {
    span.title = value.title;
  }
  return span;
}

/**
 * Read-only DMN decision (decision table, literal expression) or DRD
 * (dmn-js); DMN 1.1 and 1.2 are migrated to 1.3 first. On a decision table
 * the fired rules are highlighted and the input and output values shown.
 * Load it lazily: dmn-js is large.
 */
export default function DmnViewer({ xml, decision, rules = [], inputs = [], outputs = [] }: DmnViewerProps) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState(0);

  useEffect(() => {
    const viewer = decision ? new DecisionViewer({ container: container.current! }) : new Viewer({ container: container.current! });
    let active = true;
    setError(null);
    migrateDiagram(fixNamespace(xml))
      .then((dmn13) => viewer.importXML(dmn13))
      .then(() => {
        const view = decision ? viewer.getViews().find((candidate) => candidate.element.id === decision || candidate.element.name === decision) : undefined;
        return view ? viewer.open(view) : undefined;
      })
      .then(() => active && setOpened((count) => count + 1))
      .catch((failure: Error) => active && setError(failure.message));
    return () => {
      active = false;
      viewer.destroy();
    };
  }, [xml, decision]);

  // values and highlights are added to the rendered table (dmn-js offers no API for them)
  useEffect(() => {
    const root = container.current;
    if (!root || !opened) {
      return;
    }
    const added: Element[] = [];
    const highlighted: Element[] = [];
    for (const input of inputs) {
      const clause = root.querySelector(`th[data-col-id="${CSS.escape(input.columnId)}"] .clause`);
      if (clause) {
        added.push(clause.appendChild(valueElement(input, 'cz-dmn-input')));
      }
    }
    for (const output of outputs) {
      // a literal expression has no cells; outputs without a rule have none either
      const cell = output.ruleId
        ? root.querySelector(`td.output-cell[data-col-id="${CSS.escape(output.columnId)}"][data-row-id="${CSS.escape(output.ruleId)}"]`)
        : null;
      if (cell) {
        added.push(cell.appendChild(valueElement(output, 'cz-dmn-output')));
      }
    }
    for (const rule of rules) {
      const row = root.querySelector(`[data-row-id="${CSS.escape(rule)}"]`)?.closest('tr');
      if (row) {
        row.classList.add('cz-dmn-fired');
        highlighted.push(row);
      }
    }
    return () => {
      added.forEach((element) => element.remove());
      highlighted.forEach((row) => row.classList.remove('cz-dmn-fired'));
    };
  }, [opened, rules.join(','), JSON.stringify(inputs), JSON.stringify(outputs)]);

  return (
    <>
      {error && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={error} />}
      <div ref={container} className="cz-dmn-viewer" />
    </>
  );
}
