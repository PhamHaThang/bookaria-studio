import assert from 'node:assert/strict';
import { expect, test } from '@playwright/test';

for (const [width, theme, failOnce] of [
    [1440, 'light', true],
    [1440, 'dark', false],
    [390, 'light', false],
]) {
    test(`notifications scroll, filter, mark read and recover from errors: ${theme} ${width}`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 950 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const errors = [],
            calls = [],
            reads = [];
        let failedPage = false,
            failedRead = false;
        let rows = Array.from({ length: 33 }, (_, i) => ({
            id: `22222222-2222-4222-8222-${String(i + 1).padStart(12, '0')}`,
            type: i % 4 === 0 ? 'JOB_FAILED' : 'JOB_SUCCEEDED',
            title: `${i % 4 === 0 ? 'Cần kiểm tra bản xuất bản' : 'Xuất bản hoàn tất'} ${i + 1}`,
            body: `Sách “Rùa và thỏ”: ${i % 4 === 0 ? 'Có tài nguyên chưa xử lý xong. Hãy mở sách để kiểm tra và thử xuất bản lại.' : 'Nội dung đã sẵn sàng để chia sẻ với người đọc.'}`,
            link: i === 1 ? null : '/profile',
            readAt: i % 2 === 0 || i === 1 ? null : '2026-11-07T13:40:00Z',
            createdAt: new Date(Date.UTC(2026, 10, 7, 13, 45 - i)).toISOString(),
        }));
        const me = {
            id: '11111111-1111-4111-8111-111111111111',
            email: 'author@bookaria.vn',
            displayName: 'Nguyễn Minh Anh',
            avatarUrl: null,
            organization: null,
            bio: null,
            role: 'AUTHOR',
            emailVerified: true,
            storage: { usedBytes: 12000000, quotaBytes: 500000000 },
            createdAt: '2026-10-22T00:00:00Z',
        };
        page.on('pageerror', (e) => errors.push(e.message));
        await page.addInitScript((theme) => localStorage.setItem('bookaria.theme', theme), theme);
        await page.route('**/api/v1/**', async (route) => {
            const req = route.request(),
                url = new URL(req.url()),
                path = url.pathname;
            if (path.endsWith('/auth/refresh'))
                return route.fulfill({
                    json: { data: { accessToken: 'test-token', expiresIn: 3600 } },
                });
            if (path.endsWith('/me')) return route.fulfill({ json: { data: me } });
            if (path.endsWith('/me/notifications/read')) {
                const body = req.postDataJSON();
                reads.push(body);
                if (failOnce && !failedRead && body.ids) {
                    failedRead = true;
                    return route.fulfill({
                        status: 500,
                        json: { error: { message: 'Chưa cập nhật được thông báo.' } },
                    });
                }
                rows = rows.map((row) =>
                    body.all || body.ids?.includes(row.id)
                        ? { ...row, readAt: new Date().toISOString() }
                        : row,
                );
                return route.fulfill({ status: 204 });
            }
            if (path.endsWith('/me/notifications')) {
                const p = Number(url.searchParams.get('page') || 1),
                    limit = Number(url.searchParams.get('limit') || 12),
                    onlyUnread = url.searchParams.get('unread') === 'true';
                calls.push({ p, limit, onlyUnread });
                if (failOnce && !failedPage && p === 2 && !onlyUnread && limit === 12) {
                    failedPage = true;
                    return route.fulfill({
                        status: 500,
                        json: { error: { message: 'Chưa tải được thông báo.' } },
                    });
                }
                const data = rows.filter((row) => !onlyUnread || !row.readAt);
                return route.fulfill({
                    json: {
                        data: data.slice((p - 1) * limit, p * limit),
                        meta: {
                            page: p,
                            limit,
                            total: data.length,
                            totalPages: Math.ceil(data.length / limit),
                        },
                    },
                });
            }
            return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND' } } });
        });
        await page.goto('/help');
        const bell = page.locator('header.site-header').getByRole('button', { name: /^Thông báo/ });
        await bell.click();
        const dialog = page.getByRole('dialog', { name: 'Thông báo', exact: true });
        const list = dialog.getByRole('list', { name: 'Danh sách thông báo' });
        const viewport = dialog.locator('[data-slot="scroll-area-viewport"]');
        const scrollEnd = () =>
            viewport.evaluate((el) => {
                el.scrollTop = el.scrollHeight;
            });
        await expect(list.locator(':scope > li')).toHaveCount(12);
        await expect(dialog.getByRole('button', { name: 'Xem nội dung', exact: true })).toHaveCount(
            0,
        );
        await expect(dialog.getByRole('button', { name: 'Đã đọc', exact: true })).toHaveCount(0);
        await expect(dialog.getByRole('navigation', { name: 'Phân trang thông báo' })).toHaveCount(
            0,
        );
        const box = await dialog.boundingBox();
        assert(box.x >= 0 && box.x + box.width <= width && box.y + box.height <= 950);
        await scrollEnd();
        if (failOnce) {
            await expect(
                dialog.getByRole('button', { name: 'Thử tải lại', exact: true }),
            ).toBeVisible();
            await expect(list.locator(':scope > li')).toHaveCount(12);
            const attempts = calls.filter((call) => call.p === 2 && !call.onlyUnread).length;
            await page.waitForTimeout(250);
            assert.equal(calls.filter((call) => call.p === 2 && !call.onlyUnread).length, attempts);
            await dialog.getByRole('button', { name: 'Thử tải lại', exact: true }).click();
        }
        await expect(list.locator(':scope > li')).toHaveCount(24);
        await scrollEnd();
        await expect(list.locator(':scope > li')).toHaveCount(33);
        await expect(dialog.getByText('Đã xem hết thông báo', { exact: true })).toBeVisible();
        const titles = await list
            .locator('li')
            .evaluateAll((elements) => elements.map((el) => el.textContent));
        assert.equal(new Set(titles).size, 33);
        assert.equal(calls.filter((call) => call.p === 4).length, 0);
        await dialog.getByRole('radio', { name: 'Chưa đọc', exact: true }).click();
        await expect(list.locator(':scope > li')).toHaveCount(12);
        await expect.poll(() => viewport.evaluate((el) => el.scrollTop)).toBe(0);
        await scrollEnd();
        await expect(list.locator(':scope > li')).toHaveCount(18);
        const noTarget = list.getByRole('button', {
            name: /Đánh dấu đã đọc: Xuất bản hoàn tất 2$/,
        });
        await noTarget.click();
        if (failOnce) {
            await expect(dialog.getByRole('alert')).toBeVisible();
            await expect(page).toHaveURL(/\/help$/);
            await noTarget.click();
        }
        await expect(list.locator(':scope > li')).toHaveCount(17);
        await list.getByRole('link', { name: /Cần kiểm tra bản xuất bản 1 / }).click();
        await expect(page).toHaveURL(/\/profile$/);
        await expect(dialog).toBeHidden();
        assert(reads.some((body) => body.ids?.includes('22222222-2222-4222-8222-000000000001')));
        await bell.click();
        const nextDialog = page.getByRole('dialog', { name: 'Thông báo', exact: true });
        await nextDialog.getByRole('radio', { name: 'Chưa đọc', exact: true }).click();
        await nextDialog
            .getByRole('button', { name: 'Đánh dấu tất cả đã đọc', exact: true })
            .click();
        await expect(
            nextDialog.getByRole('heading', { name: 'Bạn đã đọc hết thông báo', exact: true }),
        ).toBeVisible();
        await expect(bell.locator('[data-variant="dot"]')).toHaveCount(0);
        await expect(bell).toHaveAttribute('aria-label', 'Thông báo, 0 chưa đọc');
        assert.deepEqual(errors, []);
    });
}
