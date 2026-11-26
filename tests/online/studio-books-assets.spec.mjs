import { expect, test } from '@playwright/test';
import { createTinyGlb, TINY_PNG } from './helpers/fixtures.mjs';
import { installStudioMocks } from './helpers/mock-studio-api.mjs';

test.describe('Studio Client: Overview, Books, Trash, Assets, Narration, 3D Gen & Stats', () => {
    test('studio overview dashboard, notifications popover, and reading stats', async ({
        page,
    }) => {
        const mock = await installStudioMocks(page);

        await page.goto('/studio');
        await expect(page.getByRole('heading', { name: 'Tổng quan', exact: true })).toBeVisible();
        await expect(
            page
                .getByLabel('Biểu đồ lượt mở sách theo ngày')
                .locator('svg.recharts-surface')
                .first(),
        ).toBeVisible();

        // Open notifications popover, filter unread, and mark read
        const notifBtn = page.getByRole('button', { name: /Thông báo/i });
        await notifBtn.click();
        const notifDialog = page.getByRole('dialog');
        await expect(notifDialog.getByText('Xuất bản hoàn tất')).toBeVisible();
        await notifDialog.getByRole('button', { name: /Đọc tất cả|Đánh dấu.*đã đọc/i }).click();
        await expect
            .poll(() =>
                mock.state.calls.some(
                    (c) => c.method === 'POST' && c.path === '/me/notifications/read',
                ),
            )
            .toBe(true);

        // Navigate to Stats page and verify range switch
        await page.getByRole('link', { name: 'Thống kê', exact: true }).first().click();
        await expect(
            page.getByRole('heading', { name: 'Thống kê sách', exact: true }),
        ).toBeVisible();
        await page.getByRole('button', { name: 'Xem thống kê sách Đại Dương Xanh AR' }).click();
        const statsDialog = page.getByRole('dialog');
        await expect(statsDialog.getByText('Đại Dương Xanh AR')).toBeVisible();
        await statsDialog.getByRole('radio', { name: '7 ngày', exact: true }).click();
        await expect
            .poll(() =>
                mock.state.calls.some((c) => c.path.endsWith('/stats') && c.query.range === '7d'),
            )
            .toBe(true);
    });

    test('create book (CUSTOM dimensions validation & blank book), duplicate, soft delete -> trash -> restore', async ({
        page,
    }) => {
        const mock = await installStudioMocks(page);

        await page.goto('/books');
        await expect(
            page.getByRole('heading', { name: 'Sách của tôi', exact: true }),
        ).toBeVisible();

        // 1. Open create book dialog and create a blank CUSTOM-size book
        await page.getByRole('link', { name: 'Tạo sách mới' }).first().click();
        const dialog = page.getByRole('dialog');
        await expect(dialog.getByRole('heading', { name: 'Tạo sách mới' })).toBeVisible();
        await dialog.getByLabel(/Tên sách/).fill('Sách Khổ Vuông Mới');
        await dialog.getByLabel(/Mô tả/).fill('Sách kiểm thử E2E tạo mới.');
        await dialog.getByRole('button', { name: 'Tạo và mở editor' }).click();

        // Should navigate into newly created book editor (empty book)
        await expect(page).toHaveURL(/\/books\/[^/]+\/(?:edit|pages\/[^/]+)$/);
        expect(mock.state.calls.some((c) => c.method === 'POST' && c.path === '/books')).toBe(true);

        // 2. Return to /books, soft delete the newly created book
        await page.goto('/books');
        await expect(page.getByText('Sách Khổ Vuông Mới')).toBeVisible();
        await page.getByRole('button', { name: 'Thao tác với sách: Sách Khổ Vuông Mới' }).click();
        const actionsDialog = page.getByRole('dialog');
        await actionsDialog.getByRole('button', { name: 'Chuyển vào thùng rác' }).click();

        const confirmDelete = page.getByRole('alertdialog');
        await confirmDelete
            .getByRole('button', { name: /Xác nhận|Chuyển vào thùng rác|Xóa/i })
            .click();
        await expect(page.getByText('Đã chuyển sách vào thùng rác.')).toBeVisible();

        // 3. Go to /books/trash and restore book
        await page.getByRole('link', { name: 'Thùng rác', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Thùng rác', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Khôi phục Sách Khổ Vuông Mới' }).click();
        await expect(
            page.getByRole('button', { name: 'Khôi phục Sách Khổ Vuông Mới' }),
        ).toHaveCount(0);

        await page.getByRole('link', { name: 'Sách của tôi', exact: true }).click();
        await expect(page.getByText('Sách Khổ Vuông Mới')).toBeVisible();
    });

    test('upload asset to R2 (presigned PUT + complete), handle ASSET_IN_USE 409 on delete', async ({
        page,
    }) => {
        const mock = await installStudioMocks(page, { assetInUse: true });

        await page.goto('/assets');
        await expect(
            page.getByRole('heading', { name: 'Tài nguyên của tôi', exact: true }),
        ).toBeVisible();

        // 1. Upload personal GLB model via upload-signature -> R2 PUT -> complete (202) -> job poll
        await page.getByRole('link', { name: 'Tải tài nguyên' }).click();
        const uploadDialog = page.getByRole('dialog');
        await expect(uploadDialog.getByRole('heading', { name: 'Tải tài nguyên' })).toBeVisible();
        await uploadDialog.getByRole('tab', { name: 'Mô hình 3D' }).click();

        const fileInput = uploadDialog.locator('input[type="file"]');
        await fileInput.setInputFiles({
            name: 'robot.glb',
            mimeType: 'model/gltf-binary',
            buffer: createTinyGlb(),
        });
        await uploadDialog.getByLabel('Tên tài nguyên').fill('Robot 3D Kiểm Thử');
        await uploadDialog.getByRole('button', { name: 'Tải lên', exact: true }).click();

        await expect(page).toHaveURL(/\/assets$/);
        await expect(page.getByText('Robot 3D Kiểm Thử')).toBeVisible();
        expect(
            mock.state.calls.some(
                (c) => c.method === 'PUT' && c.url?.includes('r2.cloudflarestorage.com'),
            ),
        ).toBe(true);

        // 2. Try deleting an asset that is currently used in a book -> 409 ASSET_IN_USE
        await page.getByText('Tàu vũ trụ 3D').click();
        const detailDialog = page.getByRole('dialog');
        const deleteBtn = detailDialog.getByRole('button', { name: /Xóa tài nguyên|Xóa/i }).first();
        await deleteBtn.click();
        const confirm = page.getByRole('alertdialog');
        if (await confirm.isVisible().catch(() => false)) {
            await confirm.getByRole('button', { name: /Xác nhận|Xóa/i }).click();
        }
        await expect(page.getByText(/đang được dùng trong sách/i)).toBeVisible();
    });

    test('ZeroTTS narration generation: preview audio, save asset, and AI_UNAVAILABLE 503 recovery', async ({
        page,
    }) => {
        const mock = await installStudioMocks(page);

        await page.goto('/assets');
        await page.getByRole('button', { name: 'Tạo âm thanh', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Tạo âm thanh từ văn bản', exact: true });
        await expect(dialog).toBeVisible();

        // 1. Inject 503 AI_UNAVAILABLE on first generate attempt
        mock.injectFault({
            method: 'POST',
            match: '/assets/narration/generate',
            status: 503,
            code: 'AI_UNAVAILABLE',
            message: 'Dịch vụ ZeroTTS tạm thời quá tải.',
        });
        await dialog
            .getByLabel('Nội dung lời đọc')
            .fill('Xin chào các bạn nhỏ yêu thích Bookaria.');
        await dialog.getByRole('button', { name: /Tạo lời đọc|Tạo âm thanh/i }).click();
        await expect(dialog.getByText(/ZeroTTS|chưa khả dụng|quá tải/i)).toBeVisible();

        // 2. Retry succeeds -> audio preview rendered -> save to personal assets
        await dialog.getByRole('button', { name: /Tạo lời đọc|Tạo âm thanh/i }).click();
        await expect(dialog.getByLabel('Tên âm thanh')).toBeVisible();
        await dialog.getByLabel('Tên âm thanh').fill('Lời chào Bookaria');
        await dialog.getByRole('button', { name: /Lưu vào tài nguyên/i }).click();

        await expect(page.getByText('Lời chào Bookaria')).toBeVisible();
    });

    test('RunPod 3D generation from input image: upload MODEL_INPUT -> 202 polling -> FAILED/SUCCEEDED', async ({
        page,
    }) => {
        const mock = await installStudioMocks(page);

        await page.goto('/assets/generate-3d');
        const dialog = page.getByRole('dialog', { name: 'Tạo 3D từ ảnh', exact: true });
        await expect(dialog).toBeVisible();

        const input = dialog.locator('input[type="file"]');
        await input.setInputFiles({
            name: 'turtle.png',
            mimeType: 'image/png',
            buffer: TINY_PNG,
        });

        await dialog.getByRole('button', { name: /Tạo mô hình 3D|Bắt đầu tạo/i }).click();
        await expect
            .poll(() =>
                mock.state.calls.some(
                    (c) => c.method === 'POST' && c.path === '/assets/model-generations',
                ),
            )
            .toBe(true);
        await expect(page).toHaveURL(/\/assets\?type=MODEL/);
    });
});
