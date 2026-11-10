import { expect, test } from '@playwright/test';

async function open(page, path = '/admin/users', suffix = '') {
    await page.goto(`/tests/browser/admin-merge.html?path=${encodeURIComponent(path)}${suffix}`);
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
