import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 45_000,
  fullyParallel: true,
  workers: 3, // the GPU and CPU are shared; more workers make timing-based checks flaky
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:8080', channel: 'chrome', colorScheme: 'dark' },
  webServer: {
    command: 'node scripts/serve.mjs 8080',
    url: 'http://127.0.0.1:8080/index.html',
    reuseExistingServer: true,
  },
  projects: [{ name: 'chrome', use: { channel: 'chrome' } }],
});
