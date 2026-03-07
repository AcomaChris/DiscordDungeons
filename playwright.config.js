import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: 0,
  // Single worker avoids Vite cold-start race when multiple browsers
  // hit the dev server simultaneously during first module transform
  workers: 1,
  use: {
    headless: true,
    viewport: { width: 800, height: 600 },
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: [
    {
      command: 'npm run dev -- --port 8081',
      port: 8081,
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: 'npm run server',
      port: 3001,
      reuseExistingServer: true,
      timeout: 10_000,
    },
  ],
});
