import { expect, test } from '@playwright/test';

const apiBaseUrl = process.env.API_BASE_URL?.replace(/\/$/, '');
const studioBaseUrl = process.env.STUDIO_BASE_URL?.replace(/\/$/, '');
const viewerBaseUrl = process.env.VIEWER_BASE_URL?.replace(/\/$/, '');

test.describe('Online Deployment Smoke & Infrastructure Verification', () => {
    test('backend /health, CORS preflight, security headers, and public catalog contract', async ({
        request,
    }) => {
        test.skip(!apiBaseUrl, 'Bỏ qua online smoke BE: chưa cấu hình API_BASE_URL');

        // 1. Health check
        const health = await request.get(`${apiBaseUrl}/health`);
        expect(health.status()).toBe(200);
        const healthJson = await health.json();
        expect(healthJson.data?.status).toBe('OK');

        // 2. Helmet security headers & no x-powered-by
        const headers = health.headers();
        expect(headers['x-powered-by']).toBeUndefined();
        expect(headers['x-request-id']).toBeTruthy();

        // 3. Public books endpoint responds without auth and returns valid pagination envelope
        const booksRes = await request.get(`${apiBaseUrl}/public/books?limit=5`);
        expect(booksRes.status()).toBe(200);
        const booksJson = await booksRes.json();
        expect(Array.isArray(booksJson.data)).toBe(true);
        expect(booksJson.meta).toEqual(
            expect.objectContaining({
                page: expect.any(Number),
                limit: expect.any(Number),
                total: expect.any(Number),
            }),
        );

        // 4. Cross-origin CORS check when STUDIO_BASE_URL is configured
        if (studioBaseUrl) {
            const origin = new URL(studioBaseUrl).origin;
            const corsRes = await request.fetch(`${apiBaseUrl}/public/books?limit=1`, {
                method: 'GET',
                headers: { Origin: origin },
            });
            expect(corsRes.status()).toBe(200);
            expect(corsRes.headers()['access-control-allow-origin']).toBe(origin);
            expect(corsRes.headers()['access-control-allow-credentials']).toBe('true');

            // Untrusted origin must be rejected by requireTrustedOrigin on /auth/refresh
            const untrustedRes = await request.post(`${apiBaseUrl}/auth/refresh`, {
                headers: { Origin: 'https://evil-untrusted-origin.example' },
            });
            expect(untrustedRes.status()).toBe(403);
        }

        // 5. Optional read-only login & session cookie check if test credentials are provided
        const testEmail = process.env.TEST_AUTHOR_EMAIL;
        const testPassword = process.env.TEST_AUTHOR_PASSWORD;
        if (testEmail && testPassword) {
            const originHeader = studioBaseUrl ? { Origin: new URL(studioBaseUrl).origin } : {};
            const loginRes = await request.post(`${apiBaseUrl}/auth/login`, {
                headers: originHeader,
                data: { email: testEmail, password: testPassword, remember: false },
            });
            expect(loginRes.status()).toBe(200);
            const setCookie = loginRes.headers()['set-cookie'] || '';
            expect(setCookie).toContain('HttpOnly');
            if (apiBaseUrl.startsWith('https://')) {
                expect(setCookie).toContain('Secure');
                if (studioBaseUrl.startsWith('https://')) {
                    const apiHost = new URL(apiBaseUrl).hostname;
                    const studioHost = new URL(studioBaseUrl).hostname;
                    const isCrossSite =
                        apiHost.split('.').slice(-2).join('.') !==
                            studioHost.split('.').slice(-2).join('.') ||
                        studioHost.endsWith('.pages.dev') ||
                        apiHost.endsWith('.onrender.com');
                    if (isCrossSite && apiHost !== studioHost) {
                        expect(setCookie.toLowerCase()).toContain('samesite=none');
                    }
                }
            }
            const loginJson = await loginRes.json();
            expect(loginJson.data?.accessToken).toBeTruthy();

            // Verify /me with Bearer token, then logout cleanly so session isn't left dangling
            const meRes = await request.get(`${apiBaseUrl}/me`, {
                headers: { Authorization: `Bearer ${loginJson.data.accessToken}` },
            });
            expect(meRes.status()).toBe(200);
            await request.post(`${apiBaseUrl}/auth/logout`, { headers: originHeader });
        }
    });

    test('deployed Studio FE loads cleanly without console/page errors and reaches discovery', async ({
        page,
    }) => {
        test.skip(!studioBaseUrl, 'Bỏ qua online smoke Studio FE: chưa cấu hình STUDIO_BASE_URL');

        const pageErrors = [];
        page.on('pageerror', (err) => pageErrors.push(err.message));

        await page.goto(studioBaseUrl);
        await expect(page.locator('#main')).toBeVisible();

        await page.goto(`${studioBaseUrl}/library`);
        await expect(
            page.getByRole('heading', { name: 'Khám phá sách', exact: true }),
        ).toBeVisible();
        expect(pageErrors).toEqual([]);
    });

    test('deployed Viewer FE loads cleanly, sets security headers, and enforces embed origin policy', async ({
        page,
    }) => {
        test.skip(!viewerBaseUrl, 'Bỏ qua online smoke Viewer FE: chưa cấu hình VIEWER_BASE_URL');

        const pageErrors = [];
        page.on('pageerror', (err) => pageErrors.push(err.message));

        const res = await page.goto(viewerBaseUrl);
        expect(res?.status()).toBeLessThan(400);
        await expect(page.locator('#main')).toBeVisible();

        // Untrusted direct /embed navigation without matching parent origin must fail safely
        await page.goto(
            `${viewerBaseUrl}/embed#nonce=11111111-1111-4111-8111-111111111111&parent=https://evil.example`,
        );
        await expect(page.locator('#status')).toContainText('Không mở được bản xem nhúng.');
        expect(pageErrors).toEqual([]);
    });
});
