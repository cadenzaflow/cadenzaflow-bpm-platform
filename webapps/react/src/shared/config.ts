/** The webapp modules. The names match the server's /app/{module}/{engine}/ URLs. */
export const MODULES = ['cockpit', 'tasklist', 'admin', 'welcome'] as const;
export type ModuleName = (typeof MODULES)[number];

const APP_ROOT_META = 'cadenzaflow-app-root';

/**
 * The app root is the servlet context path plus the webapp application path,
 * e.g. "/cadenzaflow" for CadenzaFlow Run or "" for a webapp deployed at "/".
 * The server writes it into index.html (see ProcessEnginesFilter).
 */
export function readAppRoot(doc: Document = document): string {
  const value = doc.querySelector(`meta[name="${APP_ROOT_META}"]`)?.getAttribute('content') ?? '';
  return value.replace(/\/+$/, '');
}

export const appRoot = readAppRoot();

/** Path of this UI below the app root; the AngularJS webapps keep /app/{module}/. */
export const BASE_PATH = '/app/react';

/** Start page of a module in this UI, e.g. /cadenzaflow/app/react/tasklist/default/ */
export function moduleUrl(module: ModuleName, engine: string): string {
  return `${appRoot}${BASE_PATH}/${module}/${encodeURIComponent(engine)}/`;
}

/** The same module in the AngularJS webapps ("classic UI"). */
export function classicUrl(module: ModuleName, engine: string): string {
  return `${appRoot}/app/${module}/${encodeURIComponent(engine)}/`;
}

export function isModuleName(value: unknown): value is ModuleName {
  return typeof value === 'string' && (MODULES as readonly string[]).includes(value);
}
