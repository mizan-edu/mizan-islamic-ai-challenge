import { defineConfig } from '@playwright/test';

// Screenshot run for the «حديقة الآيات» design (npm run test:screens, after npm run build).
// Uses the locally installed Chrome (no browser download) against `next start`.
const PORT = 3210;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: 'test-results',
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: 'chrome',
    viewport: { width: 1024, height: 768 },
    locale: 'ar',
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
