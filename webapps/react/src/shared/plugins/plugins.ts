import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { csrfToken } from '../api/client';
import { appRoot, type ModuleName } from '../config';
import { importPlugin } from './import-plugin';

/**
 * Frontend plugins, with the contract of the AngularJS webapps' plugins
 * (a plugin.js ES module whose default export is one plugin or an array):
 * a plugin is rendered into a DOM node at its plugin point and gets the
 * REST API locations, the engine, the CSRF token and the ids of what the
 * page shows (e.g. processInstanceId).
 */
export interface FrontendPlugin {
  id: string;
  /** e.g. cockpit.processInstance.runtime.tab */
  pluginPoint: string;
  /** higher first */
  priority?: number;
  /** tabs, navigation and reports: the title (an i18n key or plain text) */
  label?: string;
  /** e.g. the path of a cockpit.route plugin */
  properties?: Record<string, unknown>;
  /** renders into the node (for a diagram plugin point: the bpmn-js viewer) */
  render: (node: unknown, props: PluginProps) => void;
  /** the plugin is no longer shown (called without arguments, as in the AngularJS webapps) */
  unmount?: () => void;
}

export interface PluginApi {
  /** e.g. /cadenzaflow/api/admin */
  adminApi: string;
  /** the engine REST API without the engine, e.g. /cadenzaflow/api/engine */
  baseApi: string;
  cockpitApi: string;
  tasklistApi: string;
  /** the engine REST API of the current engine, e.g. /cadenzaflow/api/engine/engine/default */
  engineApi: string;
  engine: string;
  /** to send along as X-XSRF-TOKEN header with POST, PUT and DELETE */
  CSRFToken: string;
}

export type PluginProps = { api: PluginApi } & Record<string, unknown>;

/** Where a plugin's files are (app/plugin.js, app/plugin.css), from the server. */
export interface PluginLocation {
  id: string;
  location: string;
}

const PLUGIN_LIST_ID = 'cadenzaflow-plugins';

/** The plugins of the AngularJS webapps themselves and their legacy (AngularJS) plugins: not for this UI. */
const BUILT_IN = ['cockpitPlugins', 'cockpitEE', 'adminPlugins', 'adminEE', 'tasklistPlugins'];

/**
 * The plugins of a module, from the list the server writes into index.html
 * (per module: {"cockpit": [...], ...}); none when there is no (valid) list.
 */
export function readPluginList(module: ModuleName, doc: Document = document): PluginLocation[] {
  try {
    const lists: unknown = JSON.parse(doc.getElementById(PLUGIN_LIST_ID)?.textContent ?? '{}');
    const list = lists && typeof lists === 'object' ? (lists as Record<string, unknown>)[module] : undefined;
    return Array.isArray(list)
      ? list.filter(
          (entry): entry is PluginLocation =>
            typeof entry?.id === 'string' &&
            typeof entry?.location === 'string' &&
            !BUILT_IN.includes(entry.id) &&
            !entry.id.startsWith('legacy'),
        )
      : [];
  } catch {
    return [];
  }
}

const isPlugin = (value: unknown): value is FrontendPlugin =>
  !!value &&
  typeof (value as FrontendPlugin).pluginPoint === 'string' &&
  typeof (value as FrontendPlugin).render === 'function';

/**
 * Loads the plugins: their stylesheet and their module. A plugin that fails
 * to load is left out (and logged); the others still work.
 */
export async function loadPlugins(
  locations: PluginLocation[],
  importModule: (url: string) => Promise<{ default?: unknown }> = importPlugin,
  doc: Document = document,
): Promise<FrontendPlugin[]> {
  const modules = await Promise.all(
    locations.map(async ({ id, location }) => {
      const stylesheet = doc.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = `${location}/plugin.css`;
      doc.head.appendChild(stylesheet);
      try {
        const exported = (await importModule(`${location}/plugin.js`)).default;
        return (Array.isArray(exported) ? exported : [exported]).filter(isPlugin);
      } catch (error) {
        console.error(`The plugin ${id} could not be loaded`, error);
        return [];
      }
    }),
  );
  return modules.flat();
}

/** What every plugin gets: the REST APIs, the engine and the CSRF token. */
export function pluginApi(engine: string): PluginApi {
  const api = `${appRoot}/api`;
  return {
    adminApi: `${api}/admin`,
    baseApi: `${api}/engine`,
    cockpitApi: `${api}/cockpit`,
    tasklistApi: `${api}/tasklist`,
    engineApi: `${api}/engine/engine/${encodeURIComponent(engine)}`,
    engine,
    CSRFToken: csrfToken() ?? '',
  };
}

/** The plugins of the module, loaded once. */
export function usePlugins(module: ModuleName) {
  return useQuery({
    queryKey: ['plugins', module],
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: () => loadPlugins(readPluginList(module)),
  });
}

const NO_PLUGINS: FrontendPlugin[] = [];

/** The plugins of one plugin point, highest priority first (the same array until the plugins change). */
export function usePluginPoint(module: ModuleName, point: string): FrontendPlugin[] {
  const plugins = usePlugins(module).data;
  return useMemo(() => {
    const matching = (plugins ?? []).filter((plugin) => plugin.pluginPoint === point);
    return matching.length
      ? matching.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.id.localeCompare(b.id))
      : NO_PLUGINS;
  }, [plugins, point]);
}

/**
 * Renders plugins into one target (e.g. a diagram viewer); a plugin that
 * fails is logged. Returns what unmounts them again.
 */
export function renderPlugins(plugins: FrontendPlugin[], target: unknown, props: PluginProps): () => void {
  for (const plugin of plugins) {
    try {
      plugin.render(target, props);
    } catch (error) {
      console.error(`The plugin ${plugin.id} failed to render`, error);
    }
  }
  return () => {
    for (const plugin of plugins) {
      try {
        plugin.unmount?.();
      } catch (error) {
        console.error(`The plugin ${plugin.id} failed to unmount`, error);
      }
    }
  };
}

/**
 * Diagram plugins (e.g. cockpit.processInstance.diagram.plugin) get the
 * bpmn-js viewer instead of a DOM node. Returns the callback for the
 * diagram's onViewer; plugins that load after the diagram are rendered too.
 */
export function useDiagramPlugins(module: ModuleName, point: string, engine: string, props: Record<string, unknown>) {
  const plugins = usePluginPoint(module, point);
  const [viewer, setViewer] = useState<unknown>(null);
  const propsKey = JSON.stringify(props);

  useEffect(() => {
    if (!viewer || !plugins.length) {
      return;
    }
    return renderPlugins(plugins, viewer, { api: pluginApi(engine), ...props });
  }, [viewer, plugins, engine, propsKey]);

  return useCallback((next: unknown) => {
    setViewer(next);
    return () => setViewer(null);
  }, []);
}
