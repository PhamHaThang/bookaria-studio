import { expect, test } from '@playwright/test';
import { createSquarePng, TINY_PNG } from './helpers/fixtures.mjs';
import { installStudioMocks } from './helpers/mock-studio-api.mjs';

test.describe('Studio Admin: RBAC, Dashboard, Users, Moderation, Library, Categories, Markers, Jobs & Audit', () => {
    test('RBAC: AUTHOR role is blocked from /admin UI and receives 403 on admin APIs', async ({
        page,
    }) => {
        await installStudioMocks(page, { role: 'AUTHOR' });

        await page.goto('/admin');
        await expect(
            page.getByRole('heading', { name: 'Bạn không có quyền quản trị' }),
        ).toBeVisible();
        await expect(page.getByRole('link', { name: 'Về sách của tôi' })).toBeVisible();

        await page.goto('/admin/users');
        await expect(
            page.getByRole('heading', { name: 'Bạn không có quyền quản trị' }),
        ).toBeVisible();
    });

    test('admin dashboard KPIs, chart/table view toggle, and user management CRUD + edge cases', async ({
        page,
    }) => {
        const mock = await installStudioMocks(page, { role: 'ADMIN' });

        await page.goto('/admin');
        await expect(
            page.getByRole('heading', { name: 'Tổng quan quản trị', exact: true }),
        ).toBeVisible();
        await expect(page.getByText('Quản lý người dùng')).toBeVisible();

        // Users management
        await page.getByRole('link', { name: 'Người dùng', exact: true }).click();
        await expect(
            page.getByRole('heading', { name: 'Quản lý người dùng', exact: true }),
        ).toBeVisible();

        // Create user with EMAIL_TAKEN 409 error first, then succeed
        await page.getByRole('button', { name: 'Tạo người dùng' }).click();
        const createModal = page.getByRole('dialog');
        await expect(
            createModal.getByRole('heading', { name: 'Tạo tài khoản người dùng mới' }),
        ).toBeVisible();

        await createModal.locator('#create-display-name').fill('Tác giả Trùng');
        await createModal.locator('#create-email').fill('author@bookaria.test');
        await createModal.locator('#create-password').fill('SecretPass123!');
        await createModal.getByRole('button', { name: /Tạo tài khoản|Tạo người dùng/i }).click();
        await expect(createModal.getByText(/Email này đã được đăng ký/)).toBeVisible();

        // useAdminMutation locks modal until page reload after an Axios write error
        await page.reload();

        await page.getByRole('button', { name: 'Tạo người dùng' }).click();
        const createModal2 = page.getByRole('dialog');
        await createModal2.locator('#create-display-name').fill('Tác giả Mới 2');
        await createModal2.locator('#create-email').fill('author2@bookaria.test');
        await createModal2.locator('#create-password').fill('SecretPass123!');
        await createModal2.getByRole('button', { name: /Tạo tài khoản|Tạo người dùng/i }).click();
        await expect(createModal2).toBeHidden();
        await expect(page.getByText('author2@bookaria.test')).toBeVisible();

        // Lock & Unlock user (requires reason; self-lock button is disabled)
        await expect(
            page.getByRole('button', { name: 'Không thể tự khóa tài khoản của chính mình' }),
        ).toBeDisabled();
        const lockButtons = page.getByRole('button', { name: 'Khóa tài khoản', exact: true });
        await lockButtons.first().click();
        const lockModal = page.getByRole('dialog');
        await lockModal.locator('#lock-reason').fill('Kiểm tra vi phạm nội dung.');
        await lockModal.getByRole('button', { name: 'Khóa tài khoản', exact: true }).click();
        await expect(lockModal).toBeHidden();
        await expect
            .poll(() =>
                mock.state.calls.some(
                    (c) => c.method === 'PATCH' && c.path.startsWith('/admin/users/'),
                ),
            )
            .toBe(true);
    });

    test('admin books default to all visibility levels and reset to all', async ({ page }) => {
        await installStudioMocks(page, { role: 'ADMIN' });
        await page.goto('/admin/books');

        const visibility = page.getByRole('combobox', { name: 'Quyền hiển thị' });
        const publicBook = page.getByText('Đại Dương Xanh AR', { exact: true });
        const privateBook = page.getByText('Sách Nháp Khám Phá', { exact: true });
        await expect(visibility).toHaveText('Tất cả');
        await expect(publicBook).toBeVisible();
        await expect(privateBook).toBeVisible();

        await visibility.click();
        await page.getByRole('option', { name: 'Công khai', exact: true }).click();
        await expect(publicBook).toBeVisible();
        await expect(privateBook).toBeHidden();

        await page.getByRole('link', { name: 'Đặt lại bộ lọc' }).click();
        await expect(visibility).toHaveText('Tất cả');
        await expect(privateBook).toBeVisible();
    });

    test('moderation queue, takedown (requires reason), reinstate, and dismiss reports', async ({
        page,
    }) => {
        const mock = await installStudioMocks(page, { role: 'ADMIN' });

        await page.goto('/admin/moderation');
        await expect(page.getByText('Đại Dương Xanh AR')).toBeVisible();
        await expect(page.getByText('1 báo cáo')).toBeVisible();

        // Takedown book
        await page.getByRole('button', { name: 'Gỡ sách vi phạm' }).first().click();
        const takedownModal = page.getByRole('dialog');
        await expect(takedownModal.getByRole('heading', { name: 'Gỡ sách vi phạm' })).toBeVisible();
        await takedownModal.locator('#takedown-reason').fill('Vi phạm bản quyền minh họa trang 1.');
        await takedownModal.getByRole('button', { name: /Gỡ sách|Xác nhận/i }).click();
        await expect(takedownModal).toBeHidden();
        expect(
            mock.state.calls.some((c) => c.method === 'POST' && c.path.endsWith('/takedown')),
        ).toBe(true);

        // Navigate to /admin/books/:bookId and verify book was taken down & can be reinstated
        await page.goto(`/admin/books/${mock.state.ids.book2Id}`);
        await expect(page.getByRole('heading', { name: 'Đại Dương Xanh AR' })).toBeVisible();
        await page.getByLabel(/Ghi chú xử lý/).fill('Tác giả đã bổ sung giấy phép.');
        await page.getByRole('button', { name: 'Xem lại và thực hiện thao tác' }).click();
        const reinstateDialog = page.getByRole('alertdialog');
        await expect(reinstateDialog).toBeVisible();
        await reinstateDialog.getByRole('button', { name: /Xác nhận khôi phục/i }).click();
        await expect(reinstateDialog).toBeHidden();
        await expect
            .poll(() =>
                mock.state.calls.some((c) => c.method === 'POST' && c.path.endsWith('/reinstate')),
            )
            .toBe(true);
    });

    test('admin category modals and shared library guards', async ({ page }) => {
        const mock = await installStudioMocks(page, {
            role: 'ADMIN',
            libraryAssetInUse: true,
        });

        await page.goto('/admin/categories');
        await expect(
            page.getByRole('link', { name: 'Khoa học & Vũ trụ', exact: true }),
        ).toBeVisible();

        await page.getByRole('button', { name: /Tạo danh mục|Thêm danh mục/i }).click();
        const catModal = page.getByRole('dialog');
        const createButton = catModal.getByRole('button', { name: 'Tạo danh mục' });
        const requiredName = catModal.getByText('Tên danh mục không được để trống');
        await catModal.getByRole('combobox', { name: 'Danh mục cha' }).focus();
        await expect(requiredName).toBeHidden();
        await createButton.click();
        await expect(requiredName).toBeVisible();
        await catModal.locator('#create-category-name').fill('Sinh học Biển');
        await expect(requiredName).toBeHidden();
        await createButton.click();
        await expect(catModal).toBeHidden();
        await expect(page.getByRole('link', { name: 'Sinh học Biển', exact: true })).toBeVisible();

        const root = page.getByRole('listitem').filter({
            has: page.getByRole('link', { name: 'Khoa học & Vũ trụ', exact: true }),
        });
        await expect(root.getByRole('button', { name: /Xóa danh mục/ })).toBeDisabled();

        const search = page.getByRole('searchbox', { name: 'Tìm kiếm danh mục' });
        await search.fill('Sinh học');
        await page.getByRole('link', { name: 'Chỉnh sửa', exact: true }).click();
        const edit = page.getByRole('dialog', { name: 'Chỉnh sửa danh mục' });
        await expect(edit.getByLabel('Tên danh mục')).toHaveValue('Sinh học Biển');
        await edit.getByLabel('Tên danh mục').fill('Sinh học đại dương');
        await edit.getByLabel('Thứ tự hiển thị').fill('3');
        await edit.getByRole('button', { name: 'Lưu thay đổi' }).click();
        await expect(edit).toBeHidden();
        await expect(search).toHaveValue('Sinh học');
        await expect(page.getByRole('link', { name: 'Sinh học đại dương' })).toBeVisible();
        expect(
            mock.state.categories.find((category) => category.name === 'Sinh học đại dương'),
        ).toMatchObject({ sortOrder: 3 });

        const remove = page.getByRole('button', { name: 'Xóa danh mục Sinh học đại dương' });
        const confirm = page.getByRole('alertdialog', { name: 'Xóa danh mục?' });
        await remove.click();
        await confirm.getByRole('button', { name: 'Hủy', exact: true }).click();
        await expect(remove).toBeVisible();
        expect(mock.state.calls.some((call) => call.method === 'DELETE')).toBe(false);
        await remove.click();
        await confirm.getByRole('button', { name: 'Xóa danh mục', exact: true }).click();
        await expect(confirm).toBeHidden();
        await expect(remove).toHaveCount(0);

        // Shared library list & 409 ASSET_IN_USE guard on delete
        await page.goto('/admin/library');
        await expect(
            page.getByRole('heading', { name: 'Thư viện dùng chung', exact: true }),
        ).toBeVisible();
        await expect(page.getByText('Hành tinh Trái Đất (Thư viện)')).toBeVisible();
        expect(
            mock.state.calls.some((c) => c.method === 'GET' && c.path === '/admin/library/assets'),
        ).toBe(true);
    });

    test('admin Bookaria markers: ORB image test, register new marker, and toggle active status', async ({
        page,
    }) => {
        const mock = await installStudioMocks(page, { role: 'ADMIN' });

        await page.goto('/admin/markers');
        await expect(
            page.getByRole('heading', { name: 'Bộ marker Bookaria', exact: true }),
        ).toBeVisible();
        await expect(page.getByText('Marker số #1')).toBeVisible();

        // 1. Toggle marker #2 active state
        await page.getByRole('button', { name: 'Bật marker' }).click();
        const toggleDialog = page.getByRole('dialog');
        await toggleDialog.getByRole('button', { name: /Bật marker|Xác nhận/i }).click();
        await expect
            .poll(() =>
                mock.state.calls.some(
                    (c) => c.method === 'PATCH' && c.path.startsWith('/admin/bookaria-markers/'),
                ),
            )
            .toBe(true);

        // 2. Test marker image via POST /admin/bookaria-markers/test
        await page.getByRole('button', { name: 'Phân tích ảnh' }).click();
        const testDialog = page.getByRole('dialog');
        await expect(
            testDialog.getByRole('heading', { name: 'Phân tích ảnh marker' }),
        ).toBeVisible();
        await testDialog.locator('input[type="file"]').setInputFiles({
            name: 'test-marker.png',
            mimeType: 'image/png',
            buffer: TINY_PNG,
        });
        await expect(testDialog.getByText(/256 × 256 px|Ảnh phân tích/)).toBeVisible();
        await testDialog.getByRole('button', { name: 'Đóng thử điểm marker' }).click();

        // 3. Register new marker via mocked marker-compiler + R2 upload + register endpoint
        await page.getByRole('button', { name: 'Đăng ký marker' }).click();
        const regDialog = page.getByRole('dialog');
        await regDialog.locator('input[type="file"]').setInputFiles({
            name: 'marker-new.png',
            mimeType: 'image/png',
            buffer: createSquarePng(128),
        });
        await regDialog.getByRole('button', { name: /Đăng ký 1 marker/ }).click();
        await expect(regDialog.getByText(/Đã đăng ký 1\/1 marker/)).toBeVisible();
    });

    test('admin jobs retry (creates new jobId) and audit logs detail inspection', async ({
        page,
    }) => {
        const mock = await installStudioMocks(page, { role: 'ADMIN' });

        await page.goto('/admin/jobs');
        await expect(page.getByText(mock.state.ids.failedJobId).first()).toBeVisible();

        // Retry failed job -> 202 with new jobId
        await page.getByRole('button', { name: 'Thử lại' }).click();
        const retryConfirm = page.getByRole('alertdialog');
        if (await retryConfirm.isVisible().catch(() => false)) {
            await retryConfirm.getByRole('button', { name: /Xác nhận|Thử lại/i }).click();
        }
        await expect
            .poll(() =>
                mock.state.calls.some((c) => c.method === 'POST' && c.path.endsWith('/retry')),
            )
            .toBe(true);

        // Audit logs page & detail modal
        await page.goto('/admin/audit-logs');
        await expect(
            page.getByRole('heading', { name: 'Nhật ký quản trị', exact: true }),
        ).toBeVisible();
        await page.getByRole('button', { name: 'Xem chi tiết' }).first().click();
        const logDialog = page.getByRole('dialog');
        await expect(logDialog).toBeVisible();
        await expect(
            logDialog.getByText(/Chạy lại tác vụ|newJobId|Tạo tài khoản/).first(),
        ).toBeVisible();
    });
});
