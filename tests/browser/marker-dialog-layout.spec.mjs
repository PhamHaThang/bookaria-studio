import { expect, test } from '@playwright/test';

for (const [theme, width, height] of [
    ['light', 1280, 720],
    ['light', 1366, 768],
    ['dark', 1600, 900],
]) {
    test(`marker dialog ${theme} ${width}x${height}: metrics and actions fit without scrolling`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height });
        await page.addInitScript((value) => localStorage.setItem('bookaria.theme', value), theme);
        await page.goto('/tests/browser/editor-pages.html?pages=1&marker=1');
        const dialog = page.getByRole('dialog', { name: 'Thiết lập AR Marker', exact: true });
        const analysis = page.getByRole('region', { name: 'Đánh giá ảnh nhận diện', exact: true });
        await expect(analysis).toBeVisible();
        await expect(
            analysis.getByRole('img', { name: 'Phân bố điểm: 79%', exact: true }),
        ).toBeVisible();
        await expect(
            analysis.getByRole('img', { name: 'Độ độc đáo: 75%', exact: true }),
        ).toBeVisible();
        await expect(
            analysis.getByRole('img', { name: 'Kích thước ảnh: 100%', exact: true }),
        ).toBeVisible();
        const heatmap = analysis.getByRole('button', { name: 'Xem vùng nhận diện', exact: true });
        const rescore = analysis.getByRole('button', { name: 'Đánh giá lại', exact: true });
        await expect(heatmap).toBeVisible();
        await expect(rescore).toBeVisible();
        const bounds = await analysis.evaluate((element) => {
            const buttons = [...element.querySelectorAll('button')].map((button) =>
                button.getBoundingClientRect(),
            );
            const rect = element.getBoundingClientRect();
            const stars = [...element.querySelectorAll('[role="img"]')].map((row) =>
                row.getBoundingClientRect(),
            );
            const percentages = [...element.querySelectorAll('dd')].map((row) => {
                const range = document.createRange();
                range.selectNodeContents(row);
                return range.getBoundingClientRect();
            });
            const singleLine = [...element.querySelectorAll('button')].every((button) => {
                const range = document.createRange();
                range.selectNodeContents(button);
                return range.getClientRects().length === 1;
            });
            return {
                overflow: element.scrollHeight - element.clientHeight,
                sameRow: Math.abs(buttons[0].top - buttons[1].top),
                actionsInside: buttons.every((button) => button.bottom <= rect.bottom + 1),
                equalHeight: Math.abs(buttons[0].height - buttons[1].height),
                starAlignment:
                    Math.max(...stars.map((row) => row.left)) -
                    Math.min(...stars.map((row) => row.left)),
                percentageAlignment:
                    Math.max(...percentages.map((row) => row.right)) -
                    Math.min(...percentages.map((row) => row.right)),
                singleLine,
            };
        });
        expect(bounds.overflow).toBeLessThanOrEqual(1);
        expect(bounds.sameRow).toBeLessThanOrEqual(1);
        expect(bounds.actionsInside).toBe(true);
        expect(bounds.equalHeight).toBeLessThanOrEqual(1);
        expect(bounds.starAlignment).toBeLessThanOrEqual(1);
        expect(bounds.percentageAlignment).toBeLessThanOrEqual(1);
        expect(bounds.singleLine).toBe(true);
        await expect(dialog.getByRole('button', { name: 'Áp dụng', exact: true })).toBeVisible();
        await heatmap.click();
        await expect(
            analysis.getByRole('button', { name: 'Xem ảnh trang', exact: true }),
        ).toBeVisible();
        await page.screenshot({ path: info.outputPath(`marker-dialog-${theme}-${width}.png`) });
    });
}
