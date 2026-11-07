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
