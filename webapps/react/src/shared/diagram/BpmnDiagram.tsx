import { useEffect, useRef, useState } from 'react';
import { InlineNotification } from '@carbon/react';
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import './bpmn-diagram.scss';

/** Numbers shown on an element, e.g. running instances and open incidents of an activity. */
export interface DiagramBadge {
  count?: number;
  incidents?: number;
}

interface BpmnDiagramProps {
  xml: string;
  /** Ids of BPMN elements to highlight; the view scrolls to the first. */
  highlight?: string[];
  /** Ids of selected elements (marked; e.g. a filter of the instance list). */
  selected?: string[];
  badges?: Record<string, DiagramBadge>;
  /** A flow node was clicked; `add` when Ctrl/Cmd was held (add to the selection). An empty id: the background. */
  onElementClick?: (id: string, add: boolean) => void;
  /** Labels of the badges, for screen readers and tooltips. */
  badgeLabels?: { count: string; incidents: string };
  /** The diagram was imported: e.g. diagram plugins get the viewer. Returns what to do when it goes away. */
  onViewer?: (viewer: NavigatedViewer) => (() => void) | void;
}

interface Canvas {
  zoom: (level: string) => void;
  addMarker: (id: string, marker: string) => void;
  removeMarker: (id: string, marker: string) => void;
  scrollToElement: (element: unknown) => void;
}
interface Overlays {
  add: (id: string, type: string, overlay: { position: Record<string, number>; html: HTMLElement }) => void;
  remove: (filter: { type: string }) => void;
}
interface Registry {
  get: (id: string) => unknown;
}
interface DiagramElement {
  id: string;
  type: string;
  businessObject?: { $instanceOf?: (type: string) => boolean };
}

const isFlowNode = (element: DiagramElement) => !!element.businessObject?.$instanceOf?.('bpmn:FlowNode');

function badgeElement(badge: DiagramBadge, labels?: { count: string; incidents: string }) {
  const html = document.createElement('div');
  html.className = 'cz-diagram-badge';
  const add = (value: number | undefined, className: string, label: string | undefined) => {
    if (!value) {
      return;
    }
    const part = document.createElement('span');
    part.className = className;
    part.textContent = value.toLocaleString();
    if (label) {
      part.title = `${label}: ${value.toLocaleString()}`;
    }
    html.appendChild(part);
  };
  add(badge.count, 'cz-diagram-badge__count', labels?.count);
  add(badge.incidents, 'cz-diagram-badge__incidents', labels?.incidents);
  return html;
}

/** Read-only BPMN diagram with pan and zoom (bpmn-js). Load it lazily: bpmn-js is large. */
export default function BpmnDiagram({ xml, highlight = [], selected = [], badges, onElementClick, badgeLabels, onViewer }: BpmnDiagramProps) {
  const container = useRef<HTMLDivElement>(null);
  const viewer = useRef<NavigatedViewer | null>(null);
  const clickHandler = useRef(onElementClick);
  const viewerHandler = useRef(onViewer);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState(0);
  const highlightKey = highlight.join(',');
  const selectedKey = selected.join(',');

  useEffect(() => {
    clickHandler.current = onElementClick;
    viewerHandler.current = onViewer;
  });

  // import the diagram; markers and badges follow in the effect below
  useEffect(() => {
    const instance = new NavigatedViewer({ container: container.current! });
    viewer.current = instance;
    let active = true;
    let release: (() => void) | void;
    setError(null);
    (instance.get('eventBus') as { on: (event: string, handler: (event: { element: DiagramElement; originalEvent?: MouseEvent }) => void) => void }).on(
      'element.click',
      ({ element, originalEvent }) => {
        const add = !!(originalEvent?.ctrlKey || originalEvent?.metaKey);
        clickHandler.current?.(isFlowNode(element) ? element.id : '', add);
      },
    );
    instance
      .importXML(xml)
      .then(() => {
        if (active) {
          (instance.get('canvas') as Canvas).zoom('fit-viewport');
          setImported((count) => count + 1);
          release = viewerHandler.current?.(instance);
        }
      })
      .catch((failure: Error) => active && setError(failure.message));
    return () => {
      active = false;
      release?.();
      viewer.current = null;
      instance.destroy();
    };
  }, [xml]);

  useEffect(() => {
    const instance = viewer.current;
    if (!instance || !imported) {
      return;
    }
    const canvas = instance.get('canvas') as Canvas;
    const registry = instance.get('elementRegistry') as Registry;
    const overlays = instance.get('overlays') as Overlays;
    const existing = (ids: string) => ids.split(',').filter((id) => id && registry.get(id));

    const highlighted = existing(highlightKey);
    highlighted.forEach((id) => canvas.addMarker(id, 'cz-highlight'));
    const marked = existing(selectedKey);
    marked.forEach((id) => canvas.addMarker(id, 'cz-selected'));
    if (highlighted[0]) {
      canvas.scrollToElement(registry.get(highlighted[0]));
    }

    overlays.remove({ type: 'cz-badge' });
    for (const [id, badge] of Object.entries(badges ?? {})) {
      if (registry.get(id) && (badge.count || badge.incidents)) {
        overlays.add(id, 'cz-badge', { position: { bottom: 8, left: -8 }, html: badgeElement(badge, badgeLabels) });
      }
    }
    return () => {
      highlighted.forEach((id) => canvas.removeMarker(id, 'cz-highlight'));
      marked.forEach((id) => canvas.removeMarker(id, 'cz-selected'));
    };
  }, [imported, highlightKey, selectedKey, badges, badgeLabels]);

  return (
    <>
      {error && <InlineNotification kind="error" lowContrast hideCloseButton subtitle={error} />}
      <div ref={container} className={`cz-bpmn-diagram${onElementClick ? ' cz-bpmn-diagram--selectable' : ''}`} />
    </>
  );
}
