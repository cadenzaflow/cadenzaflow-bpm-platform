/**
 * Loads a plugin's ES module from the server (on its own, so tests can
 * replace it). The CSP lets modules load that a trusted script imports.
 */
export function importPlugin(url: string): Promise<{ default?: unknown }> {
  return import(/* @vite-ignore */ url);
}
