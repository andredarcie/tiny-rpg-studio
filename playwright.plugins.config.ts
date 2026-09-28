import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: 'plugins.spec.ts',
  grep: /at \/studio\//,
  timeout: 60000,
  metadata: { pluginsProduction: true },
  use: { baseURL: 'http://127.0.0.1:4174', headless: true },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4174 --base /studio/',
    port: 4174,
    reuseExistingServer: false,
  },
});
