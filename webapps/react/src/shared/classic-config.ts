import { appRoot, type ModuleName } from './config';
import { importPlugin } from './plugins/import-plugin';

/**
 * The configuration the operators of the AngularJS webapps maintain in
 * app/{module}/scripts/config.js (an ES module whose default export is the
 * configuration object). Empty when the file is missing or broken.
 *
 * As in the AngularJS webapps, each load asks for the file anew (the server
 * sends no cache headers for it), so an edited config.js applies on the next
 * page load and not when the browser's cached copy expires.
 */
export async function importClassicConfig(
  module: ModuleName,
  importModule: (url: string) => Promise<{ default?: unknown }> = importPlugin,
): Promise<Record<string, unknown>> {
  try {
    const config = (await importModule(`${appRoot}/app/${module}/scripts/config.js?bust=${Date.now()}`)).default;
    return config && typeof config === 'object' ? (config as Record<string, unknown>) : {};
  } catch (error) {
    console.error(`The configuration of the classic ${module} could not be read`, error);
    return {};
  }
}
