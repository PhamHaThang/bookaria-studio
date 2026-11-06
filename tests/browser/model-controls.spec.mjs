import { expect, test } from '@playwright/test';

async function open(page, theme = 'light', query = '') {
    await page.addInitScript((theme) => localStorage.setItem('bookaria.theme', theme), theme);
    await page.goto(`/tests/browser/model-controls.html${query}`);
    await page.waitForFunction(() => Boolean(window.__model?.runtime));
}
const position = (page, id = 'car') =>
    page.evaluate((id) => window.__model.runtime.nodes.get(id).root.position.toArray(), id);
test('model controls: keyboard, reset, question, tracking and disposal use the real preview runtime', async ({
    page,
}) => {
    await open(page);
    const canvas = page.getByRole('img', { name: 'Xem trước trang sách 3D' });
    await canvas.focus();
    await page.keyboard.down('d');
    await expect.poll(async () => (await position(page))[0]).toBeGreaterThan(0.03);
    await page.keyboard.up('d');
    expect((await position(page))[2]).toBe(0.17);
    await expect(page.locator('[data-model-controls]')).toBeHidden();
    await expect(
        page.getByRole('combobox', { name: 'Mô hình điều khiển', exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Về vị trí đầu', exact: true })).toHaveCount(0);
    await page.evaluate(() => window.__model.runtime.modelControls.command('car', 'reset'));
    expect((await position(page))[0]).toBe(0);
    await page.evaluate(() => {
        void window.__model.question();
    });
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.down('d');
    await page.keyboard.up('d');
    expect((await position(page))[0]).toBe(0);
    await page.getByRole('button', { name: 'Đồng ý', exact: true }).click();
    await page.getByRole('button', { name: 'Đóng', exact: true }).click();
    await canvas.focus();
    await page.keyboard.down('w');
    await expect.poll(async () => (await position(page))[1]).toBeGreaterThan(0.03);
    await page.evaluate(() => window.__model.runtime.markerLost());
    const stopped = await position(page);
    await expect(page.locator('[data-model-controls]')).toBeHidden();
    await page.keyboard.up('w');
    await page.evaluate(() => window.__model.runtime.markerFound());
    await expect(page.locator('[data-model-controls]')).toBeHidden();
    expect(await position(page)).toEqual(stopped);
    await page.evaluate(() =>
        window.__model.runtime.runner.fire({ type: 'onTap', objectId: 'car' }),
    );
    await expect(page.locator('[data-model-controls]')).toBeHidden();
    await page.evaluate(() => window.__model.runtime.dispose());
    await expect(page.locator('[data-model-controls]')).toHaveCount(0);
});
test('model controls: settings persist page-width units and model-only options', async ({
    page,
}) => {
    await open(page, 'dark');
    const speed = page.getByRole('textbox', { name: 'Tốc độ (mm/giây)' });
    await expect(speed).toHaveValue('63');
    await speed.fill('105');
    await speed.press('Tab');
    await expect.poll(() => page.evaluate(() => window.__modelConfig?.speed)).toBe(0.5);
    await page.getByRole('switch', { name: 'Bật khi mở trang' }).click();
    await expect.poll(() => page.evaluate(() => window.__modelConfig?.enabled)).toBe(false);
});
test.describe('touch model controls', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    test('model controls: joystick stops on release and touch cancellation', async ({ page }) => {
        await open(page, 'dark', '?multiple');
        const pad = page.getByRole('group', { name: 'Joystick di chuyển mô hình' });
        await expect(pad).toBeVisible();
        await expect(page.getByText('Điều khiển mô hình', { exact: true })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Về vị trí đầu', exact: true })).toHaveCount(
            0,
        );
        const box = await pad.boundingBox();
        const touch = await page.context().newCDPSession(page);
        await touch.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: box.x + box.width / 2 + 30, y: box.y + box.height / 2 }],
        });
        await expect.poll(async () => (await position(page))[0]).toBeGreaterThan(0.03);
        await touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
        const stopped = await position(page);
        const stoppedOther = await position(page, 'other');
        expect(stoppedOther[0]).toBeGreaterThan(-0.1);
        await expect
            .poll(() =>
                page.evaluate(
                    () => window.__model.runtime.modelControls.entries.get('car').root.position.x,
                ),
            )
            .toBe(stopped[0]);
        expect(await position(page, 'other')).toEqual(stoppedOther);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
    });
});

test('model controls: workflow nodes select only models and keep enable/disable/reset operations', async ({
    page,
}) => {
    await page.goto('/tests/browser/interaction.html?model-controls');
    const node = page.locator('[data-workflow-step="action-0"]');
    await node.getByRole('combobox', { name: /^Chức năng khối/ }).click();
    await page.getByRole('option', { name: 'Điều khiển mô hình', exact: true }).click();
    await node.getByRole('combobox', { name: /^Mục tiêu khối/ }).click();
    await expect(page.getByRole('option', { name: 'Khủng long', exact: true })).toHaveCount(0);
    await page.getByRole('option', { name: 'Xe thử nghiệm', exact: true }).click();
    for (const [label, operation] of [
        ['Tắt điều khiển', 'disable'],
        ['Đặt lại vị trí', 'reset'],
        ['Bật điều khiển', 'enable'],
    ]) {
        await node.getByRole('combobox', { name: /^Thao tác khối/ }).click();
        await page.getByRole('option', { name: label, exact: true }).click();
        await expect
            .poll(() => page.evaluate(() => window.__interaction.scene.interactions[0].actions[0]))
            .toMatchObject({ type: 'controlModel', objectId: 'car', operation });
    }
});

test('model controls: chosen idle/run clips switch during real keyboard movement', async ({
    page,
}) => {
    await open(page);
    const running = (name) =>
        page.evaluate((name) => {
            const node = window.__model.runtime.nodes.get('car');
            const clip = node.clips.find((clip) => clip.name === name);
            const action = node.mixer.existingAction(clip);
            return !!action?.isRunning() && action.getEffectiveWeight() > 0.95;
        }, name);
    await expect.poll(() => running('Idle')).toBe(true);
    const canvas = page.getByRole('img', { name: 'Xem trước trang sách 3D' });
    await canvas.focus();
    await page.keyboard.down('d');
    await expect.poll(() => running('Run')).toBe(true);
    await page.keyboard.up('d');
    await expect.poll(() => running('Idle')).toBe(true);
    await expect.poll(() => running('Run')).toBe(false);
    await page.getByRole('combobox', { name: 'Hoạt ảnh khi đứng yên', exact: true }).click();
    await page.getByRole('option', { name: 'Run', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__modelConfig?.idleClip)).toBe('Run');
});

test('model controls: all models follow keyboard input at their own speed and disabling one leaves the other moving', async ({
    page,
}) => {
    await open(page, 'light', '?multiple');
    const canvas = page.getByRole('img', { name: 'Xem trước trang sách 3D' });
    await canvas.focus();
    await page.keyboard.down('d');
    await expect.poll(async () => (await position(page))[0]).toBeGreaterThan(0.05);
    await page.keyboard.up('d');
    const both = await page.evaluate(() =>
        ['car', 'other'].map((id) => window.__model.runtime.nodes.get(id).root.position.toArray()),
    );
    expect(both[1][0] + 0.1).toBeCloseTo(both[0][0] / 2, 6);
    expect(both[0][2]).toBe(0.17);
    expect(both[1][2]).toBe(0.25);
    await canvas.focus();
    await page.keyboard.down('d');
    await page.evaluate(() =>
        window.__model.runtime.runner.fire({ type: 'onTap', objectId: 'car' }),
    );
    const stopped = await position(page);
    const previousOther = await position(page, 'other');
    await expect
        .poll(async () => (await position(page, 'other'))[0])
        .toBeGreaterThan(previousOther[0] + 0.03);
    await page.keyboard.up('d');
    expect(await position(page)).toEqual(stopped);
});
