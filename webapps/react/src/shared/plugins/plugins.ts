import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { csrfToken } from '../api/client';
import { useSettings } from '../classic-settings';
import { MODULES, appRoot, type ModuleName } from '../config';
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
  /** e.g. the path of a {module}.route plugin */
  properties?: Record<string, unknown>;
  /** renders into the node (for a diagram plugin point: the bpmn-js viewer) */
  render?: (node: unknown, props: PluginProps) => void;
  /** the plugin is no longer shown (called without arguments, as in the AngularJS webapps) */
  unmount?: () => void;
  /** at {module}.logout: logs the user out instead of the webapp (e.g. a single sign-on logout) */
  logout?: (props: PluginProps) => void;
  /** at {module}.login.data: gets the login (see passLogin) */
  result?: (login: Promise<ClassicAuthentication>) => void;
}

/** The authentication as the AngularJS webapps hand it to plugins. */
export interface ClassicAuthentication {
  /** the user id */
  name: string;
  authorizedApps: string[];
  canAccess: (app: string) => boolean;
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

/**
 * The plugins of a plugin point of the app, highest priority first: a plugin
 * that offers plugin points of its own renders them (render(node, props),
 * unmount() when it removes them).
 */
export type PluginLookup = (point: string) => FrontendPlugin[];

export type PluginProps = { api: PluginApi; plugins?: PluginLookup } & Record<string, unknown>;

/** Where a plugin's files are (app/plugin.js, app/plugin.css), from the server. */
export interface PluginLocation {
  id: string;
  location: string;
}

const PLUGIN_LIST_ID = 'cadenzaflow-plugins';

/** The plugins of the AngularJS webapps themselves and their legacy (AngularJS) plugins: not for this UI. */
const BUILT_IN = ['cockpitPlugins', 'cockpitEE', 'adminPlugins', 'adminEE', 'tasklistPlugins', 'welcomePlugins'];

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
  (typeof (value as FrontendPlugin).render === 'function' ||
    typeof (value as FrontendPlugin).logout === 'function' ||
    typeof (value as FrontendPlugin).result === 'function');

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

/**
 * Loads the customScripts of the classic config.js: ES modules below
 * app/{module}/, as in the classic webapps. Their code runs, and the plugins
 * they export join the module's plugins. A script that fails to load (e.g.
 * one written for AngularJS) is left out and logged.
 */
export async function loadCustomScripts(
  module: ModuleName,
  scripts: string[],
  importModule: (url: string) => Promise<{ default?: unknown }> = importPlugin,
): Promise<FrontendPlugin[]> {
  const modules = await Promise.all(
    scripts.map(async (script) => {
      try {
        const exported = (await importModule(`${appRoot}/app/${module}/${script.endsWith('.js') ? script : `${script}.js`}`)).default;
        return exported === undefined ? [] : (Array.isArray(exported) ? exported : [exported]).filter(isPlugin);
      } catch (error) {
        console.error(`The custom script ${script} could not be loaded`, error);
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

/** The plugins of the module (those of the server and the customScripts of the classic config.js), loaded once. */
export function usePlugins(module: ModuleName) {
  const { customScripts } = useSettings(module);
  return useQuery({
    queryKey: ['plugins', module],
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => {
      const [plugins, scripted] = await Promise.all([loadPlugins(readPluginList(module)), loadCustomScripts(module, customScripts)]);
      return [...plugins, ...scripted];
    },
  });
}

const NO_PLUGINS: FrontendPlugin[] = [];

/** The plugins of one plugin point, highest priority first. */
function pluginsOf(plugins: FrontendPlugin[] | undefined, point: string): FrontendPlugin[] {
  const matching = (plugins ?? []).filter((plugin) => plugin.pluginPoint === point);
  return matching.length ? matching.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0) || a.id.localeCompare(b.id)) : NO_PLUGINS;
}

/** The plugins of one plugin point, highest priority first (the same array until the plugins change). */
export function usePluginPoint(module: ModuleName, point: string): FrontendPlugin[] {
  const plugins = usePlugins(module).data;
  return useMemo(() => pluginsOf(plugins, point), [plugins, point]);
}

/** The app of a plugin point: its first part (cockpit.route: cockpit). */
export function moduleOf(point: string): ModuleName | undefined {
  const module = point.split('.')[0];
  return (MODULES as readonly string[]).includes(module) ? (module as ModuleName) : undefined;
}

const NO_LOOKUP: PluginLookup = () => NO_PLUGINS;

/**
 * What plugins get as props.plugins: the plugins of the app's plugin points.
 * It reads the app's loaded plugins when it is called (a plugin that gets it
 * was itself found among them), so it stays the same function.
 */
export function usePluginLookup(module: ModuleName | undefined): PluginLookup {
  const client = useQueryClient();
  return useMemo(
    () => (module ? (point: string) => pluginsOf(client.getQueryData<FrontendPlugin[]>(['plugins', module]), point) : NO_LOOKUP),
    [client, module],
  );
}

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Whether the URL's hash (e.g. /my-page/42?tab=log) is a page of a route
 * plugin's path, read as by the routes of the classic webapps: a segment
 * :name stands for any one segment, :name* for one or more, :name? for an
 * optional one, and the query after ? does not count.
 */
export function matchesRoutePath(path: string, hash: string): boolean {
  if (!path.startsWith('/')) {
    return path === hash;
  }
  const segments = path
    .slice(1)
    .split('/')
    .map((segment) => {
      const param = /^:\w+(\*\?|\*|\?)?$/.exec(segment);
      switch (param ? (param[1] ?? '') : undefined) {
        case undefined:
          return `/${escapeRegExp(segment)}`;
        case '?':
          return '(?:/[^/?#]+)?';
        case '*':
          return '/[^?#]+';
        case '*?':
          return '(?:/[^?#]+)?';
        default:
          return '/[^/?#]+';
      }
    });
  return new RegExp(`^${segments.join('')}(?:[?#]|$)`).test(hash);
}

/** The {module}.route plugin whose path (as in the classic webapps, e.g. /my-page or /my-page/:id) the URL's hash names, if any. */
export function useRoutePlugin(module: ModuleName, hash: string): FrontendPlugin | undefined {
  const plugins = usePluginPoint(module, `${module}.route`);
  return hash
    ? plugins.find((plugin) => typeof plugin.properties?.path === 'string' && matchesRoutePath(plugin.properties.path, hash))
    : undefined;
}

/** The {module}.logout plugin with the highest priority (e.g. a single sign-on logout), if there is one. */
export function useLogoutPlugin(module: ModuleName): FrontendPlugin | undefined {
  return usePluginPoint(module, `${module}.logout`).find((plugin) => typeof plugin.logout === 'function');
}

/** Logs the user out with the plugin; false when it failed (logged), so the webapp logs out itself. */
export function logOutWith(plugin: FrontendPlugin, engine: string): boolean {
  try {
    plugin.logout?.({ api: pluginApi(engine) });
    return true;
  } catch (error) {
    console.error(`The plugin ${plugin.id} failed to log out`, error);
    return false;
  }
}

/**
 * Hands a login to the {module}.login.data plugins: a promise of the
 * authentication, as in the AngularJS webapps, that rejects when the login
 * fails. A plugin that throws is logged; the login goes on.
 */
export function passLogin(plugins: FrontendPlugin[], login: Promise<{ userId: string; authorizedApps: string[] }>) {
  if (!plugins.length) {
    return;
  }
  const authentication = login.then(({ userId, authorizedApps }) => ({
    name: userId,
    authorizedApps,
    canAccess: (app: string) => authorizedApps.includes(app),
  }));
  // the login page shows a failed login; plugins that ignore it do not make it an unhandled rejection
  authentication.catch(() => {});
  for (const plugin of plugins) {
    try {
      plugin.result?.(authentication);
    } catch (error) {
      console.error(`The plugin ${plugin.id} failed to take the login`, error);
    }
  }
}

/**
 * Renders plugins into one target (e.g. a diagram viewer); a plugin that
 * fails is logged. Returns what unmounts them again.
 */
export function renderPlugins(plugins: FrontendPlugin[], target: unknown, props: PluginProps): () => void {
  for (const plugin of plugins) {
    try {
      plugin.render?.(target, props);
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

/** The bpmn-js viewer of a diagram while it is shown, and the callback for the diagram's onViewer. */
export function useDiagramViewer(): [unknown, (viewer: unknown) => () => void] {
  const [viewer, setViewer] = useState<unknown>(null);
  const onViewer = useCallback((next: unknown) => {
    setViewer(next);
    return () => setViewer(null);
  }, []);
  return [viewer, onViewer];
}

/**
 * Diagram plugins (e.g. cockpit.processInstance.diagram.plugin) get the
 * bpmn-js viewer instead of a DOM node. They are rendered while the viewer is
 * there; plugins that load after the diagram are rendered too.
 */
export function useDiagramPlugins(module: ModuleName, point: string, engine: string, viewer: unknown, props: Record<string, unknown>) {
  const plugins = usePluginPoint(module, point);
  const lookup = usePluginLookup(module);
  const propsKey = JSON.stringify(props);

  useEffect(() => {
    if (!viewer || !plugins.length) {
      return;
    }
    return renderPlugins(plugins, viewer, { api: pluginApi(engine), plugins: lookup, ...props });
  }, [viewer, plugins, lookup, engine, propsKey]);
}
