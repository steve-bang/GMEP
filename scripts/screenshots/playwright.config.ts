import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
/** Screenshot run: seeds rich demo data through the real API, then captures every built screen. Emulator only. */
export default defineConfig({
  testDir: '.',
  testMatch: 'capture.spec.ts',
  timeout: 15 * 60_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['Desktop Chrome'],
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  webServer: {
    command: `pnpm exec next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
