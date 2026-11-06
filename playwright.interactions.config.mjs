import { defineConfig } from '@playwright/test';

const existingURL = process.env.BOOKARIA_TEST_BASE_URL;
export default defineConfig({
    testDir: './tests/browser',
    testMatch: ['interaction-workspace.spec.mjs', 'model-controls.spec.mjs'],
    workers: 1,
    retries: 0,
    timeout: 60000,
    expect: { timeout: 10000 },
    use: {
        baseURL: existingURL || 'http://localhost:5183',
        actionTimeout: 10000,
        channel: process.env.AR_BROWSER_CHANNEL || 'chrome',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    webServer: existingURL
        ? undefined
        : {
              command: 'pnpm dev --port 5183',
              url: 'http://localhost:5183',
              reuseExistingServer: !process.env.CI,
              timeout: 60000,
          },
});
