import { appRoot, type ModuleName } from './config';

/**
 * The configuration the operators of the AngularJS webapps maintain in
 * app/{module}/scripts/config.js (an ES module whose default export is the
 * configuration object). Empty when the file is missing or broken.
 */
export async function importClassicConfig(module: ModuleName): Promise<Record<string, unknown>> {
  try {
    const config = (await import(/* @vite-ignore */ `${appRoot}/app/${module}/scripts/config.js`)).default;
    return config && typeof config === 'object' ? config : {};
  } catch (error) {
    console.error(`The configuration of the classic ${module} could not be read`, error);
    return {};
  }
}
