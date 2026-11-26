import { expect, test } from '@playwright/test';

const bookId = '22222222-2222-4222-8222-222222222222';
const pageId = (n) => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const jobId = (n) => `99999999-9999-4999-8999-${String(n).padStart(12, '0')}`;
const token = (n) => String.fromCharCode(96 + n).repeat(32);

async function open(page, options = {}) {
    const calls = [],
        gets = [];
    let releasePost, releaseJob;
    const postGate = new Promise((resolve) => {
        releasePost = resolve;
    });
    const jobGate = new Promise((resolve) => {
        releaseJob = resolve;
    });
    await page.addInitScript(
        (theme) => localStorage.setItem('bookaria.theme', theme),
        options.theme || 'light',
    );
    await page.route('**/api/v1/**', async (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        if (request.method() === 'POST' && path.endsWith('/previews')) {
            const n = calls.push(request.postDataJSON());
            if (options.deferPost && n === 1) await postGate;
            if (options.existing && n === 1)
                return route.fulfill({
                    status: 409,
                    json: {
                        error: {
                            code: 'JOB_IN_PROGRESS',
                            message: 'Đang có tác vụ chạy.',
                            requestId: 'link-test',
                            details: { jobId: jobId(1) },
                        },
                    },
                });
            if (options.failFirst && n === 1)
                return route.fulfill({
                    status: 500,
                    json: { error: { message: 'Chưa tạo được bản xem trước.' } },
                });
            return route.fulfill({ status: 202, json: { data: { jobId: jobId(n) } } });
        }
        if (request.method() === 'GET' && path.includes('/jobs/')) {
            const id = path.split('/').at(-1);
            gets.push(id);
            if (options.deferJob) await jobGate;
            const n = Number(id.split('-').at(-1));
            return route.fulfill({
                json: {
                    data: {
                        id: options.wrongJob ? jobId(90) : id,
                        type: 'BUILD_PREVIEW',
                        status: 'SUCCEEDED',
                        progress: 100,
                        ref: { type: 'BOOK', id: bookId },
                        result: {
                            token: token(n),
                            url: `https://viewer.example/preview/${token(n)}`,
                        },
                        error: null,
                        createdAt: new Date().toISOString(),
                        finishedAt: new Date().toISOString(),
                    },
                },
            });
        }
        throw new Error(`Unexpected real API request: ${request.method()} ${path}`);
    });
    await page.goto('/tests/browser/phone-preview.html');
    await expect(page.getByRole('dialog')).toBeVisible();
    return { calls, gets, releasePost, releaseJob };
}
const create = (page) => page.getByRole('button', { name: /Tạo liên kết xem trước$/ });
const link = (page) => page.getByRole('link', { name: 'Mở Viewer', exact: true });
const qr = (page) => page.getByRole('img', { name: 'QR mở Viewer xem trước', exact: true });
const scope = (page) => page.getByRole('combobox', { name: 'Phạm vi', exact: true });
async function choose(page, value) {
    await scope(page).click();
    await page.getByRole('option', { name: value, exact: true }).click();
}
async function hasToken(page, n) {
    await expect(link(page)).toHaveAttribute('href', new RegExp(`/preview/${token(n)}\\?mode=ar$`));
}

for (const [theme, width] of [
    ['light', 1280],
    ['dark', 1440],
]) {
    test(`preview ${theme}: regenerates page/book scopes and QR with AR entry`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height: 900 });
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        const api = await open(page, { theme });
        await create(page).click();
        await hasToken(page, 1);
        await expect(qr(page)).toBeVisible();
        const oldImage = await qr(page).getAttribute('src');
        await choose(page, 'Toàn bộ sách');
        await expect(link(page)).toHaveCount(0);
        await expect(qr(page)).toHaveCount(0);
        await expect(
            page.getByText('Liên kết có hiệu lực 24 giờ, dùng nội dung đã lưu.'),
        ).toHaveCount(0);
        await expect(create(page)).toBeEnabled();
        await create(page).click();
        await hasToken(page, 2);
        await expect(qr(page)).toBeVisible();
        expect(await qr(page).getAttribute('src')).not.toBe(oldImage);
        expect(api.calls).toEqual([{ scope: 'PAGE', pageId: pageId(1) }, { scope: 'BOOK' }]);
        const bounds = await page.getByRole('dialog').boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(900);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
        await page.screenshot({ path: info.outputPath(`phone-preview-${theme}.png`) });
        await choose(page, 'Trang hiện tại');
        await expect(link(page)).toHaveCount(0);
        await create(page).click();
        await hasToken(page, 3);
        expect(api.calls[2]).toEqual({ scope: 'PAGE', pageId: pageId(1) });
        expect(errors).toEqual([]);
    });
}

test('does not submit twice or change scope while a preview request/job is pending', async ({
    page,
}) => {
    const api = await open(page, { deferJob: true });
    await create(page).evaluate((button) => {
        button.click();
        button.click();
    });
    await expect.poll(() => api.gets.length).toBe(1);
    expect(api.calls).toHaveLength(1);
    await expect(scope(page)).toBeDisabled();
    await expect(create(page)).toBeDisabled();
    api.releaseJob();
    await hasToken(page, 1);
    await expect(scope(page)).toBeEnabled();
});

test('waits for an existing job then creates a fresh token for the requested scope', async ({
    page,
}) => {
    const api = await open(page, { existing: true });
    await choose(page, 'Toàn bộ sách');
    await create(page).click();
    await expect(page.locator('p[role="status"]')).toContainText('Tác vụ trước đã hoàn tất.');
    await expect(link(page)).toHaveCount(0);
    await expect(qr(page)).toHaveCount(0);
    await expect(create(page)).toBeEnabled();
    await create(page).click();
    await hasToken(page, 2);
    expect(api.calls).toEqual([{ scope: 'BOOK' }, { scope: 'BOOK' }]);
});

test('a late create response from the previous page cannot become the current page link', async ({
    page,
}) => {
    const api = await open(page, { deferPost: true });
    await create(page).click();
    await expect.poll(() => api.calls.length).toBe(1);
    await page.evaluate((id) => window.__phonePreview.setPageId(id), pageId(2));
    await expect(create(page)).toBeEnabled();
    const finished = page.waitForResponse(
        (response) =>
            response.request().method() === 'POST' && response.url().endsWith('/previews'),
    );
    api.releasePost();
    await finished;
    await page.evaluate(
        () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
    );
    await expect(link(page)).toHaveCount(0);
    expect(api.gets).toEqual([]);
    await create(page).click();
    await hasToken(page, 2);
    expect(api.calls[1]).toEqual({ scope: 'PAGE', pageId: pageId(2) });
});

test('a response from a different job never exposes a preview token', async ({ page }) => {
    await open(page, { wrongJob: true });
    await create(page).click();
    await expect(page.getByRole('alert')).toContainText('Tác vụ không thuộc sách này.');
    await expect(link(page)).toHaveCount(0);
    await expect(qr(page)).toHaveCount(0);
});

test('changing scope clears an earlier error and allows a fresh request', async ({ page }) => {
    const api = await open(page, { failFirst: true });
    await create(page).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await choose(page, 'Toàn bộ sách');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await create(page).click();
    await hasToken(page, 2);
    expect(api.calls[1]).toEqual({ scope: 'BOOK' });
});

test('library labels its copied information link separately from the Viewer reading link', async ({
    page,
}, info) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.route('**/api/v1/**', (route) =>
        route.fulfill({
            json: {
                data: {
                    slug: 'link-audit',
                    title: 'Sách kiểm thử liên kết',
                    description: null,
                    author: { id: bookId, displayName: 'Tác giả' },
                    coverUrl: null,
                    language: 'vi',
                    ageMin: null,
                    ageMax: null,
                    version: { id: jobId(1), versionNo: 1, publishedAt: new Date().toISOString() },
                    manifestUrl: 'https://viewer.example/manifest.json',
                    pageCount: 1,
                    arPageCount: 1,
                    downloadBytes: 0,
                    printPdfUrl: null,
                },
            },
        }),
    );
    await page.goto('/tests/browser/phone-preview.html?view=library');
    const copy = page.getByRole('button', {
        name: 'Sao chép liên kết thông tin sách',
        exact: true,
    });
    await expect(copy).toContainText('Sao chép liên kết');
    await page.evaluate(() =>
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {
                writeText: async (text) => {
                    window.__copiedLink = text;
                },
            },
        }),
    );
    await copy.click();
    const copied = new URL(await page.evaluate(() => window.__copiedLink));
    expect(copied.pathname).toBe('/library');
    expect(copied.searchParams.get('book')).toBe('link-audit');
    const reader = new URL(
        await page
            .getByRole('link', { name: 'Trải nghiệm trong tab mới', exact: true })
            .getAttribute('href'),
    );
    expect(reader.pathname).toBe('/b/link-audit');
    expect(reader.search).toBe('');
    await page.screenshot({ path: info.outputPath('library-information-link.png') });
});
