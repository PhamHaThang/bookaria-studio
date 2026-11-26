import { expect, test } from '@playwright/test';
import { installStudioMocks } from './helpers/mock-studio-api.mjs';

test.describe('Studio Client: 3D Editor, Draft Concurrency, Markers, AI & Publication', () => {
    test('3D editor: add text & hotspot, undo/redo, layers panel, save draft & REVISION_CONFLICT 409 recovery', async ({
        page,
    }) => {
        const mock = await installStudioMocks(page);
        const { book1Id, page1Id } = mock.state.ids;

        await page.goto(`/books/${book1Id}/pages/${page1Id}`);
        await expect(page.getByRole('button', { name: 'Lưu sách', exact: true })).toBeVisible();

        // 1. Add Text object via TextComposer
        await page.getByRole('button', { name: 'Văn bản', exact: true }).click();
        const textDialog = page.getByRole('dialog');
        await textDialog.getByPlaceholder('Nhập nội dung của bạn…').fill('Chào mừng tới Vũ trụ');
        await textDialog.getByRole('button', { name: 'Thêm vào scene' }).click();
        await expect(textDialog).toBeHidden();

        // 2. Add Hotspot object
        await page.getByRole('button', { name: 'Vùng chạm', exact: true }).click();
        await expect(page.getByRole('button', { name: /Đối tượng \(2\)/ })).toBeVisible();

        // 3. Undo & Redo via keyboard or toolbar
        await page.getByRole('button', { name: /Hoàn tác/i }).click();
        await expect(page.getByRole('button', { name: /Đối tượng \(1\)/ })).toBeVisible();
        await page.getByRole('button', { name: /Làm lại/i }).click();
        await expect(page.getByRole('button', { name: /Đối tượng \(2\)/ })).toBeVisible();

        // 4. Open Layers panel & inspect objects
        await page.getByRole('button', { name: /Đối tượng \(2\)/ }).click();
        const layersPanel = page.locator('#scene-object-layers');
        await expect(layersPanel).toBeVisible();
        await expect(layersPanel.getByRole('button', { name: 'Chọn Văn bản' })).toBeVisible();
        await expect(layersPanel.getByRole('button', { name: 'Chọn Vùng chạm' })).toBeVisible();

        // 5. Ensure draft save succeeds (autosave or manual Save button)
        const saveBtn = page.getByRole('button', { name: 'Lưu sách', exact: true });
        if (await saveBtn.isEnabled()) {
            await saveBtn.click();
        }
        await expect(saveBtn).toBeDisabled();
        await expect
            .poll(() =>
                mock.state.calls.some(
                    (c) => c.method === 'PUT' && c.path === `/books/${book1Id}/draft`,
                ),
            )
            .toBe(true);

        // 6. Simulate 409 REVISION_CONFLICT from another browser tab when saving new edit
        mock.injectFault({
            method: 'PUT',
            match: `/books/${book1Id}/draft`,
            status: 409,
            code: 'REVISION_CONFLICT',
            message: 'Trang đã được sửa ở nơi khác.',
            details: { currentRevision: 99 },
        });
        await page.getByRole('button', { name: 'Vùng chạm', exact: true }).click();
        if (await saveBtn.isEnabled()) {
            await saveBtn.click();
        }
        const conflictBtn = page.getByRole('button', { name: /Có phiên bản mới/i });
        await expect(conflictBtn).toBeVisible();
        await conflictBtn.click();
        await expect(
            page.getByRole('heading', { name: 'Sách đã thay đổi trên máy chủ' }),
        ).toBeVisible();
    });

    test('Interaction mode + Boki AI Assistant proposal & AI_UNAVAILABLE 503 resilience', async ({
        page,
    }) => {
        const mock = await installStudioMocks(page);
        const { book1Id, page1Id } = mock.state.ids;

        await page.goto(`/books/${book1Id}/pages/${page1Id}`);
        await expect(page.getByRole('button', { name: 'Mở tương tác', exact: true })).toBeVisible();

        // Switch to Interactions mode
        await page.getByRole('button', { name: 'Mở tương tác', exact: true }).click();
        await expect(page.getByRole('region', { name: 'Trình biên soạn tương tác' })).toBeVisible();

        // Open Boki AI Assistant
        const bokiLauncher = page.locator('[data-assistant-launcher]');
        await bokiLauncher.click();
        const assistantPanel = page
            .getByRole('dialog', { name: 'Trợ lý Boki' })
            .or(page.locator('[aria-label="Trợ lý Boki"]'));
        await expect(assistantPanel.first()).toBeVisible();

        // Verify AI_UNAVAILABLE 503 is handled gracefully without crashing editor
        mock.injectFault({
            method: 'POST',
            match: `/pages/${page1Id}/interaction-proposals`,
            status: 503,
            code: 'AI_UNAVAILABLE',
            message: 'Trợ lý AI hiện chưa khả dụng. Vui lòng thử lại sau.',
        });
        const chatBox = page.locator('textarea').last();
        await chatBox.fill('Khi chạm vào trang thì chờ 0.3 giây');
        await chatBox.press('Enter');
        await expect(page.getByText(/chưa khả dụng/i)).toBeVisible();

        // Retry AI proposal succeeds
        await chatBox.fill('Khi chạm vào trang thì chờ 0.3 giây');
        await chatBox.press('Enter');
        await expect
            .poll(() =>
                mock.state.calls.some(
                    (c) =>
                        c.method === 'POST' && c.path === `/pages/${page1Id}/interaction-proposals`,
                ),
            )
            .toBe(true);
    });

    test('AR Marker settings: switch BOOKARIA_MARKER / CUSTOM_MARKER (compiled) / NONE and POOL_EXHAUSTED 422', async ({
        page,
    }) => {
        const mock = await installStudioMocks(page);
        const { book1Id, page1Id } = mock.state.ids;

        await page.goto(`/books/${book1Id}/pages/${page1Id}`);
        await page.getByRole('button', { name: 'Thiết lập AR Marker', exact: true }).click();

        const markerDialog = page.getByRole('dialog');
        await expect(markerDialog).toBeVisible();

        // 1. Switch to NONE ("Không dùng AR") and apply
        await markerDialog.getByRole('tab', { name: /Không dùng AR/ }).click();
        await markerDialog.getByRole('button', { name: 'Áp dụng', exact: true }).click();
        await expect(markerDialog).toBeHidden();
        await expect
            .poll(() =>
                mock.state.calls.some(
                    (c) => c.method === 'PATCH' && c.path === `/pages/${page1Id}` && c.body?.noAr,
                ),
            )
            .toBe(true);

        // 2. Re-open and switch to CUSTOM_MARKER -> runs mocked marker-compiler iframe -> R2 upload -> PUT /marker -> 202 job poll
        await page.getByRole('button', { name: 'Thiết lập AR Marker', exact: true }).click();
        await markerDialog.getByRole('tab', { name: /Dùng ảnh trang/ }).click();
        await markerDialog.getByRole('button', { name: 'Áp dụng', exact: true }).click();
        await expect(
            markerDialog.getByText(/Đã áp dụng ảnh trang|Cập nhật kết quả đánh giá/i),
        ).toBeVisible();
        await markerDialog
            .getByRole('button', { name: 'Đóng thiết lập AR Marker', exact: true })
            .click();

        // 3. Switch back to BOOKARIA_MARKER -> test MARKER_POOL_EXHAUSTED 422
        await page.getByRole('button', { name: 'Thiết lập AR Marker', exact: true }).click();
        await markerDialog.getByRole('tab', { name: /Marker Bookaria/ }).click();
        mock.injectFault({
            method: 'PUT',
            match: `/pages/${page1Id}/marker`,
            status: 422,
            code: 'MARKER_POOL_EXHAUSTED',
            message: 'Sách đã dùng hết số marker Bookaria.',
        });
        await markerDialog.getByRole('button', { name: 'Áp dụng', exact: true }).click();
        await expect(page.getByText('Sách đã dùng hết số marker Bookaria.')).toBeVisible();
    });

    test('Publication flow: PUBLISH_BLOCKED errors, accept warnings, publish PUBLIC, share QR/embed, print PDF, versions & unpublish', async ({
        page,
    }) => {
        let blockPublish = true;
        let withWarnings = false;
        const mock = await installStudioMocks(page, {
            publishCheck: () => {
                if (blockPublish) {
                    return {
                        canPublish: false,
                        hasChanges: true,
                        summary: { pageCount: 1, arPageCount: 0, downloadBytes: 1024 },
                        errors: [{ code: 'NO_AR_PAGE', message: 'Cần ít nhất 1 trang có AR.' }],
                        warnings: [],
                    };
                }
                if (withWarnings) {
                    return {
                        canPublish: true,
                        hasChanges: true,
                        summary: { pageCount: 1, arPageCount: 1, downloadBytes: 120 * 1024 },
                        errors: [],
                        warnings: [
                            {
                                code: 'OBJECT_OFF_PAGE',
                                message: 'Một đối tượng nằm gần mép trang.',
                            },
                        ],
                    };
                }
                return null;
            },
        });
        const { book1Id, page1Id } = mock.state.ids;

        await page.goto(`/books/${book1Id}/pages/${page1Id}`);
        await page.getByRole('button', { name: 'Xuất bản', exact: true }).click();

        const pubDialog = page.getByRole('dialog');
        await expect(pubDialog.getByText('Cần sửa (1)')).toBeVisible();
        await expect(pubDialog.getByRole('button', { name: 'Xuất bản sách' })).toBeDisabled();

        // Unblock with warning -> must check acceptance box before publishing
        blockPublish = false;
        withWarnings = true;
        await pubDialog.getByRole('button', { name: 'Kiểm tra lại' }).click();
        await expect(pubDialog.getByText('Nên kiểm tra (1)')).toBeVisible();
        await expect(pubDialog.getByRole('button', { name: 'Xuất bản sách' })).toBeDisabled();

        await pubDialog.getByLabel('Tôi đã xem các khuyến nghị và muốn tiếp tục.').check();
        await pubDialog.getByLabel(/Công khai/).click();
        await pubDialog.getByRole('button', { name: 'Xuất bản sách' }).click();

        // Publish job completes -> complete view -> switch to Share
        await expect(pubDialog.getByText(/Đã phát hành phiên bản 1/)).toBeVisible();
        await pubDialog.getByRole('button', { name: 'Chia sẻ sách' }).click();

        await expect(pubDialog.locator('#publication-link')).toHaveValue(
            /\/b\/sach-nhap-kham-pha$/,
        );
        await expect(pubDialog.getByAltText('Mã QR mở sách')).toBeVisible();

        // Print tab -> export PDF job
        await pubDialog.getByRole('tab', { name: 'Sách in' }).click();
        await expect(pubDialog.getByRole('button', { name: /Tạo PDF|Xuất PDF/i })).toBeVisible();

        // Versions tab -> inspect history and unpublish
        await pubDialog.getByRole('tab', { name: 'Phiên bản' }).click();
        await expect(pubDialog.getByText(/Phiên bản 1|v1/i)).toBeVisible();
        await pubDialog.getByRole('button', { name: /Ngừng chia sẻ/i }).click();
        const confirmUnpublish = page.getByRole('alertdialog');
        await confirmUnpublish.getByRole('button', { name: 'Xác nhận' }).click();
        expect(
            mock.state.calls.some(
                (c) => c.method === 'POST' && c.path === `/books/${book1Id}/unpublish`,
            ),
        ).toBe(true);
    });
});
