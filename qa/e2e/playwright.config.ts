import { defineConfig } from '@playwright/test';

// The CadenzaFlow to test, e.g. a distribution started with env/start.sh.
const server = (process.env.E2E_SERVER ?? 'http://localhost:8080').replace(/\/$/, '');

export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/global-setup.ts',
  // the tests share one engine: one after the other
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `${server}/cadenzaflow/`,
    locale: 'en-US',
    timezoneId: 'UTC',
    viewport: { width: 1400, height: 900 },
    // E2E_CHANNEL=msedge or chrome uses the browser of the machine; without it the
    // Chromium of `npx playwright install chromium`
    channel: process.env.E2E_CHANNEL || undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
