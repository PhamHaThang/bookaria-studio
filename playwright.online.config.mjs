import { defineConfig } from '@playwright/test';

const studioBaseUrl = process.env.STUDIO_BASE_URL || process.env.BOOKARIA_TEST_BASE_URL;
const isLocal = !studioBaseUrl;

export default defineConfig({
    testDir: './tests/online',
    testMatch: '**/*.spec.mjs',
    workers: 1,
    retries: process.env.CI ? 1 : 0,
    timeout: 60_000,
    expect: { timeout: 10_000 },
    reporter: [['list'], ['json', { outputFile: 'test-results/online-studio-report.json' }]],
    use: {
        baseURL: studioBaseUrl || 'http://localhost:5185',
        actionTimeout: 10_000,
        navigationTimeout: 20_000,
        ignoreHTTPSErrors: process.env.IGNORE_HTTPS_ERRORS === '1',
        channel: process.env.AR_BROWSER_CHANNEL || 'chrome',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    webServer: isLocal
        ? {
              command: 'node scripts/sync-pdf-assets.mjs && ./node_modules/.bin/vite --port 5185',
              url: 'http://localhost:5185',
              reuseExistingServer: !process.env.CI,
              timeout: 60_000,
          }
        : undefined,
});
