import { expect, test } from '@playwright/test';

test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

test.describe('stable admin overlays', () => {
    for (const theme of ['light', 'dark']) {
        test(`marker details keep the scrolled admin sidebar and header in place: ${theme}`, async ({
            page,
        }) => {
            await page.setViewportSize({ width: 1440, height: 900 });
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await page.addInitScript(
                (value) => localStorage.setItem('bookaria.theme', value),
                theme,
            );
            await open(page, '/admin/markers', '&scrollMarkers=1');
            const detail = page.getByRole('button', { name: 'Chi tiết', exact: true }).nth(3);
            await expect(detail).toBeVisible();
            await page.evaluate(() => document.fonts.ready.then(() => {}));
            await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }));
            await detail.scrollIntoViewIfNeeded();
            const sidebar = page.locator('[data-slot="sidebar"]');
            const header = page.locator('.admin-topbar');
            const before = {
                sidebar: await sidebar.boundingBox(),
                header: await header.boundingBox(),
                scroll: await page.evaluate(() => window.scrollY),
            };
            expect(before.scroll).toBeGreaterThan(0);
            await detail.click();
            const dialog = page.getByRole('dialog');
            await expect(dialog).toBeVisible();
            expect(await sidebar.boundingBox()).toEqual(before.sidebar);
            expect(await header.boundingBox()).toEqual(before.header);
            expect(await page.evaluate(() => window.scrollY)).toBe(before.scroll);
            await dialog.getByRole('button', { name: 'Đóng', exact: true }).first().click();
            await expect(dialog).toBeHidden();
            expect(await sidebar.boundingBox()).toEqual(before.sidebar);
            expect(await header.boundingBox()).toEqual(before.header);
            expect(await page.evaluate(() => window.scrollY)).toBe(before.scroll);
        });
    }
});

async function open(page, path = '/admin/users', suffix = '') {
    await page.goto(`/tests/browser/admin-merge.html?path=${encodeURIComponent(path)}${suffix}`);
}

for (const theme of ['light', 'dark']) {
    test(`admin sidebar collapses, keeps navigation and expands: ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.addInitScript((value) => localStorage.setItem('bookaria.theme', value), theme);
        await open(page, '/admin/library');
        const sidebar = page.locator('[data-slot="sidebar"]');
        const brand = page.locator('.admin-topbar > a');
        await expect(sidebar).toHaveAttribute('data-state', 'expanded');
        const active = sidebar.getByRole('link', { name: 'Thư viện dùng chung', exact: true });
        await expect(active).toHaveCSS('background-color', 'rgb(23, 23, 23)');
        await expect(active).toHaveCSS('color', 'rgb(255, 255, 255)');
        const icon = sidebar.locator('[data-slot="sidebar-menu-button"] svg').first();
        await expect(icon).toHaveCSS('width', '20px');
        const initialIconBox = await icon.boundingBox();
        await page.getByRole('button', { name: 'Thu gọn sidebar', exact: true }).click();
        const frames = await page.evaluate(async () => {
            const samples = [];
            for (let frame = 0; frame < 18; frame++) {
                await new Promise(requestAnimationFrame);
                const icon = document
                    .querySelector('[data-slot="sidebar-menu-button"] svg')
                    .getBoundingClientRect();
                const brand = document.querySelector('.admin-topbar > a').getBoundingClientRect();
                const sidebar = document
                    .querySelector('[data-slot="sidebar-container"]')
                    .getBoundingClientRect();
                const gap = document
                    .querySelector('[data-slot="sidebar-gap"]')
                    .getBoundingClientRect();
                samples.push({
                    iconX: icon.x,
                    edgeOffset: Math.abs(brand.right - sidebar.right),
                    gapOffset: Math.abs(gap.width - sidebar.width),
                });
            }
            return samples;
        });
        for (const frame of frames) {
            expect(Math.abs(frame.iconX - initialIconBox.x)).toBeLessThan(1);
            expect(frame.edgeOffset).toBeLessThan(1);
            expect(frame.gapOffset).toBeLessThan(1);
        }
        await expect(sidebar).toHaveAttribute('data-state', 'collapsed');
        await expect(sidebar).toHaveCSS('width', '72px');
        await expect(brand.locator('[aria-hidden="false"] img')).toHaveAttribute(
            'src',
            '/brand/bookaria-symbol.svg',
        );
        const users = page
            .getByRole('navigation', { name: 'Điều hướng quản trị' })
            .getByRole('link', { name: 'Người dùng', exact: true });
        await expect(users).toHaveCSS('width', '44px');
        await expect(users.locator('svg')).toHaveCSS('width', '20px');
        const buttonBox = await users.boundingBox();
        const iconBox = await users.locator('svg').boundingBox();
        expect(
            Math.abs(buttonBox.x + buttonBox.width / 2 - iconBox.x - iconBox.width / 2),
        ).toBeLessThan(0.5);
        expect(
            Math.abs(buttonBox.y + buttonBox.height / 2 - iconBox.y - iconBox.height / 2),
        ).toBeLessThan(0.5);
        await users.hover();
        await expect(page.getByRole('tooltip')).toContainText('Người dùng');
        await users.click();
        await expect(
            page.getByRole('heading', { name: 'Quản lý người dùng', exact: true }),
        ).toBeVisible();
        await expect(users).toHaveAttribute('aria-current', 'page');
        await expect(users).toHaveCSS('background-color', 'rgb(23, 23, 23)');
        await expect(users).toHaveCSS('color', 'rgb(255, 255, 255)');
        await expect(sidebar).toHaveAttribute('data-state', 'collapsed');
        await page.keyboard.press('Control+b');
        await expect(sidebar).toHaveAttribute('data-state', 'expanded');
        await expect(sidebar).toHaveCSS('width', '248px');
        await expect(brand.locator('[aria-hidden="false"] img')).toHaveAttribute(
            'src',
            '/brand/bookaria-wordmark.svg',
        );
        await expect(
            page.getByRole('button', { name: 'Thu gọn sidebar', exact: true }),
        ).toHaveAttribute('aria-expanded', 'true');
    });

    test(`admin sidebar uses a dismissible drawer on a small screen: ${theme}`, async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.addInitScript((value) => localStorage.setItem('bookaria.theme', value), theme);
        await open(page, '/admin/library');
        const trigger = page.getByRole('button', { name: 'Mở menu quản trị', exact: true });
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        await expect(page.getByRole('navigation', { name: 'Điều hướng quản trị' })).toHaveCount(0);
        await trigger.click();
        const drawer = page.getByRole('dialog');
        await expect(drawer).toBeVisible();
        await drawer.getByRole('link', { name: 'Người dùng', exact: true }).click();
        await expect(drawer).toBeHidden();
        await expect(
            page.getByRole('heading', { name: 'Quản lý người dùng', exact: true }),
        ).toBeVisible();
        await trigger.click();
        await drawer.getByRole('button', { name: 'Đóng menu quản trị', exact: true }).click();
        await expect(drawer).toBeHidden();
        await trigger.click();
        await page.keyboard.press('Escape');
        await expect(drawer).toBeHidden();
        await expect(trigger).toBeFocused();
        const box = await page.locator('.admin-topbar').boundingBox();
        expect(box.width).toBe(await page.evaluate(() => document.documentElement.clientWidth));
    });
}

test('dashboard shows library bytes separately from account storage', async ({ page }) => {
    await open(page, '/admin');
    const library = page.locator('main').getByRole('link', { name: /Thư viện dùng chung/ });
    await expect(library).toContainText('2 MiB');
    await expect(library).not.toContainText('9,8 MiB');
    const accounts = page.getByRole('link', { name: /Lưu trữ tài khoản/ });
    await expect(accounts).toContainText('9,8 MiB');
    await expect(accounts).toHaveAttribute('href', '/admin/users?sort=-storageUsedBytes');
});

for (const theme of ['light', 'dark']) {
    for (const route of [
        'users',
        'categories',
        'jobs',
        'books',
        'moderation',
        'library',
        'audit-logs',
    ]) {
        test(`admin ${route} filters align consistently: ${theme}`, async ({ page }) => {
            await page.setViewportSize({ width: 1440, height: 950 });
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await page.addInitScript(
                (value) => localStorage.setItem('bookaria.theme', value),
                theme,
            );
            await open(page, `/admin/${route}`);
            const controls = page.locator(
                '.admin-main form [data-slot="input-group"], .admin-main form input[data-slot="input"], .admin-main form [data-slot="select-trigger"]',
            );
            await expect(controls.first()).toBeVisible();
            const rows = await controls.evaluateAll((elements) =>
                elements.map((element) => {
                    const id = element.id || element.querySelector('input')?.id;
                    const label = element.closest('form').querySelector(`label[for="${id}"]`);
                    const control = element.getBoundingClientRect();
                    return {
                        id,
                        height: control.height,
                        gap: control.top - label.getBoundingClientRect().bottom,
                        labelMargin: getComputedStyle(label).marginBottom,
                    };
                }),
            );
            for (const row of rows) {
                expect(row.height, row.id).toBe(44);
                expect(row.gap, row.id).toBe(8);
                expect(row.labelMargin, row.id).toBe('0px');
            }
            const header = page.locator('.admin-topbar');
            await expect(header.getByRole('navigation', { name: 'Vị trí quản trị' })).toHaveCount(
                0,
            );
            expect((await header.boundingBox()).height).toBe(64);
            const brand = header.getByRole('link', { name: 'Bookaria - Trang chủ' });
            const brandBox = await brand.boundingBox();
            const sidebarBox = await page.locator('[data-slot="sidebar"]').boundingBox();
            expect(brandBox.x + brandBox.width).toBe(sidebarBox.x + sidebarBox.width);
            await expect(brand).toHaveCSS('border-bottom-width', '0px');
            await expect(brand).toHaveCSS('border-right-width', '1px');
            await expect(header).toHaveCSS('border-bottom-width', '0px');
            await expect(header.locator(':scope > div')).toHaveCSS('border-bottom-width', '1px');
            if (route === 'jobs') {
                const checkbox = page.locator('#auto-refresh-monitor');
                const label = page.locator('label[for="auto-refresh-monitor"]');
                const box = await checkbox.boundingBox();
                const text = await label.boundingBox();
                expect(Math.abs(box.y + box.height / 2 - text.y - text.height / 2)).toBeLessThan(1);
                await label.click();
                await expect(checkbox).toBeChecked();
            }
            if (route === 'categories') {
                await page.getByLabel('Tìm kiếm danh mục', { exact: true }).fill('Mô hình');
                await expect(page.locator('#category-q')).toHaveValue('Mô hình');
                await page.getByRole('button', { name: 'Xóa từ khóa', exact: true }).click();
                await expect(page.locator('#category-q')).toHaveValue('');
            }
        });
    }
}

async function fillCreate(page) {
    await page.getByRole('button', { name: 'Tạo người dùng', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('#create-display-name').fill('Người dùng mới');
    await dialog.locator('#create-email').fill('new@example.test');
    await dialog.locator('#create-password').fill('password123');
    return dialog;
}

test('admin users create submits once for two synchronous submits and closes after acknowledgement', async ({
    page,
}) => {
    await open(page);
    const dialog = await fillCreate(page);
    await dialog.locator('form').evaluate((form) => {
        form.requestSubmit();
        form.requestSubmit();
    });
    await expect.poll(() => page.evaluate(() => window.adminReview.writes.length)).toBe(1);
    await expect(dialog.getByRole('button', { name: 'Đang tạo…' })).toBeDisabled();
    await page.evaluate(() => window.adminReview.release());
    await expect(dialog).toBeHidden();
    expect(await page.evaluate(() => window.adminReview.writes[0].data.email)).toBe(
        'new@example.test',
    );
});

test('uncertain create error requires checking state before sending another write', async ({
    page,
}) => {
    await open(page, '/admin/users', '&fail=1');
    const dialog = await fillCreate(page);
    await dialog.locator('form').evaluate((form) => form.requestSubmit());
    await expect.poll(() => page.evaluate(() => window.adminReview.writes.length)).toBe(1);
    await page.evaluate(() => window.adminReview.release());
    await expect(dialog.getByText(/Tải lại trang để kiểm tra trạng thái/)).toBeVisible();
    await dialog.locator('form').evaluate((form) => form.requestSubmit());
    await expect(dialog.getByText(/Tải lại trang để kiểm tra trạng thái/)).toBeVisible();
    expect(await page.evaluate(() => window.adminReview.writes.length)).toBe(1);
});

test('modal mutation ignores success from a previous administrator', async ({ page }) => {
    await open(page, '/probe');
    await page.getByRole('button', { name: 'Gửi probe hai lần' }).click();
    await expect.poll(() => page.evaluate(() => window.adminReview.writes.length)).toBe(1);
    await page.evaluate(() => {
        window.adminReview.switchActor();
        window.adminReview.release();
    });
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.adminReview.successes)).toBe(0);
});

for (const path of [
    '/admin',
    '/admin/users',
    '/admin/moderation',
    '/admin/books',
    '/admin/library',
    '/admin/categories',
    '/admin/markers',
    '/admin/jobs',
    '/admin/audit-logs',
]) {
    test(`admin route ${path} renders with validated data and no application errors`, async ({
        page,
    }) => {
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await open(page, path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect
            .poll(() => page.evaluate(() => window.adminReview.reads.length))
            .toBeGreaterThan(0);
        await expect(page.getByText('Unexpected Application Error!')).toHaveCount(0);
        await expect(page.getByText('Dữ liệu máy chủ không đúng định dạng')).toHaveCount(0);
        expect(errors).toEqual([]);
    });
}

test('admin detail retains marker analysis status after merging the new page cards', async ({
    page,
}) => {
    await open(page, '/admin/books/66666666-6666-4666-8666-000000000010');
    await expect(page.getByText('1 đối tượng · Marker: Cần phân tích lại')).toBeVisible();
});

test('user deactivation is described as locking rather than permanent deletion', async ({
    page,
}) => {
    await open(page);
    await page
        .getByRole('button', { name: 'Vô hiệu hóa tài khoản người dùng', exact: true })
        .click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog.getByText(/dữ liệu không bị xóa/)).toBeVisible();
    await expect(dialog.getByText(/vĩnh viễn/)).toHaveCount(0);
});

for (const setup of [
    { name: 'desktop-light', width: 1280, height: 900, theme: 'light' },
    { name: 'phone-dark', width: 390, height: 844, theme: 'dark' },
]) {
    test(`admin create modal ${setup.name} keeps fields and actions within the viewport`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width: setup.width, height: setup.height });
        await page.emulateMedia({ colorScheme: setup.theme });
        await open(page);
        const dialog = await fillCreate(page);
        await expect(
            dialog.getByRole('button', { name: 'Tạo tài khoản', exact: true }),
        ).toBeVisible();
        const bounds = await dialog.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.y).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(setup.width + 1);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(setup.height + 1);
        expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
            true,
        );
        await page.screenshot({ path: info.outputPath(`admin-${setup.name}.png`) });
    });
}

for (const legacy of [false, true]) {
    test(`marker assessment is neutral across list/detail/toggle for ${legacy ? 'legacy stars' : 'unassessed markers'}`, async ({
        page,
    }) => {
        await open(page, '/admin/markers', legacy ? '&legacyMarkerScore=1' : '');
        await expect(page.getByText('Chưa đánh giá', { exact: true })).toBeVisible();
        await expect(page.getByText(/Điểm:.*\/100|Điểm chất lượng:|Cần cải thiện/)).toHaveCount(0);
        await page.getByRole('button', { name: 'Chi tiết', exact: true }).click();
        const detail = page.getByRole('dialog');
        await expect(detail.getByText('Chưa đánh giá', { exact: true })).toBeVisible();
        await expect(detail.getByText(/Chưa có kết quả phân tích được lưu/)).toBeVisible();
        await expect(detail.getByText(/\/100|Cần cải thiện/)).toHaveCount(0);
        await detail.getByRole('button', { name: 'Đóng', exact: true }).first().click();
        await page.getByRole('button', { name: 'Tắt marker', exact: true }).click();
        const toggle = page.getByRole('dialog');
        await expect(toggle.getByText('Chưa đánh giá', { exact: true })).toBeVisible();
        await expect(toggle.getByText(/\/100|Điểm chất lượng:/)).toHaveCount(0);
        expect(await page.evaluate(() => window.adminReview.writes)).toEqual([]);
    });
}
