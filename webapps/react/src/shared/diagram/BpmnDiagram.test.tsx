import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import BpmnDiagram from './BpmnDiagram';

// bpmn-js does not draw in jsdom: a viewer with one activity, 'ship', that puts its overlays into the container
vi.mock('bpmn-js/lib/NavigatedViewer', () => ({
  default: class FakeViewer {
    private readonly container: HTMLElement;
    private readonly handlers: Record<string, (event: unknown) => void> = {};

    constructor({ container }: { container: HTMLElement }) {
      this.container = container;
    }

    importXML() {
      return Promise.resolve({ warnings: [] });
    }

    destroy() {}

    get(service: string) {
      const container = this.container;
      const handlers = this.handlers;
      const services: Record<string, unknown> = {
        eventBus: { on: (event: string, handler: (event: unknown) => void) => (handlers[event] = handler) },
        canvas: { zoom() {}, addMarker() {}, removeMarker() {}, scrollToElement() {} },
        elementRegistry: { get: (id: string) => (id === 'ship' ? { id } : undefined), filter: () => [] },
        overlays: {
          add: (id: string, type: string, { html }: { html: HTMLElement }) => {
            html.dataset.overlay = type;
            container.appendChild(html);
          },
          remove: ({ type }: { type: string }) => container.querySelectorAll(`[data-overlay="${type}"]`).forEach((node) => node.remove()),
        },
        // the test clicks the activity through this
        clickActivity: (id: string, ctrlKey: boolean) =>
          handlers['element.click']({ element: { id, businessObject: { $instanceOf: () => true } }, originalEvent: { ctrlKey } }),
      };
      return services[service];
    }
  },
}));

const labels = { count: 'Running Activity Instances', incidents: 'Open Incidents' };

afterEach(cleanup);

describe('the badges of the BPMN diagram', () => {
  it('select their activity when clicked, as a click on the activity does', async () => {
    const onElementClick = vi.fn();
    let viewer: { get: (service: string) => unknown } | undefined;
    render(
      <BpmnDiagram
        xml="<definitions/>"
        badges={{ ship: { count: 1, incidents: 2 } }}
        badgeLabels={labels}
        onElementClick={onElementClick}
        onViewer={(imported) => {
          viewer = imported as never;
        }}
      />,
    );

    fireEvent.click(await screen.findByTitle('Open Incidents: 2'));
    expect(onElementClick).toHaveBeenLastCalledWith('ship', false);
    (viewer!.get('clickActivity') as (id: string, ctrlKey: boolean) => void)('ship', false);
    expect(onElementClick.mock.calls).toEqual([
      ['ship', false],
      ['ship', false],
    ]);
    onElementClick.mockClear();

    // with Ctrl (Cmd on a Mac): add to the selection
    fireEvent.click(screen.getByTitle('Running Activity Instances: 1'), { ctrlKey: true });
    expect(onElementClick).toHaveBeenLastCalledWith('ship', true);
    fireEvent.click(screen.getByTitle('Running Activity Instances: 1'), { metaKey: true });
    expect(onElementClick).toHaveBeenLastCalledWith('ship', true);
    expect(onElementClick).toHaveBeenCalledTimes(2);
  });

  it('call the click handler of the latest render', async () => {
    const first = vi.fn();
    const latest = vi.fn();
    const badges = { ship: { incidents: 1 } };
    const { rerender } = render(<BpmnDiagram xml="<definitions/>" badges={badges} badgeLabels={labels} onElementClick={first} />);
    await screen.findByTitle('Open Incidents: 1');

    rerender(<BpmnDiagram xml="<definitions/>" badges={badges} badgeLabels={labels} onElementClick={latest} />);
    fireEvent.click(screen.getByTitle('Open Incidents: 1'));

    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledWith('ship', false);
  });

  it('only show their numbers in a diagram without a click handler', async () => {
    render(<BpmnDiagram xml="<definitions/>" badges={{ ship: { count: 3 } }} badgeLabels={labels} />);

    fireEvent.click(await screen.findByTitle('Running Activity Instances: 3'));

    expect(screen.getByTitle('Running Activity Instances: 3')).toHaveTextContent('3');
  });
});
