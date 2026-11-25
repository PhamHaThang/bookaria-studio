import { expect, test } from '@playwright/test';

const now = '2026-11-19T09:30:00Z';
const image = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5d8AAAAASUVORK5CYII=',
    'base64',
);
for (const viewport of [
    { width: 1366, height: 768 },
    { width: 360, height: 640 },
]) {
    test(`upload and generate 3D from Assets at ${viewport.width}px`, async ({ page }, info) => {
        await page.setViewportSize(viewport);
        const dark = viewport.width === 360;
        if (dark) await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.addInitScript(
            (theme) => localStorage.setItem('bookaria.theme', theme),
            dark ? 'dark' : 'light',
        );
        const generationRequests = [];
        const inputId = '44444444-4444-4444-8444-444444444444';
        const job = {
            id: '55555555-5555-4555-8555-555555555555',
            type: 'GENERATE_MODEL',
            name: 'Rùa biển',
            status: 'QUEUED',
            progress: 0,
            ref: { type: 'ASSET', id: inputId },
            result: null,
            error: null,
            createdAt: now,
            finishedAt: null,
        };
        let submitted = false;
        let progressUnavailable = true;
        let releaseAssets;
        const assetsReady = new Promise((resolve) => {
            releaseAssets = resolve;
        });
        page.on('request', (request) => {
            const url = new URL(request.url());
            if (
                (request.method() === 'POST' &&
                    /\/api\/v1\/assets\/(?:model-generations|upload-signature)/.test(
                        url.pathname,
                    )) ||
                /(^|\.)(runpod\.ai|r2\.cloudflarestorage\.com)$/.test(url.hostname) ||
                (url.pathname.includes('/assets/') && request.method() !== 'GET')
            ) {
                generationRequests.push(`${request.method()} ${url.pathname}`);
            }
        });
        await page.route('https://test.r2.cloudflarestorage.com/**', (route) =>
            route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' } }),
        );
        await page.route('**/api/v1/**', async (route) => {
            const { pathname } = new URL(route.request().url());
            const path = pathname.replace(/^.*\/api\/v1/, '');
            const reply = (data, status = 200) => route.fulfill({ status, json: { data } });
            if (path === '/assets/upload-signature') {
                expect(route.request().postDataJSON().purpose).toBe('MODEL_INPUT');
                return reply({
                    assetId: inputId,
                    uploadUrl: 'https://test.r2.cloudflarestorage.com/input',
                    method: 'PUT',
                    objectKey: 'bookaria/model-inputs/test/input',
                    headers: { 'Content-Type': 'image/png', 'If-None-Match': '*' },
                    expiresAt: new Date(Date.now() + 900000).toISOString(),
                });
            }
            if (path === '/assets/model-generations') {
                if (route.request().method() === 'POST') {
                    expect(route.request().postDataJSON()).toEqual({ inputId });
                    submitted = true;
                    return reply(job, 202);
                }
                if (submitted && progressUnavailable)
                    return route.fulfill({
                        status: 503,
                        json: { error: { code: 'INTERNAL_ERROR', message: 'Unavailable' } },
                    });
                return reply(submitted ? [job] : []);
            }
            if (path === '/auth/refresh')
                return reply({ accessToken: 'test-token', expiresIn: 3600 });
            if (path === '/me')
                return reply({
                    id: '33333333-3333-4333-8333-333333333333',
                    email: 'author@bookaria.vn',
                    displayName: 'Tác giả',
                    role: 'AUTHOR',
                    emailVerified: true,
                    avatarUrl: null,
                    organization: null,
                    bio: null,
                    storage: { usedBytes: 1000, quotaBytes: 500000000 },
                    createdAt: now,
                });
            if (path === '/assets' || path === '/me/notifications') {
                if (path === '/assets' && submitted) await assetsReady;
                return route.fulfill({
                    json: { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } },
                });
            }
            if (path === '/asset-categories') return reply([]);
            return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND' } } });
        });

        await page.goto('/assets?type=MODEL');
        await page.getByRole('link', { name: 'Tải tài nguyên', exact: true }).click();
        const upload = page.getByRole('dialog', { name: 'Tải tài nguyên', exact: true });
        await expect(upload.getByRole('tab', { name: 'Mô hình 3D', selected: true })).toBeVisible();
        await upload.getByRole('tab', { name: 'Hình ảnh' }).click();
        await expect(upload.getByRole('button', { name: 'Tải lên', exact: true })).toBeVisible();
        await expect(upload.getByRole('button', { name: /tạo 3D/i })).toHaveCount(0);
        await upload.getByRole('button', { name: 'Đóng tải tài nguyên' }).click();
        await page.goto('/assets?type=IMAGE');
        await page.getByRole('link', { name: 'Tạo 3D từ ảnh', exact: true }).click();

        const dialog = page.getByRole('dialog', { name: 'Tạo 3D từ ảnh', exact: true });
        const submit = dialog.getByRole('button', { name: 'Tạo mô hình 3D', exact: true });
        const tips = dialog.getByRole('complementary', { name: 'Mẹo chọn ảnh' });
        const openTips = tips.getByRole('button', { name: 'Mẹo chọn ảnh' });
        if (dark) {
            await expect(openTips).toHaveAttribute('aria-expanded', 'false');
            await openTips.click();
            await expect(openTips).toHaveAttribute('aria-expanded', 'true');
        }
        await expect(tips.getByRole('heading', { name: 'Một vật thể mỗi ảnh' })).toBeVisible();
        await expect
            .poll(() =>
                tips
                    .locator('img')
                    .evaluateAll((images) =>
                        images
                            .filter((image) => !image.complete || image.naturalWidth === 0)
                            .map((image) => image.src),
                    ),
            )
            .toEqual([]);
        expect(
            await tips
                .locator('img')
                .evaluateAll((images) => new Set(images.map((image) => image.src)).size),
        ).toBe(11);
        await expect(tips.getByRole('button', { name: /tự chuyển mẹo/ })).toHaveCount(0);
        if (!dark) {
            await page.screenshot({
                path: info.outputPath('generate-3d-empty.png'),
                animations: 'disabled',
            });
            await expect(tips.getByRole('heading', { name: 'Ưu tiên ảnh vuông' })).toBeVisible();
            await tips.hover();
        }
        await tips.getByRole('tab', { name: 'Tỉ lệ ảnh' }).click();
        await tips.getByRole('tabpanel', { name: 'Tỉ lệ ảnh' }).scrollIntoViewIfNeeded();
        await page.screenshot({
            path: info.outputPath('generate-3d-tip-ratio.png'),
            animations: 'disabled',
        });
        const framing = tips.getByRole('tab', { name: 'Khung hình' });
        await framing.click();
        const tipPanel = tips.getByRole('tabpanel', { name: 'Khung hình' });
        const illustration = tipPanel.getByRole('img', {
            name: 'Giữ trọn hình dáng: Thấy trọn vật thể',
            exact: true,
        });
        await expect(illustration).toBeVisible();
        await expect(tipPanel.getByRole('img')).toHaveCount(2);
        await expect
            .poll(() => illustration.evaluate((element) => element.naturalWidth))
            .toBeGreaterThan(0);
        await expect(tipPanel.locator('figcaption')).toHaveCount(0);
        await expect(tipPanel).toHaveCSS('opacity', '1');
        await expect(tips.getByRole('tabpanel')).toHaveCount(1);
        await expect(tips.getByRole('tab', { name: 'Khung hình', selected: true })).toBeVisible();
        const indicators = tips.getByRole('tablist', { name: 'Các mẹo chọn ảnh' });
        await expect
            .poll(async () => {
                const [label, navigation] = await Promise.all([
                    illustration.boundingBox(),
                    indicators.boundingBox(),
                ]);
                return Boolean(label && navigation && navigation.y >= label.y + label.height);
            })
            .toBe(true);
        await framing.press('ArrowRight');
        await expect(tips.getByRole('heading', { name: 'Nền gọn, ánh sáng đều' })).toBeVisible();
        const focusedIndicator = tips.getByRole('tab', { name: 'Nền ảnh' });
        await expect(focusedIndicator).toBeFocused();
        await expect(focusedIndicator).toHaveCSS('--tw-ring-offset-width', '0px');
        await expect(focusedIndicator.locator('span')).toHaveCSS('height', '4px');
        async function swipeTip(name, direction = -1) {
            const swipePanel = tips.getByRole('tabpanel', { name });
            await swipePanel.scrollIntoViewIfNeeded();
            const swipeBounds = await swipePanel.boundingBox();
            expect(swipeBounds).not.toBeNull();
            const swipeY = swipeBounds.y + swipeBounds.height / 2;
            const swipeStart = swipeBounds.x + swipeBounds.width * (direction < 0 ? 0.8 : 0.2);
            const swipeEnd = swipeBounds.x + swipeBounds.width * (direction < 0 ? 0.2 : 0.8);
            if (dark) {
                const touch = await page.context().newCDPSession(page);
                await touch.send('Input.dispatchTouchEvent', {
                    type: 'touchStart',
                    touchPoints: [{ x: swipeStart, y: swipeY }],
                });
                for (let step = 1; step <= 8; step++) {
                    await touch.send('Input.dispatchTouchEvent', {
                        type: 'touchMove',
                        touchPoints: [
                            { x: swipeStart + ((swipeEnd - swipeStart) * step) / 8, y: swipeY },
                        ],
                    });
                }
                await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
                await touch.detach();
            } else {
                await page.mouse.move(swipeStart, swipeY);
                await page.mouse.down();
                await page.mouse.move(swipeEnd, swipeY, { steps: 12 });
                await expect
                    .poll(async () => {
                        const dragged = await swipePanel.boundingBox();
                        return dragged ? (dragged.x - swipeBounds.x) * direction : 0;
                    })
                    .toBeGreaterThan(80);
                await page.mouse.up();
            }
        }
        await swipeTip('Nền ảnh');
        await expect(tips.getByRole('heading', { name: 'Chọn nội dung phù hợp' })).toBeVisible();
        await expect(
            tips.getByRole('tab', { name: 'Nội dung phù hợp', selected: true }),
        ).toBeVisible();
        await tips.getByRole('tabpanel', { name: 'Nội dung phù hợp' }).scrollIntoViewIfNeeded();
        await expect(
            tips.getByRole('tabpanel', { name: 'Nội dung phù hợp' }).getByRole('img'),
        ).toHaveCount(1);
        await page.screenshot({
            path: info.outputPath('generate-3d-tip-content.png'),
            animations: 'disabled',
        });
        await tips.getByRole('tab', { name: 'Kết quả AI' }).click();
        await expect(
            tips.getByRole('heading', { name: 'Kết quả có thể khác ảnh gốc' }),
        ).toBeVisible();
        await tips.getByRole('tabpanel', { name: 'Kết quả AI' }).scrollIntoViewIfNeeded();
        await page.screenshot({
            path: info.outputPath('generate-3d-tip-result.png'),
            animations: 'disabled',
        });
        if (!dark) {
            const track = tips.getByRole('tabpanel', { name: 'Kết quả AI' }).locator('..');
            const trajectory = track.evaluate(async (element) => {
                const samples = [];
                const started = performance.now();
                await new Promise((resolve) => {
                    function frame() {
                        samples.push(
                            new DOMMatrixReadOnly(getComputedStyle(element).transform).m41,
                        );
                        if (performance.now() - started < 800) requestAnimationFrame(frame);
                        else resolve();
                    }
                    requestAnimationFrame(frame);
                });
                return { samples, width: element.getBoundingClientRect().width };
            });
            await swipeTip('Kết quả AI');
            const { samples, width } = await trajectory;
            const deltas = samples.slice(1).map((value, index) => value - samples[index]);
            expect(deltas.some((delta) => delta < -1)).toBe(true);
            expect(deltas.filter((delta) => delta > 1 && delta < width / 2)).toEqual([]);
        } else {
            await swipeTip('Kết quả AI');
        }
        await expect(
            tips.getByRole('heading', { name: 'Mẹo 1: Một vật thể mỗi ảnh', exact: true }),
        ).toBeInViewport();
        await swipeTip('Chủ thể', 1);
        await expect(
            tips.getByRole('heading', { name: 'Kết quả có thể khác ảnh gốc', exact: true }),
        ).toBeInViewport();
        if (dark) await openTips.click();
        else await tips.getByRole('tab', { name: 'Chủ thể' }).click();
        await expect(submit).toBeDisabled();
        await expect(submit).toBeInViewport({ ratio: 1 });
        await expect(dialog.getByRole('button', { name: 'Chọn ảnh', exact: true })).toHaveCount(0);
        await expect(dialog.getByText(/16 megapixel/)).toHaveCount(0);
        const uploadArea = dialog.getByRole('button', { name: 'Tải ảnh lên', exact: true });
        await uploadArea.focus();
        await expect(uploadArea).toBeFocused();
        const [chooser] = await Promise.all([
            page.waitForEvent('filechooser'),
            uploadArea.press('Enter'),
        ]);
        await chooser.setFiles({ name: 'invalid.gif', mimeType: 'image/gif', buffer: image });
        const uploadError = page.locator('[data-sonner-toast]').filter({
            hasText: 'Ảnh trang chỉ hỗ trợ JPG hoặc PNG.',
        });
        await expect(uploadError).toBeVisible();
        await expect(dialog.getByRole('alert')).toHaveCount(0);
        await expect(submit).toBeDisabled();
        await page.screenshot({
            path: info.outputPath('generate-3d-upload-error.png'),
            animations: 'disabled',
        });
        await dialog
            .locator('input[type=file]')
            .setInputFiles({ name: 'Rùa biển.png', mimeType: 'image/png', buffer: image });
        await expect(uploadError).toHaveCount(0);
        const preview = dialog.getByRole('img', { name: 'Xem trước hình ảnh' });
        await expect(preview).toBeVisible();
        await expect
            .poll(() => preview.evaluate((element) => element.naturalWidth))
            .toBeGreaterThan(0);
        await expect(dialog.getByRole('textbox')).toHaveCount(0);
        await expect(dialog.getByText('Rùa biển.png', { exact: true })).toHaveCount(0);
        const replaceImage = dialog.getByRole('button', { name: 'Đổi ảnh' });
        await expect(replaceImage).toBeInViewport();
        await expect(submit).toBeInViewport({ ratio: 1 });
        await expect
            .poll(async () => {
                const [button, replace, panel, dropzone] = await Promise.all([
                    submit.boundingBox(),
                    replaceImage.boundingBox(),
                    tips.boundingBox(),
                    dialog.getByRole('region', { name: 'Ảnh đầu vào' }).boundingBox(),
                ]);
                return Boolean(
                    button &&
                        replace &&
                        panel &&
                        dropzone &&
                        Math.abs(replace.y - button.y) < 2 &&
                        replace.x + replace.width <= button.x &&
                        button.width < dropzone.width &&
                        Math.abs(button.x + button.width - dropzone.x - dropzone.width) < 2 &&
                        button.y >= dropzone.y + dropzone.height &&
                        (dark ||
                            (panel.x + panel.width <= dropzone.x &&
                                Math.abs(panel.y - dropzone.y) < 2 &&
                                Math.abs(panel.height - dropzone.height) < 2)),
                );
            })
            .toBe(true);
        await dialog.getByRole('button', { name: 'Đóng tạo 3D', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await expect(page).toHaveURL(/\/assets\?type=IMAGE$/);
        await page.getByRole('link', { name: 'Tạo 3D từ ảnh', exact: true }).click();
        await expect(dialog).toBeVisible();
        await expect(preview).toHaveCount(0);
        await dialog
            .locator('input[type=file]')
            .setInputFiles({ name: 'Rùa biển.png', mimeType: 'image/png', buffer: image });
        await expect(preview).toBeVisible();
        expect(generationRequests).toEqual([]);
        await page.screenshot({ path: info.outputPath('generate-3d.png'), animations: 'disabled' });
        await submit.click();
        await expect(page).toHaveURL(/\/assets\?type=MODEL$/);
        await expect(dialog).toHaveCount(0);
        const progress = page.getByRole('progressbar', { name: 'Tiến độ tạo 3D từ Rùa biển' });
        await expect(progress).toBeVisible();
        await expect(page.getByText('Chưa tải được tiến độ tạo 3D.')).toBeVisible();
        releaseAssets();
        progressUnavailable = false;
        await page.getByRole('button', { name: 'Tải lại tiến độ' }).click();
        await expect(page.getByText('Chưa tải được tiến độ tạo 3D.')).toHaveCount(0);
        await expect(progress).toBeVisible();
        await page.reload();
        await expect(page.getByRole('heading', { name: '3D từ ảnh: Rùa biển' })).toBeVisible();
        job.status = 'FAILED';
        job.error = {
            code: 'MODEL_GENERATION_FAILED',
            message: 'Không tạo được mô hình. Hãy thử ảnh khác.',
        };
        await expect(page.getByText(job.error.message)).toBeVisible();
        await page.goto(`/assets?type=MODEL&job=${job.id}`);
        await expect(page.getByText(job.error.message)).toBeVisible();
        await expect(
            page.getByRole('heading', { name: '3D từ ảnh: Rùa biển' }).locator('..').locator('..'),
        ).toBeFocused();
        expect(
            generationRequests.filter(
                (request) => request === 'POST /api/v1/assets/model-generations',
            ),
        ).toHaveLength(1);
        expect(
            generationRequests.filter(
                (request) => request === 'POST /api/v1/assets/upload-signature',
            ),
        ).toHaveLength(1);
        expect(generationRequests.filter((request) => request.startsWith('PUT '))).toHaveLength(1);
        await expect(page.getByRole('button', { name: 'Xem mô hình mẫu' })).toHaveCount(0);

        await page.goto('/assets?type=IMAGE');
        await expect(
            page.getByRole('heading', { name: 'Chưa có tài nguyên thuộc loại này' }),
        ).toBeVisible();
    });
}
