import { request } from '@playwright/test';
import { Engine, REST } from './support';

/** Before all tests: the server answers, and it has the processes of the tests. */
export default async function globalSetup(): Promise<void> {
  const context = await request.newContext();
  try {
    const version = await context.get(`${REST}/version`).catch((error: Error) => {
      throw new Error(`No CadenzaFlow at ${REST} (set E2E_SERVER): ${error.message}`);
    });
    if (version.status() !== 200) {
      throw new Error(`GET ${REST}/version answered ${version.status()}`);
    }
    await new Engine(context).deployTestProcesses();
  } finally {
    await context.dispose();
  }
}
