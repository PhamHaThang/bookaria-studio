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

        const nameError = createModal.getByText('Vui lòng nhập họ tên / tên hiển thị');
        const emailError = createModal.getByText('Vui lòng nhập địa chỉ email');
        await createModal.getByLabel('Địa chỉ email').focus();
        await createModal.getByRole('combobox', { name: 'Hạn mức lưu trữ' }).focus();
        await expect(nameError).toHaveCount(0);
        await expect(emailError).toHaveCount(0);
        await createModal.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
        await expect(nameError).toBeVisible();
        await expect(emailError).toBeVisible();

        await createModal.locator('#create-display-name').fill('Tác giả Trùng');
        await createModal.locator('#create-email').fill('author@bookaria.test');
        await createModal.locator('#create-password').fill('SecretPass123!');
        await createModal.getByRole('button', { name: /Tạo tài khoản|Tạo người dùng/i }).click();
        await expect(
            page.locator('[data-sonner-toast]').getByText(/Email này đã được đăng ký/),
        ).toBeVisible();

        // useAdminMutation locks modal until page reload after an Axios write error
        await page.reload();

        await page.getByRole('button', { name: 'Tạo người dùng' }).click();
        const createModal2 = page.getByRole('dialog');
        await createModal2.locator('#create-display-name').fill('Tác giả Mới 2');
        await createModal2.locator('#create-email').fill('author2@bookaria.test');
        await createModal2.locator('#create-password').fill('SecretPass123!');
        await createModal2.getByRole('combobox', { name: 'Hạn mức lưu trữ' }).click();
        await page.getByRole('option', { name: 'Tùy chỉnh', exact: true }).click();
        const amount = createModal2.getByLabel('Dung lượng tùy chỉnh');
        const unit = createModal2.getByRole('combobox', { name: 'Đơn vị dung lượng' });
        await unit.click();
        await page.getByRole('option', { name: 'GiB', exact: true }).click();
        await amount.fill('1,5');
        await unit.click();
        await page.getByRole('option', { name: 'MiB', exact: true }).click();
        await expect(amount).toHaveValue('1536');
        await createModal2.getByRole('button', { name: /Tạo tài khoản|Tạo người dùng/i }).click();
        await expect(createModal2).toBeHidden();
        await expect(page.getByText('author2@bookaria.test')).toBeVisible();
        expect(
            mock.state.calls.find(
                (call) => call.method === 'POST' && call.body?.email === 'author2@bookaria.test',
            )?.body.storageQuotaBytes,
        ).toBe(1536 * 1024 ** 2);

        const createdUser = page.getByRole('listitem').filter({ hasText: 'author2@bookaria.test' });
        await createdUser.getByRole('button', { name: 'Cập nhật tài khoản' }).click();
        const update = page.getByRole('dialog', { name: 'Cập nhật tài khoản người dùng' });
        const updateAmount = update.getByLabel('Dung lượng tùy chỉnh');
        await expect(updateAmount).toHaveValue('1,5');
        await updateAmount.clear();
        await update.getByRole('button', { name: 'Lưu thay đổi' }).click();
        await expect(
            update.getByText('Nhập dung lượng lớn hơn 0 và trong phạm vi cho phép.'),
        ).toBeVisible();
        expect(
            mock.state.calls.some(
                (call) => call.method === 'PATCH' && call.path.startsWith('/admin/users/'),
            ),
        ).toBe(false);
        await update.getByRole('combobox', { name: 'Hạn mức lưu trữ' }).click();
        await page.getByRole('option', { name: '2 GiB', exact: true }).click();
        await update.getByRole('button', { name: 'Lưu thay đổi' }).click();
        await expect(update).toBeHidden();
        expect(
            mock.state.calls.find(
                (call) => call.method === 'PATCH' && call.path.startsWith('/admin/users/'),
            )?.body.storageQuotaBytes,
        ).toBe(2 * 1024 ** 3);

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
                    (c) =>
                        c.method === 'PATCH' &&
                        c.path.startsWith('/admin/users/') &&
                        c.body?.status === 'LOCKED',
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
        await page.getByRole('button', { name: 'Xóa khỏi thư viện dùng chung' }).click();
        const removeShared = page.getByRole('dialog', { name: 'Xóa tài nguyên?' });
        await removeShared.getByRole('checkbox').check();
        await removeShared.getByRole('button', { name: 'Xác nhận xóa' }).click();
        await expect(page.locator('[data-sonner-toast][data-type="error"]')).toContainText(
            /tài nguyên đang được/i,
        );
        await expect(removeShared).toBeVisible();
        expect(mock.state.assets.has(mock.state.ids.libraryAssetId)).toBe(true);
    });

    test('shared library dialogs cover picking, sharing, editing and deleting an asset', async ({
        page,
    }) => {
        const mock = await installStudioMocks(page, { role: 'ADMIN' });
        const source = mock.state.assets.get(mock.state.ids.imageAssetId);
        const unavailable = mock.state.assets.get(mock.state.ids.audioAssetId);
        unavailable.status = 'PROCESSING';

        await page.goto('/admin/library');
        await page.getByRole('button', { name: 'Thêm tài nguyên', exact: true }).click();
        const picker = page.getByRole('dialog', { name: 'Chọn tài nguyên' });
        await expect(
            picker.getByRole('button', { name: new RegExp(unavailable.name) }),
        ).toBeDisabled();
        const search = picker.getByRole('searchbox', { name: 'Tìm tài nguyên cá nhân' });
        await search.fill(source.name);
        const choose = picker.getByRole('button', { name: new RegExp(source.name) });
        await choose.press('Enter');

        const share = page.getByRole('dialog', { name: 'Thông tin tài nguyên' });
        await expect(share.getByLabel('Tên tài nguyên')).toHaveValue(source.name);
        await share.getByRole('button', { name: 'Quay lại' }).click();
        await expect(search).toHaveValue(source.name);
        await choose.click();
        const shareLicense = share.getByRole('combobox', { name: /Giấy phép sử dụng/ });
        await expect(shareLicense).toHaveText('Chọn giấy phép');
        await shareLicense.click();
        const ccZero = page.getByRole('option', { name: 'CC0', exact: true });
        await expect(ccZero).toHaveAccessibleDescription(
            'Dùng, sửa và chia sẻ, kể cả thương mại. Không yêu cầu ghi công.',
        );
        await ccZero.click();
        await share.getByRole('button', { name: 'Thêm vào thư viện' }).click();
        await expect(share).toBeHidden();

        const row = page.getByRole('listitem').filter({ hasText: source.name });
        await row.getByRole('button', { name: 'Xem chi tiết tài nguyên' }).click();
        const detail = page.getByRole('dialog', { name: 'Chi tiết tài nguyên' });
        await expect(detail.getByRole('img', { name: 'Xem trước hình ảnh' })).toBeVisible();
        await expect(detail.getByText('CC0', { exact: true })).toBeVisible();
        await detail.getByRole('button', { name: 'Chỉnh sửa' }).click();
        const edit = page.getByRole('dialog', { name: 'Chỉnh sửa tài nguyên' });
        await edit.getByLabel('Tên tài nguyên').fill('Ảnh sử dụng trong thư viện');
        const editLicense = edit.getByRole('combobox', { name: /Giấy phép sử dụng/ });
        await expect(editLicense).toHaveText('CC0');
        await editLicense.click();
        await page.getByRole('option', { name: 'Giấy phép khác' }).click();
        await edit
            .getByRole('textbox', { name: 'Tên giấy phép khác' })
            .fill('Giấy phép của tác giả');
        await edit.getByRole('button', { name: 'Lưu thay đổi' }).click();
        await expect(edit).toBeHidden();

        const updatedRow = page
            .getByRole('listitem')
            .filter({ hasText: 'Ảnh sử dụng trong thư viện' });
        await updatedRow.getByRole('button', { name: 'Chỉnh sửa thông tin' }).click();
        await expect(editLicense).toHaveText('Giấy phép khác');
        await expect(edit.getByRole('textbox', { name: 'Tên giấy phép khác' })).toHaveValue(
            'Giấy phép của tác giả',
        );
        await edit.getByRole('button', { name: 'Hủy' }).click();
        await updatedRow.getByRole('button', { name: 'Xóa khỏi thư viện dùng chung' }).click();
        const remove = page.getByRole('dialog', { name: 'Xóa tài nguyên?' });
        const confirm = remove.getByRole('button', { name: 'Xác nhận xóa' });
        await expect(confirm).toBeDisabled();
        await remove.getByRole('checkbox').check();
        await confirm.click();
        await expect(remove).toBeHidden();
        await expect(updatedRow).toHaveCount(0);
    });

    test('shared library uploads a new file and saves its metadata in the same dialog', async ({
        page,
    }) => {
        const mock = await installStudioMocks(page, { role: 'ADMIN' });
        await page.setViewportSize({ width: 390, height: 700 });
        await page.goto('/admin/library');
        await page.getByRole('button', { name: 'Tải tài nguyên', exact: true }).click();
        const upload = page.getByRole('dialog', { name: 'Tải tệp mới', exact: true });
        await upload.locator('input[type="file"]').setInputFiles({
            name: 'minh-hoa-cu.png',
            mimeType: 'image/png',
            buffer: createSquarePng(128),
        });
        const preview = upload.getByRole('region', { name: 'Xem trước tài nguyên' });
        const fileChooser = page.waitForEvent('filechooser');
        await preview.getByRole('button', { name: 'Thay tệp' }).click();
        await (await fileChooser).setFiles({
            name: 'minh-hoa-moi.png',
            mimeType: 'image/png',
            buffer: createSquarePng(128),
        });
        await expect(upload.getByLabel('Tên tài nguyên')).toHaveValue('minh-hoa-moi');
        await expect(upload.getByText('Tệp tài nguyên', { exact: true })).toHaveCount(0);
        await upload.getByLabel('Tên tài nguyên').fill('Minh họa mới');
        const license = upload.getByRole('combobox', { name: /Giấy phép sử dụng/ });
        await license.click();
        await page.getByRole('option', { name: 'CC0', exact: true }).click();
        await upload.getByLabel(/Tác giả gốc/).fill('Tác giả minh họa');
        await upload.getByLabel(/Liên kết nguồn gốc/).fill('https://bookaria.test/minh-hoa');
        await upload.getByLabel(/Nhãn/).fill('minh họa, đại dương');
        await upload.getByRole('button', { name: 'Quay lại' }).click();
        const discard = page.getByRole('alertdialog', { name: 'Bỏ tệp đang chọn?' });
        await discard.getByRole('button', { name: 'Tiếp tục tải' }).click();
        await expect(upload.getByLabel('Tên tài nguyên')).toHaveValue('Minh họa mới');
        await upload.getByRole('button', { name: 'Tải lên', exact: true }).click();
        const next = upload.getByRole('button', { name: 'Thêm vào thư viện', exact: true });
        await expect(next).toBeEnabled();
        await expect(next).toBeInViewport();
        await expect(license).toHaveText('CC0');
        await expect(page).toHaveURL(/\/admin\/library$/);
        expect(page.context().pages()).toHaveLength(1);
        await next.click();
        await expect(upload).toBeHidden();
        await expect(page.getByText('Minh họa mới', { exact: true })).toBeVisible();
        expect(
            [...mock.state.assets.values()].find((asset) => asset.name === 'Minh họa mới'),
        ).toMatchObject({
            scope: 'library',
            license: 'CC0',
            authorName: 'Tác giả minh họa',
            sourceUrl: 'https://bookaria.test/minh-hoa',
            tags: ['minh họa', 'đại dương'],
        });
    });

    test('admin Bookaria markers: ORB image test, register new marker, and toggle active status', async ({
        page,
    }) => {
        const mock = await installStudioMocks(page, { role: 'ADMIN' });

        await page.goto('/admin/markers');
        await expect(
            page.getByRole('heading', { name: 'Quản lý marker', exact: true }),
        ).toBeVisible();
        await expect(page.getByText('Marker số #1')).toBeVisible();

        // 1. Open marker details and enable it from the confirmation dialog.
        const markerName = page.getByRole('button', { name: 'Marker số #2', exact: true });
        await markerName.click();
        const detail = page.getByRole('dialog', { name: 'Chi tiết marker số #2', exact: true });
        await expect(detail.getByRole('link', { name: 'Ảnh gốc' })).toBeVisible();
        await expect(detail.getByText('Tạm dừng cấp phát mới')).toBeVisible();
        await detail.getByRole('button', { name: 'Đánh giá ảnh', exact: true }).click();
        const evaluation = page.getByRole('dialog', { name: 'Đánh giá marker số #2', exact: true });
        await expect(evaluation.locator('input[type="file"]')).toHaveCount(0);
        await expect(
            evaluation.getByRole('img', { name: 'Phân bố điểm: 2%', exact: true }),
        ).toBeVisible();
        await evaluation.getByRole('button', { name: 'Lưu đánh giá', exact: true }).click();
        await expect(
            detail.getByRole('heading', { name: 'Đánh giá gần nhất', exact: true }),
        ).toBeVisible();
        await expect(
            detail.getByRole('img', { name: 'Phân bố điểm: 2%', exact: true }),
        ).toBeVisible();
        const writes = () =>
            mock.state.calls.filter(
                ({ method, path }) => method === 'PUT' && path.endsWith('/assessment'),
            );
        expect(writes()).toHaveLength(1);
        expect(writes()[0].body).toMatchObject({ distribution: 0.02, uniqueness: 1, dimension: 1 });

        await detail.getByRole('button', { name: 'Đánh giá lại', exact: true }).click();
        const reassessment = page.getByRole('dialog', {
            name: 'Đánh giá lại marker số #2',
            exact: true,
        });
        await expect(
            reassessment.getByRole('button', { name: 'Lưu đánh giá', exact: true }),
        ).toBeVisible();
        await reassessment.getByRole('button', { name: 'Đóng', exact: true }).last().click();
        await expect(
            detail.getByRole('heading', { name: 'Đánh giá gần nhất', exact: true }),
        ).toBeVisible();
        expect(writes()).toHaveLength(1);

        await detail.getByRole('button', { name: 'Bật marker', exact: true }).click();
        const toggleDialog = page.getByRole('dialog', { name: 'Bật marker số #2?', exact: true });
        await toggleDialog.getByRole('button', { name: 'Bật marker', exact: true }).click();
        await expect
            .poll(() =>
                mock.state.calls.some(
                    (c) =>
                        c.method === 'PATCH' &&
                        c.path.startsWith('/admin/bookaria-markers/') &&
                        c.body?.isActive === true,
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
        await testDialog.locator('[data-slot="dialog-close"]').click();

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
        const failedJob = page
            .getByRole('listitem')
            .filter({ hasText: mock.state.ids.failedJobId });
        await expect(failedJob).toBeVisible();
        await failedJob.getByRole('link', { name: 'Nhật ký quản trị', exact: true }).click();
        await expect(
            page.getByRole('heading', { name: 'Chưa có nhật ký quản trị cho tác vụ này' }),
        ).toBeVisible();
        await page.getByRole('link', { name: 'Về trang Tác vụ', exact: true }).click();

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

        const retryHistory = page.getByRole('link', { name: 'Xem nhật ký thử lại', exact: true });
        await expect(retryHistory).toBeVisible();
        const retryLog = mock.state.auditLogs.find(
            (log) => log.target.id === mock.state.ids.failedJobId,
        );
        expect(retryLog?.detail?.newJobId).toBeTruthy();
        const newJob = page.getByRole('listitem').filter({ hasText: retryLog.detail.newJobId });
        await newJob.getByRole('link', { name: 'Nhật ký quản trị', exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`targetId=${retryLog.detail.newJobId}`));
        await expect(
            page.getByRole('heading', { name: 'Nhật ký quản trị', exact: true }),
        ).toBeVisible();
        const auditRow = page.getByRole('listitem').filter({ hasText: 'Chạy lại tác vụ' });
        await auditRow.getByRole('button', { name: 'Xem chi tiết' }).click();
        const logDialog = page.getByRole('dialog');
        await expect(logDialog).toBeVisible();
        await expect(
            logDialog.getByText(/Chạy lại tác vụ|newJobId|Tạo tài khoản/).first(),
        ).toBeVisible();
    });
});
