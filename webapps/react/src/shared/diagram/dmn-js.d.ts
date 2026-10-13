// dmn-js and @bpmn-io/dmn-migrate ship without type definitions; these are
// the parts the DMN viewer uses.

declare module 'dmn-js/lib/Viewer' {
  export interface DmnView {
    id: string;
    type: string;
    element: { id: string; name?: string };
  }

  export default class Viewer {
    constructor(options: { container: HTMLElement });
    /** the kinds of views (drd, decisionTable, literalExpression, boxedExpression) */
    protected _getViewProviders(): { id: string }[];
    importXML(xml: string): Promise<{ warnings: unknown[] }>;
    getViews(): DmnView[];
    getActiveView(): DmnView | undefined;
    open(view: DmnView): Promise<unknown>;
    destroy(): void;
  }
}

declare module '@bpmn-io/dmn-migrate' {
  /** Converts DMN 1.1 and 1.2 XML to DMN 1.3; DMN 1.3 comes back unchanged. */
  export function migrateDiagram(xml: string): Promise<string>;
}
