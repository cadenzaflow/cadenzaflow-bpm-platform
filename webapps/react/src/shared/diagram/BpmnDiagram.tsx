import { useEffect, useRef, useState } from 'react';
import { InlineNotification } from '@carbon/react';
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import './bpmn-diagram.scss';

interface BpmnDiagramProps {
  xml: string;
  /** Ids of BPMN elements to highlight; the view scrolls to the first. */
  highlight?: string[];
}

/** Read-only BPMN diagram with pan and zoom (bpmn-js). Load it lazily: bpmn-js is large. */
export default function BpmnDiagram({ xml, highlight = [] }: BpmnDiagramProps) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const highlightKey = highlight.join(',');

  useEffect(() => {
    const viewer = new NavigatedViewer({ container: container.current! });
    let active = true;
    setError(null);
    viewer
      .importXML(xml)
      .then(() => {
        if (!active) {
          return;
        }
        const canvas = viewer.get('canvas') as {
          zoom: (level: string) => void;
          addMarker: (id: string, marker: string) => void;
          scrollToElement: (element: unknown) => void;
        };
        const registry = viewer.get('elementRegistry') as { get: (id: string) => unknown };
        canvas.zoom('fit-viewport');
        const elements = highlightKey
          .split(',')
          .filter(Boolean)
          .map((id) => registry.get(id))
          .filter(Boolean);
        elements.forEach((element) => canvas.addMarker((element as { id: string }).id, 'cz-highlight'));
        if (elements[0]) {
          canvas.scrollToElement(elements[0]);
        }
      })
      .catch((failure: Error) => active && setError(failure.message));
    return () => {
      active = false;
      viewer.destroy();
    };
  }, [xml, highlightKey]);

  return (
    <>
      {error && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={error} />}
      <div ref={container} className="cz-bpmn-diagram" />
    </>
  );
}
