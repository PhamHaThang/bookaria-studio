import { expect, test } from '@playwright/test';

async function open(page, theme = 'light') {
    await page.addInitScript((value) => localStorage.setItem('bookaria.theme', value), theme);
    await page.goto('/tests/browser/editor-pages.html?pages=1&repair=1');
    await expect(page.locator('.scene-editor')).toBeVisible();
}
async function removalDialog(page) {
    await page.getByRole('button', { name: /^Đối tượng \(/ }).click();
    await page.getByRole('button', { name: 'Tác vụ cho Thông tin', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Xóa đối tượng', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
}
async function snapshot(page) {
    return page.evaluate(() => {
        const store = window.__editorPages.store;
        const page = store.getPage(store.getSnapshot().working.pages[0].id);
        return {
            objects: page.scene.objects.map((object) => object.id),
            rules: page.scene.interactions.map((rule) => rule.id),
        };
    });
}
for (const [theme, width, height] of [
    ['light', 1366, 768],
    ['dark', 1600, 900],
]) {
    test(`deletion ${theme}: retains repairable flow, previews healthy flow and opens the exact broken step`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height });
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await open(page, theme);
        await removalDialog(page);
        await expect(
            page.getByRole('radio', { name: 'Giữ luồng để sửa', exact: true }),
        ).toBeChecked();
        await expect(
            page.getByText('Ảnh hưởng đến 1 luồng tương tác', { exact: true }),
        ).toBeVisible();
        await page.screenshot({ path: info.outputPath(`object-removal-${theme}.png`) });
        await page
            .getByRole('alertdialog')
            .getByRole('button', { name: 'Xóa đối tượng', exact: true })
            .click();
        await expect
            .poll(() => snapshot(page))
            .toEqual({ objects: ['source'], rules: ['broken-flow', 'healthy-flow'] });
        await page.getByRole('radio', { name: 'Xem trước', exact: true }).click();
        await expect(page.getByText(/Tạm bỏ qua 1 luồng cần sửa/)).toBeVisible();
        await expect(page.getByRole('button', { name: 'Bắt đầu xem', exact: true })).toBeEnabled();
        await page.screenshot({ path: info.outputPath(`preview-repair-${theme}.png`) });
        await page.getByRole('button', { name: 'Bắt đầu xem', exact: true }).click();
        await expect(
            page.getByRole('heading', { name: 'Luồng hợp lệ vẫn chạy', exact: true }),
        ).toBeVisible();
        await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
        await page
            .getByRole('dialog', { name: 'Câu hỏi tương tác', exact: true })
            .getByRole('button', { name: 'Đóng', exact: true })
            .click();
        await page.getByRole('button', { name: 'Sửa luồng Hiện thông tin', exact: true }).click();
        await expect(
            page.getByRole('textbox', { name: 'Tên luồng tương tác', exact: true }),
        ).toHaveValue('Hiện thông tin');
        await expect(page.locator('.react-flow__node.selected')).toHaveAttribute(
            'data-id',
            'action-0',
        );
        await page.getByRole('button', { name: 'Chạy thử', exact: true }).click();
        await expect(
            page.getByRole('region', { name: 'Chạy thử tương tác', exact: true }),
        ).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Thử lại', exact: true })).toHaveCount(0);
        expect(errors).toEqual([]);
    });
}
test('explicitly removing related flows is one undoable operation', async ({ page }) => {
    await open(page);
    await removalDialog(page);
    await page.getByRole('radio', { name: 'Xóa kèm các luồng liên quan', exact: true }).check();
    await page
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Xóa đối tượng', exact: true })
        .click();
    await expect
        .poll(() => snapshot(page))
        .toEqual({ objects: ['source'], rules: ['healthy-flow'] });
    await page.getByTestId('scene-history-undo').click();
    await expect
        .poll(() => snapshot(page))
        .toEqual({ objects: ['source', 'target'], rules: ['broken-flow', 'healthy-flow'] });
});
test('isolated test tolerates inferred/declared name collisions by generating distinct display names', async ({
    page,
}) => {
    await open(page);
    await page.getByRole('radio', { name: 'Tương tác', exact: true }).click();
    await page.getByRole('button', { name: /^Luồng hợp lệ/ }).click();
    await page.getByRole('button', { name: 'Chạy thử', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Chạy thử tương tác', exact: true });
    await expect(panel.getByRole('button', { name: 'Chạy', exact: true })).toBeEnabled();
    await expect(panel.getByText('Điểm số', { exact: true })).toBeVisible();
    await expect(panel.getByText('Điểm số (2)', { exact: true })).toBeVisible();
    await panel.getByRole('button', { name: 'Chạy', exact: true }).click();
    await expect(
        page.getByRole('heading', { name: 'Luồng hợp lệ vẫn chạy', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
    await page
        .getByRole('dialog', { name: 'Câu hỏi tương tác', exact: true })
        .getByRole('button', { name: 'Đóng', exact: true })
        .click();
    await expect(panel.getByRole('button', { name: 'Thử lại', exact: true })).toHaveCount(0);
});
