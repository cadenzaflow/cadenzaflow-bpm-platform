import { useQuery } from '@tanstack/react-query';
import { useSettings } from '../classic-settings';
import { appRoot, type ModuleName } from '../config';
import { importPlugin } from '../plugins/import-plugin';

/** What the diagram viewer gets in addition to bpmn-js' own modules. */
export interface BpmnJsExtensions {
  additionalModules: unknown[];
  moddleExtensions: Record<string, unknown>;
}

export const NO_EXTENSIONS: BpmnJsExtensions = { additionalModules: [], moddleExtensions: {} };

const withSuffix = (path: string, suffix: string) => (path.endsWith(suffix) ? path : path + suffix);

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Loads the bpmn-js modules (ES modules whose default export is the module)
 * and the moddle extensions (JSON) the classic config.js lists under bpmnJs,
 * relative to app/{module}/ as in the classic webapps. One that fails to load
 * is left out (and logged); the diagram still opens.
 */
export async function loadBpmnJsExtensions(
  module: ModuleName,
  bpmnJs: { additionalModules: string[]; moddleExtensions: Record<string, string> },
  importModule: (url: string) => Promise<{ default?: unknown }> = importPlugin,
  loadJson: (url: string) => Promise<unknown> = fetchJson,
): Promise<BpmnJsExtensions> {
  const base = `${appRoot}/app/${module}/`;
  const modules = await Promise.all(
    bpmnJs.additionalModules.map(async (path) => {
      try {
        return (await importModule(withSuffix(base + path, '.js'))).default;
      } catch (error) {
        console.error(`The bpmn-js module ${path} could not be loaded`, error);
        return undefined;
      }
    }),
  );
  const extensions = await Promise.all(
    Object.entries(bpmnJs.moddleExtensions).map(async ([name, path]): Promise<[string, unknown] | undefined> => {
      try {
        return [name, await loadJson(withSuffix(base + path, '.json'))];
      } catch (error) {
        console.error(`The moddle extension ${name} could not be loaded`, error);
        return undefined;
      }
    }),
  );
  return {
    additionalModules: modules.filter((value) => value !== undefined),
    moddleExtensions: Object.fromEntries(extensions.filter((entry): entry is [string, unknown] => entry !== undefined)),
  };
}

/** The bpmn-js extensions of the module's classic config.js; undefined while they load. */
export function useBpmnJsExtensions(module: ModuleName): BpmnJsExtensions | undefined {
  const { bpmnJs } = useSettings(module);
  const configured = bpmnJs.additionalModules.length > 0 || Object.keys(bpmnJs.moddleExtensions).length > 0;
  const extensions = useQuery({
    queryKey: ['bpmn-js-extensions', module],
    enabled: configured,
    staleTime: Infinity,
    queryFn: () => loadBpmnJsExtensions(module, bpmnJs),
  });
  return configured ? extensions.data : NO_EXTENSIONS;
}
