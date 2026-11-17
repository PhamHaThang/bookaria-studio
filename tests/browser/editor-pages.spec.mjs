import { expect, test } from '@playwright/test';

async function open(page, query, theme = 'light') {
    await page.addInitScript((value) => localStorage.setItem('bookaria.theme', value), theme);
    await page.goto(`/tests/browser/editor-pages.html?${query}`);
    await expect(page.locator('.scene-editor')).toBeVisible();
}
async function remove(page, number) {
    await page.getByRole('button', { name: `Tùy chọn trang ${number}`, exact: true }).click();
    await page.getByRole('menuitem', { name: 'Xóa trang', exact: true }).click();
    await page
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Xóa trang', exact: true })
        .click();
}
async function selectedTitle(page) {
    return page.evaluate(() => {
        const { store, router } = window.__editorPages;
        return store.getPage(router.state.location.pathname.split('/').at(-1))?.title;
    });
}
test('interaction mode shows control hints and hides the page strip', async ({ page }) => {
    await open(page, 'pages=2');
    await page.getByRole('radio', { name: 'Tương tác', exact: true }).click();
    const ai = page.getByRole('button', { name: 'Trợ lý Bookaria', exact: true });
    const pages = page.getByRole('navigation', { name: 'Các trang trong sách' });
    const hints = page.getByRole('note', { name: 'Hướng dẫn điều khiển tương tác' });
    await expect(ai.locator('.lucide-sparkles')).toBeVisible();
    await expect(pages).toBeHidden();
    const buttonBounds = await ai.boundingBox();
    expect(buttonBounds.width).toBe(buttonBounds.height);
    await expect(hints.getByText('Cuộn để thu phóng')).toBeInViewport();
    expect(buttonBounds.y + buttonBounds.height).toBeLessThan((await hints.boundingBox()).y);
    await page.getByRole('radio', { name: 'Thiết kế', exact: true }).click();
    await expect(pages).toBeVisible();
});

test('chat docks beside the editor and keeps separate drafts when changing pages', async ({
    page,
}, info) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, 'pages=2');
    const showChat = async () => {
        await page.getByRole('radio', { name: 'Tương tác', exact: true }).click();
        await page.getByRole('button', { name: 'Trợ lý Bookaria', exact: true }).click();
    };
    await showChat();
    const chat = page.getByRole('complementary', { name: 'Trợ lý Bookaria' });
    await expect(chat).toBeVisible();
    await page.getByLabel('Yêu cầu cho trợ lý').fill('Lời đọc cho trang đầu');
    const hints = await page
        .getByRole('note', { name: 'Hướng dẫn điều khiển tương tác' })
        .boundingBox();
    const bounds = await chat.boundingBox();
    expect(bounds.width).toBe(400);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(hints.y);
    await page.screenshot({ path: info.outputPath('chat-desktop.png') });
    await page.getByRole('radio', { name: 'Thiết kế', exact: true }).click();
    await expect(chat).toBeHidden();
    await page.getByRole('button', { name: 'Trợ lý Bookaria', exact: true }).click();
    await expect(chat.getByText('Thiết kế trang', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Yêu cầu cho trợ lý')).toHaveValue('Lời đọc cho trang đầu');
    await page.getByRole('link', { name: /^Trang 2:/ }).click();
    await showChat();
    await expect(page.getByLabel('Yêu cầu cho trợ lý')).toHaveValue('');
    await page.getByLabel('Yêu cầu cho trợ lý').fill('Lời đọc cho trang thứ hai');
    await page.getByRole('radio', { name: 'Thiết kế', exact: true }).click();
    await page.getByRole('link', { name: /^Trang 1:/ }).click();
    await showChat();
    await expect(page.getByLabel('Yêu cầu cho trợ lý')).toHaveValue('Lời đọc cho trang đầu');
});

test('design assistant edits the page and carries its proposal and undo across both tabs', async ({
    page,
}, info) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await open(page, 'pages=2&repair', 'dark');
    const launcher = page.getByRole('button', { name: 'Trợ lý Bookaria', exact: true });
    const objects = page.getByRole('button', { name: /^Đối tượng \(/ });
    await expect(launcher).toHaveText('');
    await expect(launcher.locator('.lucide-sparkles')).toBeVisible();
    await expect
        .poll(async () => {
            const ai = await launcher.boundingBox();
            const layers = await objects.boundingBox();
            return (
                Math.abs(ai.x - layers.x - layers.width - 6) < 1 &&
                Math.abs(ai.y + ai.height / 2 - layers.y - layers.height / 2) < 2
            );
        })
        .toBe(true);
    await page.screenshot({ path: info.outputPath('assistant-design-launcher.png') });
    await launcher.click();
    const chat = page.getByRole('complementary', { name: 'Trợ lý Bookaria' });
    await expect(chat.getByText('Thiết kế trang', { exact: true })).toBeVisible();
    await expect(chat.getByRole('button', { name: 'Ẩn đối tượng khi mở trang' })).toBeVisible();
    const bounds = await chat.boundingBox();
    const toggle = page.getByRole('button', { name: 'Thu gọn trợ lý AI', exact: true });
    await expect(toggle.locator('.lucide-sparkles')).toBeVisible();
    await expect(toggle).toHaveText('');
    const toggleBounds = await toggle.boundingBox();
    const dock = page.getByRole('navigation', { name: 'Các trang trong sách' });
    const dockBounds = await dock.boundingBox();
    expect(toggleBounds.y - bounds.y - bounds.height).toBeCloseTo(12, 0);
    expect(
        bounds.x >= dockBounds.x + dockBounds.width || bounds.y + bounds.height <= dockBounds.y,
    ).toBe(true);
    await page.screenshot({ path: info.outputPath('assistant-design-desktop.png') });
    await chat.getByRole('button', { name: 'Mở rộng chat', exact: true }).click();
    await expect
        .poll(async () => {
            const expanded = await chat.boundingBox();
            return (
                expanded.x >= dockBounds.x + dockBounds.width ||
                expanded.y + expanded.height <= dockBounds.y
            );
        })
        .toBe(true);
    await chat.getByRole('button', { name: 'Thu nhỏ chat', exact: true }).click();

    await page.getByLabel('Yêu cầu cho trợ lý').fill('Đổi nội dung thẻ Thông tin thành Rùa biển');
    await chat.getByRole('button', { name: 'Gửi tin nhắn' }).click();
    const proposal = chat.getByRole('region', { name: 'Đề xuất chỉnh sửa' });
    await expect(proposal.getByText('Rùa biển', { exact: true })).toBeVisible();
    const readText = () =>
        page.evaluate(() => {
            const { store, router } = window.__editorPages;
            return store
                .getPage(router.state.location.pathname.split('/').at(-1))
                ?.scene.objects.find((item) => item.id === 'target')?.text;
        });
    await expect.poll(readText).toBe('Nội dung thông tin');
    await proposal.getByRole('button', { name: 'Áp dụng thay đổi' }).click();
    await expect.poll(readText).toBe('Rùa biển');
    await objects.click();
    await page
        .locator('#scene-object-layers')
        .getByRole('button', { name: 'Chọn Thông tin', exact: true })
        .click();
    const textField = page.getByRole('textbox', { name: 'Nội dung chữ', exact: true });
    await textField.fill('Rùa biển sửa tay');
    await textField.press('Tab');
    await expect.poll(readText).toBe('Rùa biển sửa tay');
    await launcher.click();
    await expect(
        proposal.getByText('Đã áp dụng · Có chỉnh sửa tiếp', { exact: true }),
    ).toBeVisible();
    await page.getByTestId('scene-history-undo').click();
    await expect.poll(readText).toBe('Rùa biển');
    await page.getByTestId('scene-history-undo').click();
    await expect.poll(readText).toBe('Nội dung thông tin');
    await expect(proposal.getByText('Đã hoàn tác', { exact: true })).toBeVisible();
    await page.getByTestId('scene-history-redo').click();
    await expect.poll(readText).toBe('Rùa biển');
    await page.getByRole('radio', { name: 'Tương tác', exact: true }).click();
    await expect(chat).toBeHidden();
    await page.getByRole('button', { name: 'Trợ lý Bookaria', exact: true }).click();
    await expect(chat.getByText('Tương tác', { exact: true })).toBeVisible();
    await expect(proposal.getByText('Đã áp dụng vào bản nháp')).toBeVisible();
    await page.getByTestId('scene-history-undo').click();
    await expect.poll(readText).toBe('Nội dung thông tin');
});

test('design assistant and Objects stay together around a wide page strip', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await open(page, 'pages=9');
    const launcher = page.getByRole('button', { name: 'Trợ lý Bookaria', exact: true });
    const objects = page.getByRole('button', { name: /^Đối tượng \(/ });
    await expect(launcher).toBeVisible();
    await expect
        .poll(async () => {
            const ai = await launcher.boundingBox();
            const layers = await objects.boundingBox();
            return (
                Math.abs(ai.x - layers.x - layers.width - 6) < 1 &&
                Math.abs(ai.y + ai.height / 2 - layers.y - layers.height / 2) < 2
            );
        })
        .toBe(true);
    const dock = await page.locator('.page-strip-region').boundingBox();
    const ai = await launcher.boundingBox();
    expect(ai.x >= dock.x + dock.width || ai.y + ai.height <= dock.y).toBe(true);
    await launcher.click();
    await expect(
        page.getByRole('button', { name: 'Thu gọn trợ lý AI' }).locator('.lucide-sparkles'),
    ).toBeVisible();
    await expect(page.getByLabel('Yêu cầu cho trợ lý')).toBeVisible();
});

test('chat yields to design and interaction inspectors and keeps the typed draft', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, 'pages=2&repair');
    const launcher = page.getByRole('button', { name: 'Trợ lý Bookaria', exact: true });
    const chat = page.getByRole('complementary', { name: 'Trợ lý Bookaria', exact: true });
    const objects = page.getByRole('button', { name: /^Đối tượng \(/ });
    const layers = page.locator('#scene-object-layers');
    const inspector = page.locator('aside[aria-label="Bảng chỉnh sửa"]');
    const input = page.getByLabel('Yêu cầu cho trợ lý');

    await objects.click();
    await expect(layers).toBeVisible();
    await launcher.click();
    await expect(layers).toBeHidden();
    await input.fill('Giữ nội dung đang nhập');
    await objects.click();
    await expect(chat).toBeHidden();
    await layers.getByRole('button', { name: 'Chọn Thông tin', exact: true }).click();
    await expect(inspector).toHaveAttribute('aria-hidden', 'false');
    await launcher.click();
    await expect(inspector).toHaveAttribute('aria-hidden', 'true');
    await expect(layers).toBeHidden();
    await expect(input).toHaveValue('Giữ nội dung đang nhập');
    await page.locator('.scene-three-host canvas').focus();
    await page.keyboard.press('Control+a');
    await expect(chat).toBeHidden();
    await expect(inspector).toHaveAttribute('aria-hidden', 'false');

    await page.getByRole('radio', { name: 'Tương tác', exact: true }).click();
    const workflow = page.getByRole('region', { name: 'Workspace tương tác', exact: true });
    await workflow.getByRole('button', { name: /^Hiện thông tin Khi chạm/ }).click();
    const stepInspector = page.getByRole('complementary', {
        name: 'Thiết lập bước tương tác',
        exact: true,
    });
    const block = page.locator('[data-workflow-step="action-0"] .workflow-drag');
    await block.click();
    await expect(stepInspector).toBeVisible();
    await launcher.click();
    await expect(stepInspector).toBeHidden();
    await expect(input).toHaveValue('Giữ nội dung đang nhập');
    await block.click();
    await expect(chat).toBeHidden();
    await expect(stepInspector).toBeVisible();
    await launcher.click();
    await workflow.getByRole('tab', { name: /^Ghi nhớ/ }).click();
    await expect(chat).toBeHidden();
    await expect(workflow.getByRole('tab', { name: /^Ghi nhớ/ })).toHaveAttribute(
        'aria-selected',
        'true',
    );
    await launcher.click();
    await expect(workflow.getByRole('tab', { name: 'Luồng', exact: true })).toHaveAttribute(
        'aria-selected',
        'true',
    );
    await expect(input).toHaveValue('Giữ nội dung đang nhập');
});

for (const [theme, width, height] of [
    ['light', 1366, 768],
    ['dark', 1920, 1080],
]) {
    test(`last page ${theme}: keeps editor and +, restores with undo, and can add again`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height });
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await open(page, 'pages=1', theme);
        await remove(page, 1);
        await expect(page.getByRole('heading', { name: 'Sách chưa có trang' })).toBeVisible();
        await expect
            .poll(() => page.evaluate(() => window.__editorPages.router.state.location.pathname))
            .toMatch(/\/edit$/);
        await expect(page.getByRole('navigation', { name: 'Các trang trong sách' })).toBeVisible();
        await expect(page.getByRole('complementary', { name: 'Công cụ editor' })).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Thiết lập trang', exact: true }),
        ).toBeDisabled();
        await expect(page.getByRole('button', { name: 'Thêm trang', exact: true })).toBeEnabled();
        await expect(page.getByRole('button', { name: 'Lưu sách', exact: true })).toBeEnabled();
        await expect(page.getByRole('note', { name: 'Hướng dẫn điều khiển canvas' })).toBeVisible();
        await expect(page.getByText('Kéo trái: xoay', { exact: true })).toBeVisible();
        await expect(page.getByText('Cuộn: zoom', { exact: true })).toBeVisible();
        const alignment = await page.evaluate(() => {
            const workspace = document.querySelector('.scene-workspace').getBoundingClientRect();
            const strip = document.querySelector('.page-strip-region').getBoundingClientRect();
            const add = document.querySelector('.strip-add-page').getBoundingClientRect();
            const title = document.getElementById('empty-book-heading').getBoundingClientRect();
            const hints = document
                .querySelector('[data-canvas-hints-host]')
                .getBoundingClientRect();
            return {
                stripCenter: Math.abs(
                    strip.x + strip.width / 2 - (workspace.x + workspace.width / 2),
                ),
                addCenterX: Math.abs(add.x + add.width / 2 - (strip.x + strip.width / 2)),
                addCenterY: Math.abs(add.y + add.height / 2 - (strip.y + strip.height / 2)),
                titleCenter: Math.abs(
                    title.x + title.width / 2 - (workspace.x + workspace.width / 2),
                ),
                hintsGap: hints.top - strip.bottom,
                hintsBottom: hints.bottom,
            };
        });
        expect(alignment.stripCenter).toBeLessThanOrEqual(1);
        expect(alignment.addCenterX).toBeLessThanOrEqual(1);
        expect(alignment.addCenterY).toBeLessThanOrEqual(1);
        expect(alignment.titleCenter).toBeLessThanOrEqual(1);
        expect(alignment.hintsGap).toBeGreaterThanOrEqual(15);
        expect(alignment.hintsGap).toBeLessThanOrEqual(17);
        expect(alignment.hintsBottom).toBe(height);
        expect(
            await page.evaluate(() => ({
                x: document.documentElement.scrollWidth > innerWidth,
                y: document.documentElement.scrollHeight > innerHeight,
            })),
        ).toEqual({ x: false, y: false });
        await page.screenshot({ path: info.outputPath(`empty-editor-${theme}.png`) });
        await page.getByRole('button', { name: 'Lưu sách', exact: true }).click();
        await expect
            .poll(() => page.evaluate(() => window.__editorPages.store.getSnapshot().dirty))
            .toBe(false);
        if (theme === 'dark') await page.keyboard.press('Control+z');
        else await page.getByTestId('scene-history-undo').click();
        await expect.poll(() => selectedTitle(page)).toBe('Nội dung 1');
        await expect(page.locator('[data-empty-book]')).toHaveCount(0);
        await remove(page, 1);
        await page.getByRole('button', { name: 'Thêm trang', exact: true }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page
            .getByRole('dialog')
            .getByRole('button', { name: 'Thêm trang trắng', exact: true })
            .click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        await expect(page.locator('[data-empty-book]')).toHaveCount(0);
        await expect
            .poll(() =>
                page.evaluate(() => window.__editorPages.store.getSnapshot().working.pages.length),
            )
            .toBe(1);
        expect(errors).toEqual([]);
    });
}
test('deleting a middle page selects the next one; deleting the last selects the preceding one', async ({
    page,
}) => {
    await open(page, 'pages=3&start=1');
    await remove(page, 2);
    await expect.poll(() => selectedTitle(page)).toBe('Nội dung 3');
    await remove(page, 2);
    await expect.poll(() => selectedTitle(page)).toBe('Nội dung 1');
});
test('deleting a different page keeps the open page', async ({ page }) => {
    await open(page, 'pages=3&start=1');
    await remove(page, 1);
    await expect.poll(() => selectedTitle(page)).toBe('Nội dung 2');
});
test('an empty book enters the editor, keeps an active add dialog, and opens a page after closing it', async ({
    page,
}) => {
    await open(page, 'pages=0&start=edit');
    await expect(page.locator('[data-empty-book]')).toBeVisible();
    await page.getByRole('button', { name: 'Thêm trang', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.evaluate(() => window.__editorPages.store.addBlankPage());
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('[data-empty-book]')).toBeVisible();
    await page.getByRole('button', { name: 'Hủy', exact: true }).click();
    await expect(page.locator('[data-empty-book]')).toHaveCount(0);
    await expect(page.getByText('Chọn trang để tiếp tục', { exact: true })).toHaveCount(0);
});
