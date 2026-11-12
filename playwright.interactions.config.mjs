import { defineConfig } from '@playwright/test';

const existingURL = process.env.BOOKARIA_TEST_BASE_URL;
export default defineConfig({
    testDir: './tests/browser',
    testMatch: [
        'interaction-guided.spec.mjs',
        'interaction-workspace.spec.mjs',
        'model-controls.spec.mjs',
        'cover-upload.spec.mjs',
        'editor-pages.spec.mjs',
        'interaction-repair.spec.mjs',
        'marker-dialog-layout.spec.mjs',
        'transform-edit.spec.mjs',
        'editor-inputs.spec.mjs',
        'admin-merge.spec.mjs',
        'viewer-links.spec.mjs',
    ],
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
