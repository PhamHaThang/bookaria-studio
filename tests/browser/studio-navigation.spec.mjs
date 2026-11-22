import { expect, test } from '@playwright/test';

async function open(page, path = '/books') {
    await page.goto(`/tests/browser/studio-navigation.html?path=${encodeURIComponent(path)}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

for (const reducedMotion of ['no-preference', 'reduce']) {
    test(`Studio bottom navigation shows accessible icons without animation: ${reducedMotion}`, async ({
        page,
    }) => {
        await page.setViewportSize({ width: 639, height: 900 });
        await page.emulateMedia({ reducedMotion });
        await open(page);
        const nav = page.getByRole('navigation', { name: 'Điều hướng Studio dưới', exact: true });
        await expect(nav.getByRole('link')).toHaveCount(5);
        for (const link of await nav.getByRole('link').all()) {
            expect(await link.getAttribute('aria-label')).toBeTruthy();
            expect((await link.textContent()).trim()).toBe('');
            await expect(link.locator('svg')).toBeVisible();
            await expect(link).toHaveCSS('transition-duration', '0s');
        }
        const books = nav.getByRole('link', { name: 'Sách của tôi', exact: true });
        const assets = nav.getByRole('link', { name: 'Tài nguyên', exact: true });
        for (const link of [assets, books, assets]) {
            await link.click();
            await expect(link).toHaveAttribute('aria-current', 'page');
        }
        await assets.hover();
        await page.mouse.down();
        try {
            await expect(assets).toHaveCSS('transform', 'none');
            await expect(assets).toHaveCSS('scale', 'none');
            expect(await nav.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
        } finally {
            await page.mouse.up();
        }
        const tabs = await nav.locator('[data-slot="studio-bottom-tabs"]').boundingBox();
        const bar = await nav.boundingBox();
        expect(Math.abs(tabs.width - bar.width)).toBeLessThan(1);
        expect(tabs.width).toBeGreaterThan(512);
    });
}

for (const theme of ['light', 'dark']) {
    for (const width of [320, 677, 1280]) {
        for (const path of ['/studio', '/books', '/assets', '/stats', '/books/trash']) {
            test(`Studio page controls fit their content: ${theme} ${width} ${path}`, async ({
                page,
            }) => {
                await page.setViewportSize({ width, height: 900 });
                await page.emulateMedia({ reducedMotion: 'reduce' });
                await page.addInitScript(
                    (theme) => localStorage.setItem('bookaria.theme', theme),
                    theme,
                );
                const errors = [];
                page.on('pageerror', (error) => errors.push(error.message));
                await page.goto(
                    `/tests/browser/studio-navigation.html?real=1&path=${encodeURIComponent(path)}`,
                );
                const header = page.locator('[data-slot="studio-page-header"]');
                await expect(header.getByRole('heading', { level: 1 })).toBeVisible();
                const bounds = await page.locator('.studio-main').boundingBox();
                const title = await header.getByRole('heading', { level: 1 }).boundingBox();
                expect(title.x).toBeGreaterThanOrEqual(bounds.x);
                expect(title.x + title.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
                if (width >= 640 && width < 1280) {
                    const card = page
                        .locator('[data-slot="studio-storage-summary"]')
                        .getByRole('region', { name: 'Dung lượng tài nguyên' });
                    await expect(card).toBeVisible();
                    await expect(card.getByRole('progressbar')).toBeVisible();
                    const cardBox = await card.boundingBox();
                    expect(Math.abs(cardBox.width - bounds.width)).toBeLessThan(1);
                    const heading = await header.boundingBox();
                    expect(
                        Math.abs(cardBox.x + cardBox.width - bounds.x - bounds.width),
                    ).toBeLessThan(1);
                    expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(heading.y);
                }
                const actions = header.locator('[data-slot="studio-page-actions"]');
                const actionRows = await actions
                    .locator(':scope > a, :scope > button')
                    .evaluateAll((items) =>
                        items.map((item) => ({
                            text: item.textContent,
                            box: item.getBoundingClientRect().toJSON(),
                            wrap: getComputedStyle(item).whiteSpace,
                        })),
                    );
                for (const action of actionRows) {
                    expect(action.box.height, action.text).toBeGreaterThanOrEqual(44);
                    expect(action.box.x, action.text).toBeGreaterThanOrEqual(bounds.x);
                    expect(action.box.right, action.text).toBeLessThanOrEqual(
                        bounds.x + bounds.width + 1,
                    );
                    expect(action.wrap, action.text).toBe('nowrap');
                }
                for (let i = 0; i < actionRows.length; i++)
                    for (let j = i + 1; j < actionRows.length; j++) {
                        const a = actionRows[i].box,
                            b = actionRows[j].box;
                        expect(
                            a.right <= b.x + 1 ||
                                b.right <= a.x + 1 ||
                                a.bottom <= b.y + 1 ||
                                b.bottom <= a.y + 1,
                        ).toBe(true);
                    }
                const filter = page.locator('[data-slot="filter-bar"]');
                if (path !== '/studio') {
                    await expect(filter.getByRole('status')).toContainText(
                        path === '/assets'
                            ? '9 tài nguyên'
                            : path === '/books/trash'
                              ? '0 cuốn sách'
                              : '1 cuốn sách',
                    );
                    const chips = await filter.getByRole('radiogroup').boundingBox();
                    const count = await filter.getByRole('status').boundingBox();
                    expect(count.x).toBeGreaterThanOrEqual(bounds.x);
                    expect(count.x + count.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
                    if (bounds.width < 704) {
                        expect(count.y).toBeGreaterThanOrEqual(chips.y + chips.height);
                        expect(Math.abs(count.x - chips.x)).toBeLessThan(2);
                    }
                    for (const chip of await filter.getByRole('radio').all()) {
                        expect((await chip.boundingBox()).height).toBeGreaterThanOrEqual(44);
                    }
                }
                if (path === '/assets') {
                    await page.getByRole('radio', { name: 'Hình ảnh', exact: true }).click();
                    await expect(
                        page.getByRole('radio', { name: 'Hình ảnh', exact: true }),
                    ).toHaveAttribute('data-state', 'on');
                    await expect(filter.getByRole('status')).toContainText('9 tài nguyên');
                }
                const size = await page.evaluate(() => ({
                    scroll: document.documentElement.scrollWidth,
                    available: document.documentElement.clientWidth,
                }));
                expect(size.scroll).toBeLessThanOrEqual(size.available);
                expect(errors).toEqual([]);
            });
        }
    }
}

for (const theme of ['light', 'dark']) {
    for (const width of [320, 390, 639, 640, 768, 1024, 1279, 1280, 1440]) {
        test(`Studio navigation responds without hiding destinations: ${theme} ${width}`, async ({
            page,
        }) => {
            await page.setViewportSize({ width, height: 900 });
            const errors = [];
            page.on('pageerror', (error) => errors.push(error.message));
            await page.emulateMedia({ reducedMotion: 'reduce' });
            await page.addInitScript(
                (theme) => localStorage.setItem('bookaria.theme', theme),
                theme,
            );
            await open(page);
            const side = page.getByRole('navigation', { name: 'Điều hướng Studio', exact: true });
            const bottom = page.getByRole('navigation', {
                name: 'Điều hướng Studio dưới',
                exact: true,
            });
            if (width < 640) {
                await expect(side).toBeHidden();
                await expect(bottom).toBeVisible();
                const barBox = await bottom.boundingBox();
                const tabsBox = await bottom
                    .locator('[data-slot="studio-bottom-tabs"]')
                    .boundingBox();
                expect(Math.abs(tabsBox.width - barBox.width)).toBeLessThan(1);
                await expect(bottom.getByRole('link')).toHaveCount(5);
                await expect(
                    bottom.getByRole('link', { name: 'Sách của tôi', exact: true }),
                ).toHaveAttribute('aria-current', 'page');
                for (const control of await bottom.getByRole('link').all()) {
                    const box = await control.boundingBox();
                    expect(box.width).toBe(48);
                    expect(box.height).toBe(48);
                    const icon = control.locator('svg');
                    await expect(icon).toHaveCSS('width', '22px');
                    await expect(icon).toHaveCSS('stroke-width', '1.8px');
                    const iconBox = await icon.boundingBox();
                    expect(
                        Math.abs(iconBox.x + iconBox.width / 2 - box.x - box.width / 2),
                    ).toBeLessThan(0.5);
                    expect(
                        Math.abs(iconBox.y + iconBox.height / 2 - box.y - box.height / 2),
                    ).toBeLessThan(0.5);
                }
                await bottom.getByRole('link', { name: 'Tài nguyên', exact: true }).click();
                await expect(
                    page.getByRole('heading', { name: 'Tài nguyên', exact: true }),
                ).toBeVisible();
                const trash = bottom.getByRole('link', { name: 'Thùng rác', exact: true });
                await trash.click();
                await expect(
                    page.getByRole('heading', { name: 'Thùng rác', exact: true }),
                ).toBeVisible();
                await expect(trash).toHaveAttribute('aria-current', 'page');
                await expect(trash).toHaveCSS('background-color', 'rgb(23, 23, 23)');
                await expect(
                    page.getByRole('button', { name: 'Thêm trong Studio', exact: true }),
                ).toHaveCount(0);
                await expect(
                    page.locator('main').getByRole('region', { name: 'Dung lượng tài nguyên' }),
                ).toBeVisible();
                const storage = await page
                    .locator('main')
                    .getByRole('region', { name: 'Dung lượng tài nguyên' })
                    .boundingBox();
                const heading = await page.getByRole('heading', { level: 1 }).boundingBox();
                expect(storage.y + storage.height).toBeLessThanOrEqual(heading.y);
                await page
                    .getByRole('button', { name: 'Cuối trang thử nghiệm', exact: true })
                    .scrollIntoViewIfNeeded();
                await page.evaluate(() =>
                    window.scrollTo(0, document.documentElement.scrollHeight),
                );
                const last = await page
                    .getByRole('button', { name: 'Cuối trang thử nghiệm', exact: true })
                    .boundingBox();
                const nav = await bottom.boundingBox();
                const themeButton = await page
                    .locator('[data-slot="floating-theme-switcher"]')
                    .boundingBox();
                expect(last.y + last.height).toBeLessThanOrEqual(nav.y);
                expect(themeButton.y + themeButton.height).toBeLessThanOrEqual(nav.y - 8);
            } else {
                await expect(bottom).toBeHidden();
                await expect(side).toBeVisible();
                const box = await page.locator('[data-slot="sidebar"]').boundingBox();
                expect(box.width).toBe(width < 1280 ? 44 : 224);
                await expect(side.getByRole('link')).toHaveCount(5);
                await expect(
                    side.getByRole('link', { name: 'Sách của tôi', exact: true }),
                ).toHaveAttribute('aria-current', 'page');
                if (width < 1280) {
                    const rail = page.locator('[data-slot="sidebar"]');
                    await expect(rail).toHaveCSS('padding-left', '0px');
                    await expect(rail).toHaveCSS('padding-right', '0px');
                    const logo = await page
                        .locator('.site-header')
                        .getByRole('link', { name: 'Bookaria - Trang chủ', exact: true })
                        .boundingBox();
                    expect(Math.abs(box.x - logo.x)).toBeLessThan(1);
                    await expect(
                        side.getByRole('button', {
                            name: 'Xem dung lượng tài nguyên',
                            exact: true,
                        }),
                    ).toHaveCount(0);
                    const storage = page
                        .locator('main')
                        .getByRole('region', { name: 'Dung lượng tài nguyên' });
                    await expect(storage).toBeVisible();
                    await expect(storage).toContainText('10 MB / 500 MB');
                    await expect(storage.getByRole('progressbar')).toBeVisible();
                    const storageBox = await storage.boundingBox();
                    const mainBox = await page.locator('.studio-main').boundingBox();
                    expect(
                        Math.abs(storageBox.x + storageBox.width - mainBox.x - mainBox.width),
                    ).toBeLessThan(1);
                    expect(Math.abs(storageBox.y - mainBox.y)).toBeLessThan(1);
                    const controls = await side.getByRole('link').all();
                    const boxes = await Promise.all(
                        controls.map((control) => control.boundingBox()),
                    );
                    for (let index = 0; index < boxes.length; index++) {
                        expect(boxes[index].width).toBe(44);
                        expect(boxes[index].height).toBe(44);
                        await expect(controls[index].locator('svg')).toHaveCSS('width', '20px');
                        if (index) {
                            expect(Math.abs(boxes[index].y - boxes[index - 1].y - 50)).toBeLessThan(
                                1,
                            );
                            expect(Math.abs(boxes[index].x - boxes[index - 1].x)).toBeLessThan(1);
                        }
                    }
                    await expect(side.getByRole('link').first().locator('span')).toHaveCSS(
                        'position',
                        'absolute',
                    );
                    await side.getByRole('link', { name: 'Thống kê', exact: true }).hover();
                    await expect(page.getByRole('tooltip')).toHaveText('Thống kê');
                } else {
                    const storageFooter = await page
                        .locator('[data-slot="sidebar-footer"]')
                        .boundingBox();
                    const navBox = await side.boundingBox();
                    expect(storageFooter.y).toBeGreaterThanOrEqual(navBox.y + navBox.height);
                    await expect(side.getByRole('link').first().locator('span')).toHaveCSS(
                        'position',
                        'static',
                    );
                    await expect(
                        page.getByRole('region', { name: 'Dung lượng tài nguyên' }),
                    ).toBeVisible();
                }
                await side.getByRole('link', { name: 'Thống kê', exact: true }).click();
                await expect(
                    page.getByRole('heading', { name: 'Thống kê', exact: true }),
                ).toBeVisible();
            }
            const size = await page.evaluate(() => ({
                scroll: document.documentElement.scrollWidth,
                available: document.documentElement.clientWidth,
            }));
            expect(size.scroll).toBeLessThanOrEqual(size.available);
            expect(errors).toEqual([]);
        });
    }
}

test('Studio keeps storage cards visible across breakpoints and excludes them from the editor', async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await open(page);
    const summary = page.locator('[data-slot="studio-storage-summary"]');
    await expect(summary.getByRole('region', { name: 'Dung lượng tài nguyên' })).toBeVisible();
    await page.setViewportSize({ width: 800, height: 900 });
    await expect(summary.getByRole('progressbar')).toBeVisible();
    const mainBox = await page.locator('.studio-main').boundingBox();
    const storageBox = await summary
        .getByRole('region', { name: 'Dung lượng tài nguyên' })
        .boundingBox();
    expect(Math.abs(storageBox.width - mainBox.width)).toBeLessThan(1);
    await expect(
        page.getByRole('button', { name: 'Xem dung lượng tài nguyên', exact: true }),
    ).toHaveCount(0);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(summary).toBeHidden();
    await expect(
        page
            .locator('[data-slot="sidebar-footer"]')
            .getByRole('region', { name: 'Dung lượng tài nguyên' }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 900 });
    await expect(summary.getByRole('progressbar')).toBeVisible();
    await page.getByRole('link', { name: 'Mở editor thử nghiệm', exact: true }).click();
    await expect(
        page.getByRole('heading', { name: 'Editor thử nghiệm', exact: true }),
    ).toBeVisible();
    await expect(
        page.getByRole('navigation', { name: 'Điều hướng Studio dưới', exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Dung lượng tài nguyên' })).toHaveCount(0);
    await expect(page.locator('.studio-editor-root')).toBeVisible();
});
