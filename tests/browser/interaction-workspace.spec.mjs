import { expect, test } from '@playwright/test';

const route = '/tests/browser/interaction.html';
async function chooseInNode(page, node, label) {
    await node.getByRole('combobox', { name: /^Chức năng khối/ }).click();
    await page.getByRole('option', { name: label, exact: true }).click();
}

async function chooseNodeTarget(page, node, label) {
    await node.getByRole('combobox', { name: /^Mục tiêu khối/ }).click();
    await page.getByRole('option', { name: label, exact: true }).click();
}
async function open(page, theme = 'light') {
    await page.addInitScript((theme) => localStorage.setItem('bookaria.theme', theme), theme);
    await page.goto(route);
    await expect(page.getByTestId('interaction-flow-canvas')).toBeVisible();
    await expect(page.locator('[data-workflow-step]')).toHaveCount(4);
    // Missing vendor CSS leaves panels/handles in normal flow and breaks all hit testing.
    await expect(page.locator('.react-flow__panel').first()).toHaveCSS('position', 'absolute');
    await expect(page.locator('.react-flow__handle').first()).toHaveCSS('position', 'absolute');
    await expect(page.locator('.react-flow__handle').first()).toHaveCSS('border-radius', '100%');
    await expect(page.locator('.react-flow__node').first()).toHaveCSS('pointer-events', 'all');
    const placement = await page.evaluate(() => {
        const canvas = document
            .querySelector('[data-testid="interaction-flow-canvas"]')
            .getBoundingClientRect();
        const panel = document
            .querySelector('.react-flow__panel.bottom.left')
            .getBoundingClientRect();
        return { bottom: canvas.bottom - panel.bottom, left: panel.left - canvas.left };
    });
    expect(placement.bottom).toBeGreaterThanOrEqual(0);
    expect(placement.bottom).toBeLessThan(30);
    expect(placement.left).toBeGreaterThanOrEqual(0);
    expect(placement.left).toBeLessThan(30);
}
for (const [theme, width, height] of [
    ['light', 1366, 768],
    ['dark', 1600, 900],
]) {
    test(`workspace ${theme}: insert, retarget, drag, persist and no page overflow`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height });
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        page.on('console', (message) => {
            if (message.text().includes('[React Flow]:')) errors.push(message.text());
        });
        await open(page, theme);
        await page.getByRole('button', { name: 'Chèn bước vào đây', exact: true }).first().click();
        await page.getByRole('button', { name: 'Hành động', exact: true }).last().click();
        await expect(page.locator('[data-workflow-step]')).toHaveCount(5);
        expect(
            await page.evaluate(() => window.__interaction.scene.interactions[0].actions[0].type),
        ).toBe('wait');
        await page.getByTestId('scene-history-undo').click();
        await expect(page.locator('[data-workflow-step]')).toHaveCount(4);
        const node = page.locator('[data-workflow-step="action-0"]');
        await chooseNodeTarget(page, node, 'Khủng long');
        await expect
            .poll(() =>
                page.evaluate(() => window.__interaction.scene.interactions[0].actions[0].objectId),
            )
            .toBe('source');
        const header = node.locator('.workflow-drag');
        const bounds = await header.boundingBox();
        const updates = await page.evaluate(() => window.__interaction.updates);
        await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
        await page.mouse.down();
        await page.mouse.move(bounds.x + bounds.width / 2 + 35, bounds.y + bounds.height / 2 + 45, {
            steps: 10,
        });
        expect(await page.evaluate(() => window.__interaction.updates)).toBe(updates);
        await page.mouse.up();
        await expect
            .poll(() => page.evaluate(() => window.__interaction.updates))
            .toBeGreaterThan(updates);
        const saved = await page.evaluate(
            () => window.__interaction.scene.interactions[0].editorLayout,
        );
        await page.getByRole('button', { name: 'Lưu sách', exact: true }).click();
        await page.reload();
        await expect(page.locator('[data-workflow-step]')).toHaveCount(4);
        expect(
            await page.evaluate(() => window.__interaction.scene.interactions[0].editorLayout),
        ).toEqual(saved);
        const overflow = await page.evaluate(() => ({
            x: document.documentElement.scrollWidth > innerWidth,
            y: document.documentElement.scrollHeight > innerHeight,
        }));
        expect(overflow).toEqual({ x: false, y: false });
        expect(errors).toEqual([]);
        await page.screenshot({ path: info.outputPath(`workspace-${theme}.png`) });
    });
}
test('runs the real scene runtime, reports wait/completion and restores authored objects', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await open(page);
    const before = await page.evaluate(() => structuredClone(window.__interaction.scene.objects));
    await page.getByRole('button', { name: 'Tùy chọn chạy thử', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Chạy riêng luồng đang chọn', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Chạy', exact: true })).toBeEnabled({
        timeout: 30000,
    });
    await page.getByRole('button', { name: 'Chạy', exact: true }).click();
    await expect(page.locator('[data-step-state="waiting"]')).toHaveCount(1);
    await expect(page.locator('[data-step-state="done"]')).toHaveCount(3);
    await page.getByRole('button', { name: 'Đóng thử', exact: true }).click();
    expect(await page.evaluate(() => window.__interaction.scene.objects)).toEqual(before);
    await page.getByRole('button', { name: 'Hành động', exact: true }).click();
    await chooseInNode(page, page.locator('[data-workflow-step]').last(), 'Chuyển động');
    await expect(page.getByRole('radio', { name: 'Di chuyển (W)', exact: true })).toBeEnabled({
        timeout: 30000,
    });
    await page.getByRole('button', { name: 'Đóng thiết lập bước', exact: true }).click();
    await expect(
        page.getByRole('region', { name: 'Đặt trạng thái đích trong scene', exact: true }),
    ).toHaveCount(0);
    expect(await page.evaluate(() => window.__interaction.scene.objects)).toEqual(before);
});
test('incomplete workflow survives reload, guards leaving and becomes saveable after correction', async ({
    page,
}) => {
    await open(page);
    await page.getByRole('button', { name: 'Lưu sách', exact: true }).click();
    await page.getByRole('button', { name: 'Điều hướng', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Lưu sách', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Thiết kế', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Tiếp tục sửa', exact: true }).click();
    await page.reload();
    await expect(page.locator('[data-workflow-step]')).toHaveCount(5);
    await page.locator('[data-workflow-step]').last().click();
    await page.getByPlaceholder('https://...').fill('https://example.com');
    await expect(page.getByRole('button', { name: 'Lưu sách', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Lưu sách', exact: true }).click();
    await page.reload();
    await expect(page.locator('[data-workflow-step]')).toHaveCount(5);
    expect(
        await page.evaluate(() =>
            window.__interaction.scene.interactions[0].actions.some(
                (action) => action.type === 'openUrl' && action.url === 'https://example.com',
            ),
        ),
    ).toBe(true);
});

test('page-level undo restores a deleted workflow and updates an open canvas without overwriting history', async ({
    page,
}) => {
    await open(page);
    await page.getByRole('button', { name: 'Xóa luồng “Chạm để khám phá”', exact: true }).click();
    await page
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Xóa luồng', exact: true })
        .click();
    await expect(page.locator('[data-workflow-step]')).toHaveCount(0);
    await page.getByTestId('scene-history-undo').click();
    await page.getByRole('button', { name: /Chạm để khám phá Khi chạm/ }).click();
    await expect(page.locator('[data-workflow-step]')).toHaveCount(4);
    const name = page.getByRole('textbox', { name: 'Tên luồng tương tác', exact: true });
    await name.fill('Đã đổi tên');
    await expect
        .poll(() => page.evaluate(() => window.__interaction.scene.interactions[0].name))
        .toBe('Đã đổi tên');
    await page.getByTestId('scene-history-undo').click();
    await expect(name).toHaveValue('Chạm để khám phá');
});
test('palette drag inserts on a connection and targets are chosen directly inside nodes', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await open(page);
    await page
        .getByRole('button', { name: 'Hành động', exact: true })
        .dragTo(page.getByRole('button', { name: 'Chèn bước vào đây', exact: true }).first());
    await expect(page.locator('[data-workflow-step]')).toHaveCount(5);
    await chooseNodeTarget(page, page.locator('[data-workflow-step="start"]'), 'Thông tin');
    await expect
        .poll(() =>
            page.evaluate(() => window.__interaction.scene.interactions[0].trigger.objectId),
        )
        .toBe('target');
    expect(await page.evaluate(() => window.__interaction.scene.objects.length)).toBe(2);
});

test('whole node body drags smoothly and its final position survives reload', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await open(page);
    await expect
        .poll(() =>
            page.evaluate(() => window.__interaction.scene.interactions[0].editorLayout?.length),
        )
        .toBe(4);
    const before = await page.evaluate(() =>
        window.__interaction.scene.interactions[0].editorLayout.find(
            (node) => node.id === 'action-0',
        ),
    );
    const body = page.locator('[data-workflow-step="action-0"] p').first();
    const box = await body.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 110, box.y + box.height / 2 + 80, { steps: 18 });
    await page.mouse.up();
    await expect
        .poll(async () =>
            page.evaluate(
                () =>
                    window.__interaction.scene.interactions[0].editorLayout.find(
                        (node) => node.id === 'action-0',
                    ).x,
            ),
        )
        .toBeGreaterThan(before.x + 50);
    const after = await page.evaluate(() =>
        window.__interaction.scene.interactions[0].editorLayout.find(
            (node) => node.id === 'action-0',
        ),
    );
    expect(after.y).toBeGreaterThan(before.y + 30);
    await page.getByRole('button', { name: 'Lưu sách', exact: true }).click();
    await page.reload();
    await expect(page.locator('[data-workflow-step="action-0"]')).toBeVisible();
    expect(
        await page.evaluate(() =>
            window.__interaction.scene.interactions[0].editorLayout.find(
                (node) => node.id === 'action-0',
            ),
        ),
    ).toEqual(after);
    expect(errors).toEqual([]);
});

test('condition inserts true/false branches and can be retargeted and saved', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await open(page);
    await page.getByRole('button', { name: 'Điều kiện', exact: true }).click();
    await expect(page.locator('[data-workflow-step]')).toHaveCount(7);
    await expect(page.getByLabel('Nhánh Đúng', { exact: true })).toHaveCount(1);
    await expect(page.getByLabel('Nhánh Sai', { exact: true })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Lưu sách', exact: true })).toBeEnabled();
    const condition = await page.evaluate(() => window.__interaction.scene.interactions[0]);
    expect(condition.actions.some((action) => action.type === 'condition')).toBe(true);
    expect(condition.workflow.edges.filter((edge) => edge.port === 'true')).toHaveLength(1);
    expect(condition.workflow.edges.filter((edge) => edge.port === 'false')).toHaveLength(1);
    await page.getByRole('button', { name: 'Lưu sách', exact: true }).click();
    await page.reload();
    await expect(page.locator('[data-workflow-step]')).toHaveCount(7);
    expect(await page.evaluate(() => window.__interaction.scene.interactions[0].workflow)).toEqual(
        condition.workflow,
    );
});

test('quiz template asks, reports correct answer and runs only its chosen branches', async ({
    page,
}, info) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await open(page);
    await page.getByRole('button', { name: 'Thêm tương tác', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Dùng mẫu', exact: true }).click();
    const templates = page.getByRole('dialog', { name: 'Chọn mẫu tương tác', exact: true });
    await expect(templates).toBeVisible();
    await templates.getByRole('radio', { name: 'Câu hỏi Đúng / Sai', exact: true }).check();
    await expect(templates.getByRole('button', { name: 'Sử dụng mẫu', exact: true })).toBeEnabled();
    await page.screenshot({
        animations: 'disabled',
        path: info.outputPath('template-modal-light.png'),
    });
    await templates.getByRole('button', { name: 'Sử dụng mẫu', exact: true }).click();
    await page.getByRole('button', { name: 'Tạo tương tác', exact: true }).click();
    await expect(page.locator('[data-workflow-step]')).toHaveCount(7);
    await expect
        .poll(() => page.evaluate(() => window.__interaction.scene.interactions.length))
        .toBe(2);
    await page.getByRole('button', { name: 'Tự sắp xếp luồng', exact: true }).click();
    await page.screenshot({ path: info.outputPath('workflow-quiz.png') });
    await page.getByRole('button', { name: 'Tùy chọn chạy thử', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Chạy riêng luồng đang chọn', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Chạy', exact: true })).toBeEnabled({
        timeout: 30000,
    });
    await page.getByRole('button', { name: 'Chạy', exact: true }).click();
    const question = page.getByRole('dialog', { name: 'Câu hỏi tương tác', exact: true });
    await expect(question).toBeVisible();
    await expect(question.getByRole('button', { name: 'Trả lời', exact: true })).toHaveCount(0);
    await question.getByRole('button', { name: 'Đã tìm thấy', exact: true }).click();
    await expect(question.getByRole('status')).toContainText('Bạn đã trả lời đúng.');
    await question.getByRole('button', { name: 'Đóng', exact: true }).click();
    await expect(question).toHaveCount(0);
    await expect(
        page.locator('[data-workflow-step="step-4"][data-step-state="done"]'),
    ).toBeVisible();
    await expect(page.locator('[data-workflow-step="step-5"][data-step-state="done"]')).toHaveCount(
        0,
    );
    await page.getByRole('button', { name: 'Đóng thử', exact: true }).click();
    expect(await page.evaluate(() => window.__interaction.scene.objects.length)).toBe(2);
});

test('drag a trigger, disconnect and reconnect a real wire, and keep custom state fields focused', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await open(page);
    const canvas = page.getByTestId('interaction-flow-canvas');
    await page
        .getByRole('button', { name: 'Sự kiện', exact: true })
        .dragTo(canvas, { targetPosition: { x: 130, y: 50 } });
    await chooseInNode(
        page,
        page.locator('[data-workflow-step="start"]'),
        'Khi nhận diện trang AR',
    );
    await expect
        .poll(() => page.evaluate(() => window.__interaction.scene.interactions[0].trigger.type))
        .toBe('onMarkerFound');
    const wire = page.locator('.react-flow__edge[data-id="start:action-0"] .react-flow__edge-path');
    const point = await wire.evaluate((path) => {
        const point = path.getPointAtLength(path.getTotalLength() * 0.85);
        const transformed = new DOMPoint(point.x, point.y).matrixTransform(path.getScreenCTM());
        return { x: transformed.x, y: transformed.y };
    });
    await page.mouse.click(point.x, point.y);
    await page.getByRole('button', { name: 'Ngắt dây nối', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Lưu sách', exact: true })).toBeDisabled();
    const source = page.locator('[data-workflow-step="start"] .react-flow__handle.source');
    const target = page.locator('[data-workflow-step="action-0"] .react-flow__handle.target');
    const a = await source.boundingBox(),
        b = await target.boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 16 });
    await page.mouse.up();
    await expect(page.getByRole('button', { name: 'Lưu sách', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Ghi nhớ', exact: true }).click();
    await page.getByRole('button', { name: 'Tạo thông tin', exact: true }).click();
    const manager = page.getByRole('dialog', {
        name: /^(Thêm|Sửa) thông tin ghi nhớ$/,
        exact: true,
    });
    const name = manager.getByRole('textbox', { name: 'Tên thông tin', exact: true });
    await name.fill('Đã tìm khủng long');
    await expect(name).toBeFocused();
    await manager.getByRole('button', { name: /^(Thêm|Lưu) thông tin$/, exact: true }).click();
    await expect(manager).toHaveCount(0);
    const definition = await page.evaluate(() =>
        window.__interaction.workflowVariables.find((item) => item.key.startsWith('state_')),
    );
    expect(definition.name).toBe('Đã tìm khủng long');
    expect(definition.type).toBe('boolean');
    await expect
        .poll(() =>
            page.evaluate(
                (key) =>
                    window.__interaction.scene.interactions[0].actions.some(
                        (action) =>
                            action.type === 'setState' &&
                            action.key === key &&
                            action.value === true,
                    ),
                definition.key,
            ),
        )
        .toBe(true);
    const row = page
        .getByRole('region', { name: 'Thông tin ghi nhớ của sách', exact: true })
        .locator('li')
        .filter({ has: page.getByText('Đã tìm khủng long', { exact: true }) });
    await expect(
        row.getByRole('button', { name: 'Xóa Đã tìm khủng long', exact: true }),
    ).toBeDisabled();
    await row
        .getByRole('button', { name: 'Sửa thông tin “Đã tìm khủng long”', exact: true })
        .click();
    await expect(
        manager.getByRole('combobox', { name: 'Loại thông tin', exact: true }),
    ).toBeDisabled();
    await manager.getByRole('textbox', { name: 'Tên thông tin', exact: true }).fill('Đã khám phá');
    await manager.getByRole('button', { name: /^(Thêm|Lưu) thông tin$/, exact: true }).click();
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.__interaction.workflowVariables.find((item) =>
                        item.key.startsWith('state_'),
                    ).name,
            ),
        )
        .toBe('Đã khám phá');
    expect(
        await page.evaluate(
            (key) =>
                window.__interaction.scene.interactions[0].actions.some(
                    (action) => action.type === 'setState' && action.key === key,
                ),
            definition.key,
        ),
    ).toBe(true);
    await page.getByRole('button', { name: 'Lưu sách', exact: true }).click();
    await page.reload();
    await page.getByRole('tab', { name: /^Ghi nhớ \(/ }).click();
    await expect(
        page
            .getByRole('region', { name: 'Thông tin ghi nhớ của sách', exact: true })
            .getByText('Đã khám phá', { exact: true }),
    ).toBeVisible();
});

test('whole-book preview navigates and completes page-leave state before entering the next page', async ({
    page,
}) => {
    await page.route('**/api/v1/pages/33333333-3333-4333-8333-333333333333', async (route) => {
        const next = await page.evaluate(() => window.__previewSecondPage);
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: next }),
        });
    });
    await page.goto('/tests/browser/book-preview.html');
    await expect(page.getByRole('button', { name: 'Bắt đầu xem', exact: true })).toBeEnabled({
        timeout: 30000,
    });
    await page.getByRole('button', { name: 'Bắt đầu xem', exact: true }).click();
    const question = page.getByRole('dialog', { name: 'Câu hỏi tương tác', exact: true });
    await expect(
        question.getByRole('heading', { name: 'Tiến trình đã truyền sang trang 2', exact: true }),
    ).toBeVisible({ timeout: 30000 });
    await question.getByRole('button', { name: 'Đóng câu hỏi', exact: true }).click();
});

test('five grouped blocks choose their function inside the node without moving it or breaking wires', async ({
    page,
}, info) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await open(page);
    for (const name of ['Sự kiện', 'Điều kiện', 'Hành động', 'Ghi nhớ', 'Điều hướng']) {
        await expect(page.getByRole('button', { name, exact: true })).toHaveCount(1);
    }
    await expect(
        page.getByRole('button', { name: 'Khi nhận diện trang AR', exact: true }),
    ).toHaveCount(0);
    const first = page.locator('[data-workflow-step="action-0"]');
    const before = await page.evaluate(() =>
        structuredClone(window.__interaction.scene.interactions[0]),
    );
    await first.getByRole('combobox', { name: /^Chức năng khối/ }).click();
    await expect(page.getByRole('option', { name: 'Phát video', exact: true })).toBeDisabled();
    await expect(
        page.getByRole('option', { name: 'Điều khiển mô hình', exact: true }),
    ).toBeDisabled();
    await expect(page.getByRole('option')).toHaveCount(8);
    await page.keyboard.press('Escape');
    await first.getByRole('combobox', { name: /^Thao tác khối/ }).click();
    await page.getByRole('option', { name: 'Ẩn', exact: true }).click();
    await expect
        .poll(() =>
            page.evaluate(() => window.__interaction.scene.interactions[0].actions[0].value),
        )
        .toBe(false);
    const after = await page.evaluate(() => window.__interaction.scene.interactions[0]);
    expect(after.editorLayout).toEqual(before.editorLayout);
    expect(after.workflow).toEqual(before.workflow);
    expect(after.actions[0].objectId).toBe(before.actions[0].objectId);
    await chooseInNode(page, first, 'Hiển thị câu hỏi');
    await expect(
        page.getByRole('textbox', { name: 'Nội dung câu hỏi', exact: true }),
    ).toBeVisible();
    await chooseInNode(page, first, 'Hiển thị đối tượng');
    await page.getByRole('button', { name: 'Lưu sách', exact: true }).click();
    await page.reload();
    await expect(first.getByRole('combobox', { name: /^Chức năng khối/ })).toHaveText(
        'Hiển thị đối tượng',
    );
    await page.screenshot({ path: info.outputPath('grouped-blocks.png') });
});

test('left workflow list stays above blocks while inline targets preserve graph and page/object event scope', async ({
    page,
}, info) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await open(page);
    await expect(
        page.getByRole('region', { name: 'Danh sách đối tượng', exact: true }),
    ).toHaveCount(0);
    await expect(
        page.getByRole('searchbox', { name: 'Tìm đối tượng trong tương tác', exact: true }),
    ).toHaveCount(0);
    const workflows = await page
        .getByRole('region', { name: 'Danh sách luồng tương tác', exact: true })
        .boundingBox();
    const blocks = await page.getByRole('region', { name: 'Thêm khối', exact: true }).boundingBox();
    expect(workflows.y + workflows.height).toBeLessThanOrEqual(blocks.y);
    const before = await page.evaluate(() =>
        structuredClone(window.__interaction.scene.interactions[0]),
    );
    const node = page.locator('[data-workflow-step="action-0"]');
    await chooseNodeTarget(page, node, 'Khủng long');
    await expect
        .poll(() =>
            page.evaluate(() => window.__interaction.scene.interactions[0].actions[0].objectId),
        )
        .toBe('source');
    const root = page.locator('[data-workflow-step="start"]');
    await chooseNodeTarget(page, root, 'Trang hiện tại (scene)');
    await expect
        .poll(() => page.evaluate(() => window.__interaction.scene.interactions[0].trigger.type))
        .toBe('onPageEnter');
    await expect(root.getByRole('combobox', { name: /^Chức năng khối/ })).toContainText(
        'Khi vào trang',
    );
    await chooseNodeTarget(page, root, 'Thông tin');
    await expect
        .poll(() => page.evaluate(() => window.__interaction.scene.interactions[0].trigger))
        .toEqual({ type: 'onTap', objectId: 'target' });
    const after = await page.evaluate(() => window.__interaction.scene.interactions[0]);
    expect(after.workflow).toEqual(before.workflow);
    expect(after.editorLayout).toEqual(before.editorLayout);
    await page.getByRole('button', { name: 'Lưu sách', exact: true }).click();
    await page.reload();
    await expect(root.getByRole('combobox', { name: /^Mục tiêu khối/ })).toContainText('Thông tin');
    await expect(node.getByRole('combobox', { name: /^Mục tiêu khối/ })).toContainText(
        'Khủng long',
    );
    await page.screenshot({ path: info.outputPath('inline-targets.png') });
});

test('left workflow list searches flows and guards an unfinished flow before switching', async ({
    page,
}) => {
    await open(page);
    await page.getByRole('button', { name: 'Thêm tương tác', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Luồng mới', exact: true }).click();
    await expect(page.locator('[data-workflow-step]')).toHaveCount(1);
    await page
        .getByRole('searchbox', { name: 'Tìm luồng tương tác', exact: true })
        .fill('Chạm để khám phá');
    await page.getByRole('button', { name: /Chạm để khám phá Khi chạm/ }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Tiếp tục sửa', exact: true }).click();
    await expect(page.locator('[data-workflow-step]')).toHaveCount(1);
    await page.getByRole('button', { name: /Chạm để khám phá Khi chạm/ }).click();
    await page.getByRole('button', { name: 'Bỏ phần chưa hoàn thiện', exact: true }).click();
    await expect(page.locator('[data-workflow-step]')).toHaveCount(4);
});

test('add menu has two choices and the template modal searches, explains unavailable templates and cancels safely', async ({
    page,
}, info) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await open(page, 'dark');
    const before = await page.evaluate(() =>
        structuredClone(window.__interaction.scene.interactions),
    );
    const add = page.getByRole('button', { name: 'Thêm tương tác', exact: true });
    await add.click();
    await expect(page.getByRole('menuitem')).toHaveCount(2);
    await expect(page.getByRole('menuitem', { name: 'Luồng mới', exact: true })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Dùng mẫu', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Chọn mẫu tương tác', exact: true });
    await expect(dialog).toBeVisible();
    const scrollArea = dialog.locator('[data-template-scroll]');
    const geometry = await dialog.evaluate((element) => {
        const body = element.querySelector('[data-template-scroll]');
        const footer = element.querySelector('[data-slot=dialog-footer]');
        return {
            scrolls: body.scrollHeight > body.clientHeight,
            bottom: body.getBoundingClientRect().bottom,
            footerTop: footer.getBoundingClientRect().top,
        };
    });
    expect(geometry.scrolls).toBe(true);
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.footerTop + 1);
    await scrollArea.evaluate((element) => {
        element.scrollTop = element.scrollHeight;
    });
    const lastCard = await dialog.getByRole('radio').last().locator('..').boundingBox();
    const bodyBounds = await scrollArea.boundingBox();
    expect(lastCard.y + lastCard.height).toBeLessThanOrEqual(bodyBounds.y + bodyBounds.height);
    await scrollArea.evaluate((element) => {
        element.scrollTop = 0;
    });
    await expect(
        dialog.getByRole('searchbox', { name: 'Tìm mẫu tương tác', exact: true }),
    ).toBeFocused();
    await expect(dialog.getByRole('button', { name: 'Sử dụng mẫu', exact: true })).toBeDisabled();
    await expect(
        dialog.getByRole('radio', { name: 'Chạm để phát video', exact: true }),
    ).toBeDisabled();
    await expect(
        dialog.getByText('Thêm một video vào trang trước.', { exact: true }),
    ).toBeVisible();
    await dialog
        .getByRole('searchbox', { name: 'Tìm mẫu tương tác', exact: true })
        .fill('không có mẫu này');
    await expect(dialog.getByText('Không tìm thấy mẫu phù hợp', { exact: true })).toBeVisible();
    await dialog.getByRole('searchbox', { name: 'Tìm mẫu tương tác', exact: true }).fill('');
    await dialog.getByRole('combobox', { name: 'Nhóm mẫu', exact: true }).click();
    await page.getByRole('option', { name: 'Nhiệm vụ và đố vui', exact: true }).click();
    await expect(dialog.getByRole('radio')).toHaveCount(4);
    await page.screenshot({
        animations: 'disabled',
        path: info.outputPath('template-modal-dark.png'),
    });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(add).toBeFocused();
    expect(await page.evaluate(() => window.__interaction.scene.interactions)).toEqual(before);
    await expect(page.locator('[data-workflow-step]')).toHaveCount(4);
    await add.click();
    await page.getByRole('menuitem', { name: 'Luồng mới', exact: true }).click();
    await expect(page.locator('[data-workflow-step]')).toHaveCount(1);
    await expect(page.getByRole('dialog', { name: 'Chọn mẫu tương tác', exact: true })).toHaveCount(
        0,
    );
});

for (const theme of ['light', 'dark']) {
    test(`add popup ${theme}: anchors to plus, stays steady and dismisses outside the canvas controls`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width: 1366, height: 768 });
        await open(page, theme);
        const plus = page.getByRole('button', { name: 'Chèn bước vào đây', exact: true }).first();
        const popup = page.getByRole('dialog', { name: 'Thêm khối tương tác', exact: true });
        await plus.click();
        await expect(popup).toBeVisible();
        await expect(popup.getByRole('textbox')).toHaveCount(0);
        await expect(
            popup.getByText('Điểm số, đáp án, số lần chạm, hiển thị…', { exact: true }),
        ).toBeVisible();
        await expect
            .poll(async () => {
                const button = await plus.boundingBox(),
                    menu = await popup.boundingBox();
                return Math.abs(menu.x - button.x);
            })
            .toBeLessThan(12);
        await expect
            .poll(async () => {
                const button = await plus.boundingBox(),
                    menu = await popup.boundingBox();
                return Math.min(
                    Math.abs(menu.y - button.y - button.height),
                    Math.abs(button.y - menu.y - menu.height),
                );
            })
            .toBeLessThan(14);
        const position = await popup.boundingBox();
        await popup.getByRole('button', { name: 'Hành động', exact: true }).hover();
        await expect
            .poll(async () => Math.abs((await popup.boundingBox()).x - position.x))
            .toBeLessThan(1);
        await page.screenshot({
            animations: 'disabled',
            path: info.outputPath(`anchored-popup-${theme}.png`),
        });
        await plus.click();
        await expect(popup).toHaveCount(0);
        await plus.click();
        await page.locator('[data-workflow-step="action-0"] .workflow-drag').click();
        await expect(popup).toHaveCount(0);
        await plus.click();
        const name = page.getByRole('textbox', { name: 'Tên luồng tương tác', exact: true });
        await name.click();
        await expect(popup).toHaveCount(0);
        await expect(name).toBeFocused();
        await plus.click();
        await page.keyboard.press('Escape');
        await expect(popup).toHaveCount(0);
        await expect(plus).toBeFocused();
        await plus.click();
        const bounds = await page.getByTestId('interaction-flow-canvas').boundingBox();
        await page.mouse.click(bounds.x + 24, bounds.y + 24);
        await expect(popup).toHaveCount(0);
    });
}

test('inserting on a condition branch keeps the sibling in place and puts the new step on the chosen wire', async ({
    page,
}, info) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await open(page);
    await page.getByRole('button', { name: 'Điều kiện', exact: true }).click();
    await expect(page.locator('[data-workflow-step]')).toHaveCount(7);
    const condition = await page
        .locator('[data-workflow-step][aria-label="Điều kiện"]')
        .getAttribute('data-workflow-step');
    for (const port of ['false', 'true']) {
        await page.getByRole('button', { name: 'Vừa toàn bộ luồng', exact: true }).click();
        const before = await page.evaluate(() =>
            structuredClone(window.__interaction.scene.interactions[0]),
        );
        const outgoing = before.workflow.edges.filter((edge) => edge.source === condition);
        const original = outgoing.find((edge) => edge.port === port).target;
        const sibling = outgoing.find((edge) => edge.port !== port).target;
        const plus = page.locator(
            `[data-flow-after="${condition}"][data-flow-port="${port}"] button`,
        );
        await plus.click();
        const popup = page.getByRole('dialog', { name: 'Thêm khối tương tác', exact: true });
        await expect(popup).toBeVisible();
        await popup.getByRole('button', { name: 'Hành động', exact: true }).click();
        await expect(popup).toHaveCount(0);
        await expect
            .poll(() =>
                page.evaluate(() => window.__interaction.scene.interactions[0].actions.length),
            )
            .toBe(before.actions.length + 1);
        const after = await page.evaluate(() => window.__interaction.scene.interactions[0]);
        const fresh = after.editorLayout.find(
            (node) => !before.editorLayout.some((previous) => previous.id === node.id),
        );
        const oldPosition = before.editorLayout.find((node) => node.id === original);
        expect({ x: fresh.x, y: fresh.y }).toEqual({ x: oldPosition.x, y: oldPosition.y });
        expect(after.editorLayout.find((node) => node.id === sibling)).toEqual(
            before.editorLayout.find((node) => node.id === sibling),
        );
        expect(
            after.workflow.edges.some(
                (edge) =>
                    edge.source === condition && edge.port === port && edge.target === fresh.id,
            ),
        ).toBe(true);
        expect(
            after.workflow.edges.some(
                (edge) => edge.source === fresh.id && edge.target === original,
            ),
        ).toBe(true);
    }
    await page.getByRole('button', { name: 'Vừa toàn bộ luồng', exact: true }).click();
    await page.screenshot({
        animations: 'disabled',
        path: info.outputPath('branch-insertion.png'),
    });
});

test('interaction canvas uses the footer space and unfinished workflows remain guarded', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await open(page);
    const workspace = page.getByRole('region', { name: 'Workspace tương tác', exact: true });
    const canvas = page.getByTestId('interaction-flow-canvas');
    await expect(workspace.locator('footer')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Thêm bước', exact: true })).toHaveCount(0);
    const before = await canvas.boundingBox(),
        container = await workspace.boundingBox();
    expect(Math.abs(before.y + before.height - container.y - container.height)).toBeLessThanOrEqual(
        1,
    );
    await page.getByRole('button', { name: 'Điều hướng', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Lưu sách', exact: true })).toBeDisabled();
    expect((await canvas.boundingBox()).height).toBe(before.height);
    expect(
        await page.evaluate(() => ({
            x: document.documentElement.scrollWidth > innerWidth,
            y: document.documentElement.scrollHeight > innerHeight,
        })),
    ).toEqual({ x: false, y: false });
});

test('clicking empty canvas clears node and wire selection without changing the workflow', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await open(page);
    const inspector = page.getByRole('complementary', { name: 'Thiết lập bước tương tác' });
    const action = page.locator('[data-workflow-step="action-0"]');
    const root = page.locator('[data-workflow-step="start"]');
    const pane = page.locator('.react-flow__pane');
    const snapshot = await page.evaluate(() => JSON.stringify(window.__interaction.scene));
    const updates = await page.evaluate(() => window.__interaction.updates);
    await action.locator('.workflow-drag').click();
    await expect(action.locator('..')).toHaveClass(/selected/);
    await expect(inspector).toBeVisible();
    await action.getByRole('combobox', { name: /^Chức năng khối/ }).click();
    await page.keyboard.press('Escape');
    await expect(inspector).toBeVisible();
    await expect(action.locator('..')).toHaveClass(/selected/);
    await pane.click({ position: { x: 200, y: 35 } });
    await expect(page.locator('.react-flow__node.selected')).toHaveCount(0);
    await expect(inspector).toHaveCount(0);
    await root.locator('.workflow-drag').click();
    await expect(root.locator('..')).toHaveClass(/selected/);
    await expect(inspector).toBeVisible();
    await pane.click({ position: { x: 200, y: 35 } });
    await expect(inspector).toHaveCount(0);
    const wire = await page
        .locator('.react-flow__edge-interaction')
        .first()
        .evaluate((path) => {
            const point = path.getPointAtLength(path.getTotalLength() * 0.85);
            const screen = point.matrixTransform(path.getScreenCTM());
            return { x: screen.x, y: screen.y };
        });
    await page.mouse.click(wire.x, wire.y);
    await expect(page.locator('.react-flow__edge.selected')).toHaveCount(1);
    await expect(inspector).toBeVisible();
    await expect(inspector.getByRole('heading', { name: 'Đường nối', exact: true })).toBeVisible();
    await pane.click({ position: { x: 200, y: 35 } });
    await expect(page.locator('.react-flow__edge.selected')).toHaveCount(0);
    await expect(page.locator('.react-flow__node.selected')).toHaveCount(0);
    await expect(inspector).toHaveCount(0);
    expect(await page.evaluate(() => JSON.stringify(window.__interaction.scene))).toBe(snapshot);
    expect(await page.evaluate(() => window.__interaction.updates)).toBe(updates);
});

test('left and right dragging pan the interaction canvas without moving nodes or opening a context menu', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await open(page);
    const snapshot = await page.evaluate(() => JSON.stringify(window.__interaction.scene));
    const updates = await page.evaluate(() => window.__interaction.updates);
    await page.evaluate(() => {
        window.__canvasContextMenus = [];
        window.addEventListener('contextmenu', (event) =>
            window.__canvasContextMenus.push(event.defaultPrevented),
        );
    });
    const viewport = async () =>
        page.locator('.react-flow__viewport').evaluate((element) => {
            const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
            return { x: matrix.e, y: matrix.f, zoom: matrix.a };
        });
    for (const button of ['left', 'right']) {
        const bounds = await page.getByTestId('interaction-flow-canvas').boundingBox();
        const x = bounds.x + bounds.width * 0.65,
            y = bounds.y + bounds.height * 0.85;
        const before = await viewport();
        await page.mouse.move(x, y);
        await page.mouse.down({ button });
        await page.mouse.move(x + 70, y - 45, { steps: 10 });
        await page.mouse.up({ button });
        await expect.poll(async () => (await viewport()).x - before.x).toBeGreaterThan(60);
        const after = await viewport();
        expect(after.y - before.y).toBeLessThan(-35);
        expect(after.zoom).toBe(before.zoom);
    }
    const bounds = await page.getByTestId('interaction-flow-canvas').boundingBox();
    await page.mouse.click(bounds.x + bounds.width * 0.65, bounds.y + bounds.height * 0.85, {
        button: 'right',
    });
    const menus = await page.evaluate(() => window.__canvasContextMenus);
    expect(menus.length).toBeGreaterThan(0);
    expect(menus.every(Boolean)).toBe(true);
    expect(await page.evaluate(() => JSON.stringify(window.__interaction.scene))).toBe(snapshot);
    expect(await page.evaluate(() => window.__interaction.updates)).toBe(updates);
});

test('each workflow row can duplicate and delete its own rule while shared undo and redo restore the change', async ({
    page,
}, info) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await open(page);
    await expect(
        page.getByRole('button', { name: 'Hoàn tác trong luồng', exact: true }),
    ).toHaveCount(0);
    await expect(
        page.getByRole('button', { name: 'Làm lại trong luồng', exact: true }),
    ).toHaveCount(0);
    const name = page.getByRole('textbox', { name: 'Tên luồng tương tác', exact: true });
    await page
        .getByRole('button', { name: 'Nhân bản luồng “Chạm để khám phá”', exact: true })
        .click();
    await expect(name).toHaveValue('Chạm để khám phá (bản sao)');
    await name.fill('Luồng khác');
    await expect
        .poll(() => page.evaluate(() => window.__interaction.scene.interactions[1].name))
        .toBe('Luồng khác');
    await page
        .getByRole('button', { name: 'Nhân bản luồng “Chạm để khám phá”', exact: true })
        .click();
    await expect(name).toHaveValue('Chạm để khám phá (bản sao)');
    const rules = await page.evaluate(() => window.__interaction.scene.interactions);
    expect(rules).toHaveLength(3);
    expect(new Set(rules.map((rule) => rule.id)).size).toBe(3);
    expect(rules[2].actions).toEqual(rules[0].actions);
    expect(rules[2].trigger).toEqual(rules[0].trigger);
    await page.getByRole('button', { name: 'Xóa luồng “Luồng khác”', exact: true }).click();
    await expect(page.getByRole('alertdialog')).toContainText('Luồng khác');
    await page
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Giữ lại', exact: true })
        .click();
    await expect(name).toHaveValue('Chạm để khám phá (bản sao)');
    await page.getByRole('button', { name: 'Xóa luồng “Luồng khác”', exact: true }).click();
    await page
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Xóa luồng', exact: true })
        .click();
    await expect
        .poll(() => page.evaluate(() => window.__interaction.scene.interactions.length))
        .toBe(2);
    await expect(name).toHaveValue('Chạm để khám phá (bản sao)');
    await page.getByTestId('scene-history-undo').click();
    await expect(
        page.getByRole('button', { name: 'Xóa luồng “Luồng khác”', exact: true }),
    ).toBeVisible();
    await page.getByTestId('scene-history-redo').click();
    await expect(
        page.getByRole('button', { name: 'Xóa luồng “Luồng khác”', exact: true }),
    ).toHaveCount(0);
    await page.screenshot({ path: info.outputPath('workflow-row-actions.png') });
});

test('canvas undo shortcuts use page history for valid workflows and keep unfinished drafts recoverable', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await open(page);
    await page.getByRole('button', { name: 'Chèn bước vào đây', exact: true }).first().click();
    await page
        .getByRole('dialog', { name: 'Thêm khối tương tác', exact: true })
        .getByRole('button', { name: 'Hành động', exact: true })
        .click();
    await expect(page.locator('[data-workflow-step]')).toHaveCount(5);
    await page.locator('.react-flow__pane').click({ position: { x: 200, y: 35 } });
    await page.keyboard.press('Control+z');
    await expect(page.locator('[data-workflow-step]')).toHaveCount(4);
    await page.keyboard.press('Control+Shift+z');
    await expect(page.locator('[data-workflow-step]')).toHaveCount(5);
    await page.getByRole('button', { name: 'Xóa luồng “Chạm để khám phá”', exact: true }).click();
    await page
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Xóa luồng', exact: true })
        .click();
    await expect(page.locator('[data-workflow-step]')).toHaveCount(0);
    await page.getByText('Tạo một điểm khám phá', { exact: true }).click();
    await page.keyboard.press('Control+z');
    await expect(
        page.getByRole('button', { name: 'Xóa luồng “Chạm để khám phá”', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: /Chạm để khám phá Khi chạm/ }).click();
    // Restoring the inspector can resize/pan the viewport. Fit the restored flow
    // before sampling a wire's screen coordinates for the physical pointer click.
    await page.getByRole('button', { name: 'Vừa toàn bộ luồng', exact: true }).click();
    const point = await page
        .locator('.react-flow__edge-interaction')
        .first()
        .evaluate((path) => {
            const point = path.getPointAtLength(path.getTotalLength() * 0.85);
            const screen = point.matrixTransform(path.getScreenCTM());
            return { x: screen.x, y: screen.y };
        });
    await page.mouse.click(point.x, point.y);
    await page.getByRole('button', { name: 'Ngắt dây nối', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Lưu sách', exact: true })).toBeDisabled();
    await page.locator('.react-flow__pane').click({ position: { x: 200, y: 35 } });
    await page.keyboard.press('Control+z');
    await expect(page.getByRole('button', { name: 'Lưu sách', exact: true })).toBeEnabled();
    await expect(page.locator('[data-workflow-step]')).toHaveCount(5);
});

test('history labels name the action and a design-tab toast opens only the restored workflow on request', async ({
    page,
}, info) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await open(page, 'dark');
    await page
        .getByRole('button', { name: 'Nhân bản luồng “Chạm để khám phá”', exact: true })
        .click();
    await page
        .getByRole('button', { name: 'Xóa luồng “Chạm để khám phá (bản sao)”', exact: true })
        .click();
    await page
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Xóa luồng', exact: true })
        .click();
    const undo = page.getByTestId('scene-history-undo');
    await expect(undo).toHaveAccessibleName(
        'Hoàn tác: Xóa luồng “Chạm để khám phá (bản sao)” (Ctrl Z)',
    );
    await undo.hover();
    await expect(page.getByRole('tooltip')).toContainText('Xóa luồng “Chạm để khám phá (bản sao)”');
    await page.getByRole('button', { name: 'Thiết kế', exact: true }).click();
    await expect(page.getByText('Đang ở thiết kế', { exact: true })).toBeVisible();
    await undo.click();
    await expect(
        page.getByText('Đã khôi phục luồng “Chạm để khám phá (bản sao)”.', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Đang ở thiết kế', { exact: true })).toBeVisible();
    await expect(page.getByTestId('interaction-flow-canvas')).toHaveCount(0);
    await expect(page.getByTestId('scene-history-redo')).toHaveAccessibleName(
        'Làm lại: Xóa luồng “Chạm để khám phá (bản sao)” (Ctrl Shift Z)',
    );
    await page.mouse.move(500, 300);
    const notification = page
        .locator('[data-sonner-toast]')
        .filter({ hasText: 'Đã khôi phục luồng “Chạm để khám phá (bản sao)”.' });
    await expect
        .poll(() =>
            notification.evaluate((element) => {
                const bounds = element.getBoundingClientRect();
                return (
                    bounds.bottom <= innerHeight - 12 && getComputedStyle(element).opacity === '1'
                );
            }),
        )
        .toBe(true);
    await page.screenshot({ path: info.outputPath('undo-interaction-toast.png') });
    await page.getByRole('button', { name: 'Xem luồng', exact: true }).click();
    await expect(page.getByTestId('interaction-flow-canvas')).toBeVisible();
    await expect(
        page.getByRole('textbox', { name: 'Tên luồng tương tác', exact: true }),
    ).toHaveValue('Chạm để khám phá (bản sao)');
    await page.getByTestId('scene-history-redo').click();
    await expect(
        page.getByRole('button', { name: 'Xóa luồng “Chạm để khám phá (bản sao)”', exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Xem luồng', exact: true })).toHaveCount(0);
});

for (const theme of ['light', 'dark']) {
    test(`template filter and question answers ${theme}: controls align without overflow`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width: 1366, height: 900 });
        await open(page, theme);
        await page.getByRole('button', { name: 'Thêm tương tác', exact: true }).click();
        await page.getByRole('menuitem', { name: 'Dùng mẫu', exact: true }).click();
        const modal = page.getByRole('dialog', { name: 'Chọn mẫu tương tác', exact: true });
        const search = modal.getByRole('searchbox', { name: 'Tìm mẫu tương tác', exact: true });
        const filter = modal.getByRole('combobox', { name: 'Nhóm mẫu', exact: true });
        const a = await search.locator('..').boundingBox(),
            b = await filter.boundingBox();
        expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
        expect(Math.abs(a.height - b.height)).toBeLessThanOrEqual(1);
        await page.screenshot({ path: info.outputPath(`template-alignment-${theme}.png`) });
        await search.fill('Đúng');
        await modal.getByRole('radio').first().check();
        await modal.getByRole('button', { name: 'Sử dụng mẫu', exact: true }).click();
        await page.getByRole('button', { name: 'Tạo tương tác', exact: true }).click();
        const question = page
            .locator('[data-workflow-step]')
            .filter({
                has: page.getByRole('combobox', { name: 'Chức năng khối Hành động', exact: true }),
            })
            .filter({ hasText: 'Bạn đã tìm thấy' });
        await question.locator('.workflow-drag').click();
        const inspector = page.getByRole('complementary', { name: 'Thiết lập bước tương tác' });
        for (let index = 1; index <= 2; index++) {
            const input = await inspector
                .getByRole('textbox', { name: `Đáp án ${index}`, exact: true })
                .boundingBox();
            const button = await inspector
                .getByRole('button', { name: `Xóa đáp án ${index}`, exact: true })
                .boundingBox();
            expect(
                Math.abs(input.y + input.height / 2 - button.y - button.height / 2),
            ).toBeLessThanOrEqual(1);
        }
        await expect(
            inspector.getByRole('combobox', { name: 'Đáp án đúng', exact: true }),
        ).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
            false,
        );
        await page.screenshot({ path: info.outputPath(`question-alignment-${theme}.png`) });
    });
}

async function openQuestion(page, long = false) {
    await page.evaluate(async (long) => {
        const { askWorkflowQuestion } = await import('/src/shared/scene-runtime/WorkflowPrompt.ts');
        window.__questionController = new AbortController();
        window.__question = { result: 'pending', count: 0 };
        const question = {
            questionId: 'prompt-test',
            title: long
                ? 'Quan sát những chi tiết trong trang sách và chọn nội dung phù hợp nhất với điều bạn vừa khám phá.'
                : 'Bạn đã tìm thấy chi tiết được đánh dấu chưa?',
            choices: long
                ? Array.from({ length: 6 }, (_, index) => ({
                      id: `choice-${index}`,
                      text: `Đáp án ${index + 1}: ${'Quan sát kỹ hình ảnh và các chi tiết trong trang sách để tìm câu trả lời. '.repeat(2)}`,
                  }))
                : [
                      { id: 'yes', text: 'Đã tìm thấy' },
                      { id: 'no', text: 'Chưa tìm thấy' },
                  ],
            correctChoiceId: long ? 'choice-0' : 'yes',
        };
        void askWorkflowQuestion(question, window.__questionController.signal).then(
            (answer) => {
                window.__question.result = { answer };
                window.__question.count++;
            },
            (error) => {
                window.__question.result = 'aborted';
                window.__question.error = String(error);
            },
        );
    }, long);
    return page.getByRole('dialog', { name: 'Câu hỏi tương tác', exact: true });
}

for (const theme of ['light', 'dark']) {
    test(`question prompt ${theme}: shows answer feedback and waits for the reader to close`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width: 1366, height: 900 });
        await open(page, theme);
        const before = await page.evaluate(() => JSON.stringify(window.__interaction.scene));
        for (const [label, value] of [
            ['Đã tìm thấy', 'yes'],
            ['Chưa tìm thấy', 'no'],
        ]) {
            await page.getByRole('button', { name: 'Chạy thử', exact: true }).focus();
            const dialog = await openQuestion(page);
            await expect(dialog.getByRole('heading')).toBeFocused();
            await expect(dialog.getByRole('button', { name: 'Trả lời', exact: true })).toHaveCount(
                0,
            );
            await expect(dialog.getByRole('button', { name: 'Tiếp tục', exact: true })).toHaveCount(
                0,
            );
            const first = await dialog
                .getByRole('button', { name: 'Đã tìm thấy', exact: true })
                .boundingBox();
            const second = await dialog
                .getByRole('button', { name: 'Chưa tìm thấy', exact: true })
                .boundingBox();
            expect(first.height).toBeGreaterThanOrEqual(44);
            expect(second.y - first.y - first.height).toBe(8);
            if (value === 'yes')
                await page.screenshot({
                    animations: 'disabled',
                    path: info.outputPath(`question-prompt-${theme}.png`),
                });
            await dialog.getByRole('button', { name: label, exact: true }).click();
            await expect(dialog).toBeVisible();
            await expect(dialog.getByRole('status')).toContainText(
                value === 'yes' ? 'Bạn đã trả lời đúng.' : 'Bạn đã trả lời sai.',
            );
            await expect(dialog.locator('[data-question-choice="yes"]')).toBeDisabled();
            await expect(dialog.locator('[data-question-choice="no"]')).toBeDisabled();
            await expect(dialog.locator('[data-question-result="correct"]')).toHaveCount(1);
            expect(await page.evaluate(() => window.__question.result)).toBe('pending');
            expect(await page.evaluate(() => window.__question.count)).toBe(0);
            await dialog
                .locator('[data-question-choice="yes"]')
                .evaluate((button) => button.click());
            await expect(dialog.getByRole('status')).toContainText(
                value === 'yes' ? 'Bạn đã trả lời đúng.' : 'Bạn đã trả lời sai.',
            );
            await page.screenshot({
                animations: 'disabled',
                path: info.outputPath(`question-feedback-${value}-${theme}.png`),
            });
            await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
            await expect(dialog).toHaveCount(0);
            await expect
                .poll(() => page.evaluate(() => window.__question.result))
                .toEqual({ answer: value });
            expect(await page.evaluate(() => window.__question.count)).toBe(1);
            await expect(page.getByRole('button', { name: 'Chạy thử', exact: true })).toBeFocused();
        }
        expect(await page.evaluate(() => JSON.stringify(window.__interaction.scene))).toBe(before);
    });
    test(`question prompt mobile ${theme}: long answers scroll inside while close stays visible`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width: 1366, height: 900 });
        await open(page, theme);
        await page.setViewportSize({ width: 390, height: 650 });
        const dialog = await openQuestion(page, true);
        const bounds = await dialog.boundingBox();
        expect(bounds.x).toBeGreaterThanOrEqual(15);
        expect(bounds.y).toBeGreaterThanOrEqual(15);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(375);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(635);
        expect(
            await dialog
                .locator('[data-question-choices]')
                .evaluate((element) => element.scrollHeight > element.clientHeight),
        ).toBe(true);
        await expect(
            dialog.getByRole('button', { name: 'Đóng câu hỏi', exact: true }),
        ).toBeInViewport();
        await page.screenshot({
            animations: 'disabled',
            path: info.outputPath(`question-mobile-${theme}.png`),
        });
        const last = dialog.locator('[data-question-choice="choice-5"]');
        await last.scrollIntoViewIfNeeded();
        await last.click();
        await expect(dialog.getByRole('status')).toContainText('Bạn đã trả lời sai.');
        expect(await page.evaluate(() => window.__question.result)).toBe('pending');
        await expect(dialog.getByRole('button', { name: 'Đóng', exact: true })).toBeInViewport();
        await page.screenshot({
            animations: 'disabled',
            path: info.outputPath(`question-mobile-feedback-${theme}.png`),
        });
        await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
        await expect
            .poll(() => page.evaluate(() => window.__question.result))
            .toEqual({ answer: 'choice-5' });
        await expect(dialog).toHaveCount(0);
    });
}

test('question prompt supports keyboard answers, closing, Escape and abort without recording a choice', async ({
    page,
}) => {
    await open(page);
    let dialog = await openQuestion(page);
    await dialog.locator('[data-question-choice="no"]').focus();
    await page.keyboard.press('ArrowDown');
    expect(await page.evaluate(() => window.__question.result)).toBe('pending');
    await page.keyboard.press('Enter');
    await expect(dialog.getByRole('status')).toBeFocused();
    await expect(dialog.getByRole('status')).toContainText('Bạn đã trả lời sai.');
    expect(await page.evaluate(() => window.__question.result)).toBe('pending');
    await page.keyboard.press('Escape');
    await expect
        .poll(() => page.evaluate(() => window.__question.result))
        .toEqual({ answer: 'no' });
    dialog = await openQuestion(page);
    await dialog.getByRole('button', { name: 'Đóng câu hỏi', exact: true }).click();
    await expect
        .poll(() => page.evaluate(() => window.__question.result))
        .toEqual({ answer: null });
    dialog = await openQuestion(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect
        .poll(() => page.evaluate(() => window.__question.result))
        .toEqual({ answer: null });
    dialog = await openQuestion(page);
    await page.evaluate(() => window.__questionController.abort('Rời trang'));
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.__question.result)).toBe('aborted');
});

test('question prompt preserves an answer on close and cancels pending feedback on abort', async ({
    page,
}) => {
    await open(page);
    let dialog = await openQuestion(page);
    await dialog.locator('[data-question-choice="yes"]').click();
    await dialog.getByRole('button', { name: 'Đóng câu hỏi', exact: true }).click();
    await expect
        .poll(() => page.evaluate(() => window.__question.result))
        .toEqual({ answer: 'yes' });
    expect(await page.evaluate(() => window.__question.count)).toBe(1);
    dialog = await openQuestion(page);
    await dialog.locator('[data-question-choice="no"]').click();
    await page.evaluate(() => window.__questionController.abort('Rời trang'));
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => window.__question.result)).toBe('aborted');
    expect(await page.evaluate(() => window.__question.count)).toBe(0);
});

test('visibility operation lives on the node and survives undo/reload', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await open(page);
    const first = page.locator('[data-workflow-step="action-0"]');
    await first.getByRole('combobox', { name: /^Thao tác khối/ }).click();
    await page.getByRole('option', { name: 'Đổi ẩn / hiện', exact: true }).click();
    await expect
        .poll(() => page.evaluate(() => window.__interaction.scene.interactions[0].actions[0].type))
        .toBe('toggleVisible');
    await expect(page.getByRole('combobox', { name: 'Thao tác', exact: true })).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'Áp dụng cho', exact: true })).toHaveCount(0);
    const operation = first.getByRole('combobox', { name: /^Thao tác khối/ });
    await expect(operation).toHaveText('Đổi ẩn / hiện');
    await operation.click();
    await page.getByRole('option', { name: 'Ẩn', exact: true }).click();
    await expect(first.getByRole('combobox', { name: /^Thao tác khối/ })).toHaveText('Ẩn');
    await page.getByTestId('scene-history-undo').click();
    await expect(first.getByRole('combobox', { name: /^Thao tác khối/ })).toHaveText(
        'Đổi ẩn / hiện',
    );
    await page.getByRole('button', { name: 'Lưu sách', exact: true }).click();
    await page.reload();
    await expect(first.getByRole('combobox', { name: /^Chức năng khối/ })).toHaveText(
        'Hiển thị đối tượng',
    );
    await expect(first.getByRole('combobox', { name: /^Thao tác khối/ })).toHaveText(
        'Đổi ẩn / hiện',
    );
    expect(
        await page.evaluate(() => window.__interaction.scene.interactions[0].actions[0]),
    ).toMatchObject({ type: 'toggleVisible', objectId: 'target', durationMs: 100 });
});

test('movement combines position rotation and scale in one node without changing wires', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await open(page);
    const first = page.locator('[data-workflow-step="action-0"]');
    await chooseInNode(page, first, 'Chuyển động');
    const before = await page.evaluate(() =>
        structuredClone(window.__interaction.scene.interactions[0]),
    );
    await page.getByRole('checkbox', { name: 'Thay đổi góc xoay', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Thay đổi kích thước', exact: true }).check();
    await expect(first).toContainText('Di chuyển + xoay + đổi kích thước');
    const next = await page.evaluate(() => window.__interaction.scene.interactions[0]);
    expect(next.actions[0]).toMatchObject({
        type: 'transformTo',
        objectId: 'target',
        position: [0.2, 0, 0.1],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
    });
    expect(next.workflow).toEqual(before.workflow);
    expect(next.editorLayout).toEqual(before.editorLayout);
    await page.getByRole('button', { name: 'Lưu sách', exact: true }).click();
    await page.reload();
    expect(
        await page.evaluate(() => window.__interaction.scene.interactions[0].actions[0]),
    ).toEqual(next.actions[0]);
});

test('audio family switches play stop and all-audio without losing the chosen target or breaking wires', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await open(page, 'dark');
    await page.evaluate(() => {
        const scene = structuredClone(window.__interaction.scene);
        scene.objects.push({
            ...scene.objects[0],
            id: 'audio-player',
            name: 'Nhạc nền',
            type: 'audio',
            assetId: '33333333-3333-4333-8333-333333333333',
            visible: false,
            autoplay: false,
            loop: false,
            volume: 1,
        });
        localStorage.setItem('interaction-ui-saved', JSON.stringify(scene));
    });
    await page.route('**/api/v1/assets/**', (route) => route.abort());
    await page.reload();
    const first = page.locator('[data-workflow-step="action-0"]');
    await chooseInNode(page, first, 'Âm thanh');
    await expect(first.getByRole('combobox', { name: /^Mục tiêu khối/ })).toHaveText('Nhạc nền');
    const before = await page.evaluate(() =>
        structuredClone(window.__interaction.scene.interactions[0]),
    );
    await first.getByRole('combobox', { name: /^Thao tác khối/ }).click();
    await page.getByRole('option', { name: 'Dừng', exact: true }).click();
    await expect(first.getByRole('combobox', { name: /^Thao tác khối/ })).toHaveText('Dừng');
    expect(
        await page.evaluate(() => window.__interaction.scene.interactions[0].actions[0]),
    ).toMatchObject({ type: 'stopAudio', assetId: '33333333-3333-4333-8333-333333333333' });
    await first.getByRole('combobox', { name: /^Mục tiêu khối/ }).click();
    await page.getByRole('option', { name: 'Toàn bộ âm thanh của trang', exact: true }).click();
    await expect(first).toContainText('Dừng tất cả âm thanh');
    await first.getByRole('combobox', { name: /^Thao tác khối/ }).click();
    await page.getByRole('option', { name: 'Phát', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Lưu sách', exact: true })).toBeDisabled();
    await chooseNodeTarget(page, first, 'Nhạc nền');
    await expect(page.getByRole('button', { name: 'Lưu sách', exact: true })).toBeEnabled();
    const next = await page.evaluate(() => window.__interaction.scene.interactions[0]);
    expect(next.actions[0]).toMatchObject({
        type: 'playAudio',
        assetId: '33333333-3333-4333-8333-333333333333',
    });
    expect(next.workflow).toEqual(before.workflow);
    expect(next.editorLayout).toEqual(before.editorLayout);
    await page.getByRole('button', { name: 'Lưu sách', exact: true }).click();
    await page.reload();
    await expect(first.getByRole('combobox', { name: /^Chức năng khối/ })).toHaveText('Âm thanh');
    await expect(first.getByRole('combobox', { name: /^Thao tác khối/ })).toHaveText('Phát');
});

test('native cursor follows the React Flow drag state across the node body and header', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await open(page);
    const node = page.locator('[data-workflow-step="action-0"]');
    const header = node.locator('.workflow-drag');
    const summary = node.locator('p').first();
    await expect(node).toHaveCSS('cursor', 'grab');
    await expect(header).toHaveCSS('cursor', 'grab');
    for (const handle of [summary, header]) {
        const box = await handle.boundingBox();
        const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
        await page.mouse.move(point.x, point.y);
        await page.mouse.down();
        await page.mouse.move(point.x + 26, point.y + 16, { steps: 6 });
        await expect(node.locator('..')).toHaveClass(/dragging/);
        await expect(node).toHaveCSS('cursor', 'grabbing');
        await expect(header).toHaveCSS('cursor', 'grabbing');
        await expect(summary).toHaveCSS('cursor', 'grabbing');
        await page.mouse.up();
        await expect(node).toHaveCSS('cursor', 'grab');
        await expect(header).toHaveCSS('cursor', 'grab');
    }
    await expect(node.getByRole('combobox', { name: /^Chức năng khối/ })).toHaveCSS(
        'cursor',
        'pointer',
    );
    const pane = page.locator('.react-flow__pane');
    const bounds = await pane.boundingBox();
    for (const button of ['left', 'right']) {
        await page.mouse.move(bounds.x + 35, bounds.y + 35);
        await page.mouse.down({ button });
        await page.mouse.move(bounds.x + 50, bounds.y + 50, { steps: 4 });
        await expect(pane).toHaveCSS('cursor', 'grabbing');
        await page.mouse.up({ button });
        await expect(pane).toHaveCSS('cursor', 'grab');
    }
});

for (const theme of ['light', 'dark']) {
    test(`audio inspector ${theme}: controls survive target and operation changes without collapsing`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width: 1366, height: 768 });
        await open(page, theme);
        await page.evaluate(() => {
            const scene = structuredClone(window.__interaction.scene);
            scene.objects.push({
                ...scene.objects[0],
                type: 'audio',
                id: 'music',
                name: 'bgm',
                assetId: '33333333-3333-4333-8333-333333333333',
                autoplay: false,
                loop: false,
                volume: 1,
            });
            localStorage.setItem('interaction-ui-saved', JSON.stringify(scene));
        });
        await page.route('**/api/v1/assets/**', (route) => route.abort());
        await page.reload();
        const node = page.locator('[data-workflow-step="action-0"]');
        await chooseInNode(page, node, 'Âm thanh');
        const inspector = page.getByRole('complementary', { name: 'Thiết lập bước tương tác' });
        const audio = inspector.getByRole('combobox', { name: 'Âm thanh', exact: true });
        const operation = node.getByRole('combobox', { name: /^Thao tác khối/ });
        const volume = inspector.getByRole('textbox', { name: 'Âm lượng (%)', exact: true });
        await audio.click();
        await expect(
            page.getByRole('option', { name: 'Chọn âm thanh trên trang', exact: true }),
        ).toHaveCount(0);
        await page.keyboard.press('Escape');
        await operation.click();
        await page.getByRole('option', { name: 'Dừng', exact: true }).click();
        await audio.click();
        await page.getByRole('option', { name: 'Toàn bộ âm thanh của trang', exact: true }).click();
        await operation.click();
        await page.getByRole('option', { name: 'Phát', exact: true }).click();
        await expect(volume).toBeVisible();
        await expect(
            inspector.getByRole('checkbox', { name: 'Phát lặp', exact: true }),
        ).toBeVisible();
        await audio.click();
        await expect(
            page.getByRole('option', { name: 'Chọn âm thanh trên trang', exact: true }),
        ).toBeDisabled();
        await page.getByRole('option', { name: 'bgm', exact: true }).click();
        await expect(audio).toHaveText('bgm');
        await expect(volume).toBeVisible();
        await inspector.getByRole('checkbox', { name: 'Phát lặp', exact: true }).check();
        await volume.fill('65');
        await expect
            .poll(() =>
                page.evaluate(() => window.__interaction.scene.interactions[0].actions[0].volume),
            )
            .toBe(0.65);
        await expect(inspector.getByText('Bước sau bắt đầu ngay khi gửi lệnh phát.')).toBeVisible();
        await expect(
            inspector.getByRole('heading', { name: 'Phát “bgm”', exact: true }),
        ).toBeVisible();
        const delay = inspector.getByRole('textbox', {
            name: 'Chờ trước khi bắt đầu (giây, 0–60)',
            exact: true,
        });
        await expect(delay).toBeVisible();
        await delay.fill('0.5');
        await expect
            .poll(() =>
                page.evaluate(
                    () => window.__interaction.scene.interactions[0].actions[0].delayMsSchema,
                ),
            )
            .toBe(500);
        await expect(volume).toBeVisible();
        expect(
            await inspector
                .locator('fieldset')
                .first()
                .evaluate((el) => el.getBoundingClientRect().height),
        ).toBeGreaterThan(250);
        expect(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight)).toBe(
            false,
        );
        await page.screenshot({ path: info.outputPath(`audio-inspector-${theme}.png`) });
        await page.getByRole('button', { name: 'Lưu sách', exact: true }).click();
        await page.reload();
        expect(
            await page.evaluate(() => window.__interaction.scene.interactions[0].actions[0]),
        ).toMatchObject({
            type: 'playAudio',
            assetId: '33333333-3333-4333-8333-333333333333',
            loop: true,
            volume: 0.65,
            delayMsSchema: 500,
        });
    });
}

async function mockAudioLibrary(page) {
    const rate = 8000,
        bytes = rate * 2 * 30;
    const wav = Buffer.alloc(44 + bytes);
    wav.write('RIFF', 0);
    wav.writeUInt32LE(36 + bytes, 4);
    wav.write('WAVE', 8);
    wav.write('fmt ', 12);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(rate, 24);
    wav.writeUInt32LE(rate * 2, 28);
    wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34);
    wav.write('data', 36);
    wav.writeUInt32LE(bytes, 40);
    await page.route('**/audio-fixture/**', (route) =>
        route.fulfill({ contentType: 'audio/wav', body: wav }),
    );
    const assets = [
        { id: '44444444-4444-4444-8444-444444444444', name: 'Sóng biển.wav', file: 'sea.wav' },
        { id: '55555555-5555-4555-8555-555555555555', name: 'Chim hót.wav', file: 'bird.wav' },
        { id: '66666666-6666-4666-8666-666666666666', name: 'Đang xử lý.wav', file: 'pending.wav' },
    ].map((item, index) => ({
        ...item,
        type: 'AUDIO',
        status: index === 2 ? 'PROCESSING' : 'READY',
        url: `http://localhost:5173/audio-fixture/${item.file}`,
        thumbnailUrl: null,
        meta: { durationSec: 30 },
        sizeBytes: wav.length,
        format: 'wav',
        tags: ['SFX'],
        license: null,
        authorName: null,
        sourceUrl: null,
        scope: 'library',
        categoryId: null,
        createdAt: '2026-11-05T00:00:00.000Z',
    }));
    await page.route('**/api/v1/asset-categories', (route) =>
        route.fulfill({ json: { data: [] } }),
    );
    await page.route('**/api/v1/assets**', (route) => {
        const url = new URL(route.request().url());
        const id = url.pathname.split('/').at(-1);
        if (id === 'assets')
            return route.fulfill({
                json: {
                    data: assets,
                    meta: { page: 1, limit: 12, total: assets.length, totalPages: 1 },
                },
            });
        const asset = assets.find((asset) => asset.id === id);
        return asset
            ? route.fulfill({ json: { data: asset } })
            : route.fulfill({ status: 404, json: { message: 'Not found' } });
    });
    return assets;
}
for (const theme of ['light', 'dark']) {
    test(`audio library ${theme}: selected file is named marked and playable without creating scene objects`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width: 1600, height: 900 });
        const assets = await mockAudioLibrary(page);
        await open(page, theme);
        const node = page.locator('[data-workflow-step="action-0"]');
        await chooseInNode(page, node, 'Âm thanh');
        const inspector = page.getByRole('complementary', { name: 'Thiết lập bước tương tác' });
        await inspector
            .getByRole('button', { name: 'Chọn từ tài nguyên âm thanh', exact: true })
            .click();
        const dialog = page.getByRole('dialog');
        await expect(
            dialog.getByRole('button', { name: 'Xem Đang xử lý.wav', exact: true }),
        ).toBeDisabled();
        await dialog.getByRole('button', { name: 'Xem Sóng biển.wav', exact: true }).click();
        await dialog.locator('audio').evaluate(async (audio) => {
            window.__previousPreviewAudio = audio;
            await audio.play();
        });
        await expect
            .poll(() => page.evaluate(() => window.__previousPreviewAudio.paused))
            .toBe(false);
        await dialog.getByRole('button', { name: 'Chọn âm thanh', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        expect(await page.evaluate(() => window.__previousPreviewAudio.paused)).toBe(true);
        await expect(node.getByRole('combobox', { name: /^Mục tiêu khối/ })).toHaveText(
            'Sóng biển.wav',
        );
        await expect(node).toContainText('Phát “Sóng biển.wav”');
        const chosen = inspector.getByRole('region', { name: 'Âm thanh đang chọn' });
        await inspector.screenshot({ path: info.outputPath(`audio-choice-sidebar-${theme}.png`) });
        await expect(chosen.locator('audio')).toHaveAttribute(
            'aria-label',
            'Nghe thử Sóng biển.wav',
        );
        await chosen.locator('audio').evaluate(async (audio) => {
            window.__previousSidebarAudio = audio;
            await audio.play();
        });
        await expect
            .poll(() => page.evaluate(() => window.__previousSidebarAudio.paused))
            .toBe(false);
        await inspector
            .getByRole('button', { name: 'Chọn từ tài nguyên âm thanh', exact: true })
            .click();
        await expect(
            dialog.getByRole('heading', { name: 'Sóng biển.wav', exact: true }).first(),
        ).toBeVisible();
        await expect(dialog.getByRole('button', { name: 'Đang chọn', exact: true })).toBeDisabled();
        expect(await page.evaluate(() => window.__previousSidebarAudio.paused)).toBe(true);
        await dialog.getByRole('button', { name: 'Quay lại', exact: true }).click();
        await expect(dialog.locator(`[data-asset-id="${assets[0].id}"]`)).toContainText(
            'Đang chọn',
        );
        await expect(
            dialog.getByRole('button', { name: 'Đang chọn Sóng biển.wav', exact: true }),
        ).toBeDisabled();
        await dialog.getByRole('button', { name: 'Xem Chim hót.wav', exact: true }).click();
        await dialog.locator('audio').evaluate(async (audio) => {
            window.__cancelledPreviewAudio = audio;
            await audio.play();
        });
        await dialog.getByRole('button', { name: 'Đóng chọn tài nguyên', exact: true }).click();
        expect(await page.evaluate(() => window.__cancelledPreviewAudio.paused)).toBe(true);
        expect(
            await page.evaluate(
                () => window.__interaction.scene.interactions[0].actions[0].assetId,
            ),
        ).toBe(assets[0].id);
        await inspector
            .getByRole('button', { name: 'Chọn từ tài nguyên âm thanh', exact: true })
            .click();
        await dialog.getByRole('button', { name: 'Quay lại', exact: true }).click();
        await dialog
            .getByRole('button', { name: 'Chọn âm thanh: Chim hót.wav', exact: true })
            .click();
        await expect(dialog).toHaveCount(0);
        await expect(chosen.locator('audio')).toHaveAttribute(
            'aria-label',
            'Nghe thử Chim hót.wav',
        );
        await expect(node.getByRole('combobox', { name: /^Mục tiêu khối/ })).toHaveText(
            'Chim hót.wav',
        );
        expect(await page.evaluate(() => window.__interaction.scene.objects.length)).toBe(2);
        await page.getByRole('button', { name: 'Lưu sách', exact: true }).click();
        await page.reload();
        await expect(node.getByRole('combobox', { name: /^Mục tiêu khối/ })).toHaveText(
            'Chim hót.wav',
        );
        await node.locator('.workflow-drag').click();
        await inspector
            .getByRole('button', { name: 'Chọn từ tài nguyên âm thanh', exact: true })
            .click();
        await expect(
            dialog.getByRole('heading', { name: 'Chim hót.wav', exact: true }).first(),
        ).toBeVisible();
        await expect(dialog.getByText('Đang chọn', { exact: true }).first()).toBeVisible();
        await dialog.getByRole('button', { name: 'Quay lại', exact: true }).click();
        await expect(dialog.locator(`[data-asset-id="${assets[1].id}"]`)).toContainText(
            'Đang chọn',
        );
        await page.screenshot({ path: info.outputPath(`audio-library-${theme}.png`) });
    });
}

test('audio can be cleared from the inspector and picker without deleting the asset or stopping all sounds', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    const requests = [];
    page.on('request', (request) => {
        if (request.url().includes('/api/v1/assets') && request.method() === 'DELETE')
            requests.push(request.url());
    });
    const assets = await mockAudioLibrary(page);
    await open(page);
    const node = page.locator('[data-workflow-step="action-0"]');
    await chooseInNode(page, node, 'Âm thanh');
    const inspector = page.getByRole('complementary', { name: 'Thiết lập bước tương tác' });
    const picker = inspector.getByRole('button', {
        name: 'Chọn từ tài nguyên âm thanh',
        exact: true,
    });
    const dialog = page.getByRole('dialog');
    await picker.click();
    await dialog.getByRole('button', { name: 'Chọn âm thanh: Sóng biển.wav', exact: true }).click();
    const current = inspector.getByRole('region', { name: 'Âm thanh đang chọn' });
    await current.locator('audio').evaluate(async (audio) => {
        window.__clearedAudio = audio;
        await audio.play();
    });
    await inspector.getByRole('button', { name: 'Bỏ chọn âm thanh', exact: true }).click();
    expect(await page.evaluate(() => window.__clearedAudio.paused)).toBe(true);
    await expect(current).toHaveCount(0);
    await expect(node.getByRole('combobox', { name: /^Mục tiêu khối/ })).toHaveText(
        'Chọn âm thanh trên trang',
    );
    await expect(page.getByRole('button', { name: 'Lưu sách', exact: true })).toBeDisabled();
    await picker.click();
    await expect(
        dialog.getByRole('button', { name: 'Xem Sóng biển.wav', exact: true }),
    ).toBeEnabled();
    await dialog.getByRole('button', { name: 'Chọn âm thanh: Sóng biển.wav', exact: true }).click();
    await node.getByRole('combobox', { name: /^Thao tác khối/ }).click();
    await page.getByRole('option', { name: 'Dừng', exact: true }).click();
    await picker.click();
    await dialog.getByRole('button', { name: 'Bỏ chọn', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(node.getByRole('combobox', { name: /^Mục tiêu khối/ })).toHaveText(
        'Chọn âm thanh trên trang',
    );
    await expect(page.getByRole('button', { name: 'Lưu sách', exact: true })).toBeDisabled();
    await expect(node).toContainText('Chọn âm thanh cần dừng');
    await expect(node).not.toContainText('Dừng tất cả âm thanh');
    await chooseNodeTarget(page, node, 'Toàn bộ âm thanh của trang');
    await expect(page.getByRole('button', { name: 'Lưu sách', exact: true })).toBeEnabled();
    expect(
        await page.evaluate(() => window.__interaction.scene.interactions[0].actions[0]),
    ).toMatchObject({ type: 'stopAudio' });
    expect(
        await page.evaluate(() => window.__interaction.scene.interactions[0].actions[0].assetId),
    ).toBeUndefined();
    await picker.click();
    await dialog.getByRole('button', { name: 'Chọn âm thanh: Chim hót.wav', exact: true }).click();
    await picker.click();
    await dialog.getByRole('button', { name: 'Quay lại', exact: true }).click();
    await expect(dialog.locator(`[data-asset-id="${assets[1].id}"]`)).toContainText('Đang chọn');
    await dialog.getByRole('button', { name: 'Bỏ chọn', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Lưu sách', exact: true })).toBeDisabled();
    expect(requests).toEqual([]);
    expect(await page.evaluate(() => window.__interaction.scene.objects.length)).toBe(2);
});

test('named numeric memory can decrease points and be reused by a condition', async ({
    page,
}, info) => {
    await open(page);
    await page.getByRole('button', { name: 'Ghi nhớ', exact: true }).click();
    await page.getByRole('button', { name: 'Tạo thông tin', exact: true }).click();
    const manager = page.getByRole('dialog', {
        name: /^(Thêm|Sửa) thông tin ghi nhớ$/,
        exact: true,
    });
    await manager
        .getByRole('textbox', { name: 'Tên thông tin', exact: true })
        .fill('Điểm khám phá');
    await manager.getByRole('combobox', { name: 'Loại thông tin', exact: true }).click();
    await page.getByRole('option', { name: 'Điểm / số lượng', exact: true }).click();
    await manager.getByRole('spinbutton', { name: 'Ban đầu là', exact: true }).fill('20');
    await manager.getByRole('button', { name: /^(Thêm|Lưu) thông tin$/, exact: true }).click();
    const initialValue = page.locator('dl').filter({ hasText: 'Giá trị ban đầu' }).locator('dd');
    await expect(initialValue).toHaveText('20');
    const operations = page.getByRole('group', { name: 'Cách cập nhật ghi nhớ', exact: true });
    const decrease = operations.getByRole('radio', { name: 'Giảm', exact: true });
    await decrease.check();
    const memoryNode = page.locator('[data-workflow-step][aria-label="Ghi nhớ"]');
    await expect(memoryNode.getByRole('combobox', { name: 'Chức năng khối Ghi nhớ' })).toHaveText(
        'Giảm',
    );
    await chooseInNode(page, memoryNode, 'Tăng');
    await expect(operations.getByRole('radio', { name: 'Tăng', exact: true })).toBeChecked();
    await decrease.check();
    await page.getByRole('spinbutton', { name: 'Giá trị ghi nhớ', exact: true }).fill('3');
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.__interaction.scene.interactions[0].actions.find(
                        (action) => action.type === 'setState',
                    ).value,
            ),
        )
        .toBe(-3);
    await page.getByRole('tab', { name: 'Luồng', exact: true }).click();
    await page.getByRole('button', { name: 'Điều kiện', exact: true }).click();
    await page.getByRole('combobox', { name: 'Thông tin cần kiểm tra', exact: true }).click();
    await page.getByRole('option', { name: 'Điểm khám phá', exact: true }).click();
    await page.getByRole('spinbutton', { name: 'Giá trị ghi nhớ', exact: true }).fill('10');
    await expect
        .poll(() =>
            page.evaluate(() => {
                const actions = window.__interaction.scene.interactions[0].actions;
                return (
                    actions.find((action) => action.type === 'condition').test.key ===
                    actions.find((action) => action.type === 'setState').key
                );
            }),
        )
        .toBe(true);
    await page.getByRole('button', { name: 'Tùy chọn chạy thử', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Chạy riêng luồng đang chọn', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Chạy thử tương tác', exact: true });
    await panel.getByRole('button', { name: 'Chi tiết chạy thử', exact: true }).click();
    const details = page.getByRole('dialog', { name: 'Chi tiết chạy thử', exact: true });
    await expect(details.locator('[aria-label="Ghi nhớ khi chạy thử"]')).toContainText(
        'Điểm khám phá',
    );
    await expect(details.locator('[aria-label="Ghi nhớ khi chạy thử"]')).toContainText('20');
    await panel.getByRole('button', { name: 'Chạy', exact: true }).click();
    await expect(details.locator('[aria-label="Ghi nhớ khi chạy thử"]')).toContainText('→ 17');
    await page.getByRole('button', { name: 'Đóng thử', exact: true }).click();
    await page
        .locator('[data-workflow-step][aria-label="Ghi nhớ"]')
        .getByText('Ghi nhớ', { exact: true })
        .click();
    const testedValue = page.locator('dl').filter({ hasText: 'Kết quả chạy thử' }).locator('dd');
    await expect(testedValue).toHaveText('17');
    await page
        .getByRole('complementary', { name: 'Thiết lập bước tương tác' })
        .screenshot({ path: info.outputPath('memory-settings.png') });
    await page.getByRole('button', { name: 'Tùy chọn chạy thử', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Chạy riêng luồng đang chọn', exact: true }).click();
    await panel.getByRole('button', { name: 'Chi tiết chạy thử', exact: true }).click();
    await panel.getByRole('button', { name: 'Đặt lại từ đầu', exact: true }).click();
    await expect(details.locator('[aria-label="Ghi nhớ khi chạy thử"]')).toContainText('20 → 20');
    await page.screenshot({ path: 'test-results/memory-numeric.png' });
});

for (const theme of ['light', 'dark']) {
    test(`memory sidebar ${theme}: existing variables are searchable and open their edit form directly`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width: 1366, height: 768 });
        await page.addInitScript(() =>
            localStorage.setItem(
                'interaction-ui-memory',
                JSON.stringify([
                    { key: 'points', name: 'Điểm khám phá', type: 'number', initialValue: 10 },
                    {
                        key: 'found',
                        name: 'Tìm thấy khủng long',
                        type: 'boolean',
                        initialValue: false,
                    },
                    { key: 'hero', name: 'Nhân vật chính', type: 'string', initialValue: 'Milo' },
                ]),
            ),
        );
        await open(page, theme);
        await page.getByRole('tab', { name: 'Ghi nhớ (3)', exact: true }).click();
        const list = page.getByRole('region', { name: 'Thông tin ghi nhớ của sách', exact: true });
        await expect(list).toContainText('Số — Ban đầu: 10');
        await expect(list).toContainText('Đúng / Sai — Ban đầu: Sai');
        await expect(list).toContainText('Văn bản — Ban đầu: Milo');
        const search = list.getByRole('searchbox', { name: 'Tìm thông tin ghi nhớ', exact: true });
        await search.fill('khủng long');
        await expect(list.getByRole('button', { name: /^Sửa thông tin/ })).toHaveCount(1);
        await list
            .getByRole('button', { name: 'Sửa thông tin “Tìm thấy khủng long”', exact: true })
            .click();
        const manager = page.getByRole('dialog', {
            name: /^(Thêm|Sửa) thông tin ghi nhớ$/,
            exact: true,
        });
        await expect(
            manager.getByRole('textbox', { name: 'Tên thông tin', exact: true }),
        ).toHaveValue('Tìm thấy khủng long');
        await expect(
            manager.getByRole('combobox', { name: 'Loại thông tin', exact: true }),
        ).toContainText('Trạng thái Đúng / Sai');
        await manager.getByRole('combobox', { name: 'Ban đầu là', exact: true }).click();
        await page.getByRole('option', { name: 'Đúng', exact: true }).click();
        await manager.getByRole('button', { name: /^(Thêm|Lưu) thông tin$/, exact: true }).click();
        await expect(list).toContainText('Đúng / Sai — Ban đầu: Đúng');
        await search.clear();
        await page.screenshot({ path: info.outputPath('memory-sidebar.png') });
        expect(
            await page.evaluate(
                () =>
                    document.documentElement.scrollHeight > innerHeight ||
                    document.documentElement.scrollWidth > innerWidth,
            ),
        ).toBe(false);
        await page.getByRole('tab', { name: 'Luồng', exact: true }).click();
        await expect(
            page.getByRole('region', { name: 'Danh sách luồng tương tác', exact: true }),
        ).toBeVisible();
    });
}

test('memory plus opens creation directly and list manages deletion with unfinished-edit protection', async ({
    page,
}, info) => {
    await open(page);
    await page.getByRole('tab', { name: 'Ghi nhớ (0)', exact: true }).click();
    const list = page.getByRole('region', { name: 'Thông tin ghi nhớ của sách', exact: true });
    const plus = list.getByRole('button', { name: 'Thêm thông tin ghi nhớ', exact: true });
    await plus.click();
    const dialog = page.getByRole('dialog', { name: 'Thêm thông tin ghi nhớ', exact: true });
    await expect(dialog.getByRole('textbox', { name: 'Tên thông tin', exact: true })).toBeVisible();
    await dialog.getByRole('textbox', { name: 'Tên thông tin', exact: true }).fill('Đã khám phá');
    await dialog.getByRole('button', { name: 'Thêm thông tin', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(list.getByText('Đã khám phá', { exact: true })).toBeVisible();
    await plus.click();
    await dialog.getByRole('textbox', { name: 'Tên thông tin', exact: true }).fill('Đã khám phá');
    await dialog.getByRole('button', { name: 'Thêm thông tin', exact: true }).click();
    await expect(dialog.getByText('Tên thông tin đã được dùng.', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.__interaction.workflowVariables.length)).toBe(1);
    await page.screenshot({ path: info.outputPath('memory-create-validation.png') });
    await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
    const confirm = page.getByRole('alertdialog', {
        name: 'Thông tin ghi nhớ chưa lưu',
        exact: true,
    });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Tiếp tục sửa', exact: true }).click();
    await expect(dialog.getByRole('textbox', { name: 'Tên thông tin', exact: true })).toHaveValue(
        'Đã khám phá',
    );
    await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
    await confirm.getByRole('button', { name: 'Bỏ thay đổi', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await list.getByRole('button', { name: 'Xóa Đã khám phá', exact: true }).click();
    await expect(list.getByText('Đã khám phá', { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => window.__interaction.workflowVariables.length)).toBe(0);
    await expect(page.getByRole('dialog', { name: 'Thông tin của sách', exact: true })).toHaveCount(
        0,
    );
});

async function openStringMemory(page) {
    await page.addInitScript(() =>
        localStorage.setItem(
            'interaction-ui-memory',
            JSON.stringify([{ key: 'note', name: 'Ghi chú', type: 'string', initialValue: '' }]),
        ),
    );
    await open(page);
    await page.getByRole('button', { name: 'Ghi nhớ', exact: true }).click();
    await page.getByRole('combobox', { name: 'Thông tin cần ghi nhớ', exact: true }).click();
    await page.getByRole('option', { name: 'Ghi chú', exact: true }).click();
    return page.getByRole('textbox', { name: 'Giá trị ghi nhớ', exact: true });
}

test('memory text batches graph updates, preserves caret and flushes before saving or switching nodes', async ({
    page,
}) => {
    const input = await openStringMemory(page);
    const before = await page.evaluate(() => window.__interaction.updates);
    const text = 'Noi dung ghi nho duoc nhap lien tuc va khong bi giat.';
    await input.pressSequentially(text, { delay: 1 });
    await expect(input).toHaveValue(text);
    await expect(input).toBeFocused();
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.__interaction.scene.interactions[0].actions.find(
                        (item) => item.type === 'setState',
                    ).value,
            ),
        )
        .toBe(text);
    expect((await page.evaluate(() => window.__interaction.updates)) - before).toBeLessThan(
        text.length / 4,
    );
    await input.evaluate((element) => element.setSelectionRange(5, 5));
    await input.pressSequentially('TIẾNG VIỆT ', { delay: 1 });
    const edited = `${text.slice(0, 5)}TIẾNG VIỆT ${text.slice(5)}`;
    await expect(input).toHaveValue(edited);
    expect(await input.evaluate((element) => element.selectionStart)).toBe(
        5 + 'TIẾNG VIỆT '.length,
    );
    await input.fill('Lưu ngay trước khi hết nhịp chờ');
    await page.getByRole('button', { name: 'Lưu sách', exact: true }).click();
    expect(
        await page.evaluate(
            () =>
                JSON.parse(
                    localStorage.getItem('interaction-ui-saved'),
                ).interactions[0].actions.find((item) => item.type === 'setState').value,
        ),
    ).toBe('Lưu ngay trước khi hết nhịp chờ');
    await input.fill('Chuyển khối vẫn giữ nội dung');
    await page
        .locator('[data-workflow-step="start"]')
        .getByText('Sự kiện', { exact: true })
        .click();
    expect(
        await page.evaluate(
            () =>
                window.__interaction.scene.interactions[0].actions.find(
                    (item) => item.type === 'setState',
                ).value,
        ),
    ).toBe('Chuyển khối vẫn giữ nội dung');
});

test('memory text waits for Vietnamese composition and flushes before the save shortcut', async ({
    page,
}) => {
    const input = await openStringMemory(page);
    const before = await page.evaluate(() => window.__interaction.updates);
    await input.dispatchEvent('compositionstart');
    await input.fill('tie');
    await page.waitForTimeout(240);
    expect(await page.evaluate(() => window.__interaction.updates)).toBe(before);
    await input.fill('tiếng Việt');
    await input.dispatchEvent('compositionend', { data: 'tiếng Việt' });
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.__interaction.scene.interactions[0].actions.find(
                        (item) => item.type === 'setState',
                    ).value,
            ),
        )
        .toBe('tiếng Việt');
    await page.evaluate(() =>
        window.addEventListener('keydown', (event) => {
            if (event.ctrlKey && event.key.toLowerCase() === 's') {
                event.preventDefault();
                window.__savedMemoryText = window.__interaction.scene.interactions[0].actions.find(
                    (item) => item.type === 'setState',
                ).value;
            }
        }),
    );
    await input.fill('Lưu bằng phím tắt');
    await input.press('Control+s');
    expect(await page.evaluate(() => window.__savedMemoryText)).toBe('Lưu bằng phím tắt');
});

test('question conditions follow added renamed and deleted questions in an incomplete graph', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await open(page);
    await page.getByRole('button', { name: 'Điều kiện', exact: true }).click();
    const condition = page.locator('[data-workflow-step][aria-label="Điều kiện"]').last();
    await chooseInNode(page, condition, 'Kết quả câu hỏi');
    await expect(page.getByRole('button', { name: 'Lưu sách', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Hành động', exact: true }).click();
    const question = page.locator('[data-workflow-step]').last();
    await chooseInNode(page, question, 'Hiển thị câu hỏi');
    await page
        .getByRole('textbox', { name: 'Nội dung câu hỏi', exact: true })
        .fill('Câu hỏi đang soạn');
    await page.getByRole('button', { name: 'Vừa toàn bộ luồng', exact: true }).click();
    await condition.getByText('Điều kiện', { exact: true }).click();
    const choices = page.getByRole('combobox', { name: 'Câu hỏi cần kiểm tra', exact: true });
    await choices.click();
    await page.getByRole('option', { name: 'Câu hỏi đang soạn', exact: true }).click();
    await expect(choices).toContainText('Câu hỏi đang soạn');
    await question.getByText('Hành động', { exact: true }).click();
    await page
        .getByRole('textbox', { name: 'Nội dung câu hỏi', exact: true })
        .fill('Câu hỏi đã đổi tên');
    await condition.getByText('Điều kiện', { exact: true }).click();
    await expect(choices).toContainText('Câu hỏi đã đổi tên');
    await question.getByText('Hành động', { exact: true }).click();
    await page.getByRole('button', { name: 'Xóa bước', exact: true }).click();
    await condition.getByText('Điều kiện', { exact: true }).click();
    await expect(choices).toContainText('Chọn câu hỏi');
    await expect(
        page.getByText('Câu hỏi không còn trên trang. Hãy chọn lại.', { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Lưu sách', exact: true })).toBeDisabled();
    await choices.click();
    await expect(page.getByRole('option', { name: 'Câu hỏi đã đổi tên', exact: true })).toHaveCount(
        0,
    );
    await expect(page.getByRole('option', { name: 'Câu hỏi đang soạn', exact: true })).toHaveCount(
        0,
    );
    await page.keyboard.press('Escape');
    await page.locator('.react-flow__pane').click({ position: { x: 20, y: 20 } });
    await page.keyboard.press('Control+z');
    await condition.getByText('Điều kiện', { exact: true }).click();
    await expect(choices).toContainText('Câu hỏi đã đổi tên');
    await expect(page.getByRole('button', { name: 'Lưu sách', exact: true })).toBeEnabled();
});

async function recordTargetGizmo(page) {
    await page.evaluate(async () => {
        const url = performance
            .getEntriesByType('resource')
            .map((item) => item.name)
            .find((name) => name.includes('TransformControls') && name.includes('.js'));
        if (!url) throw new Error('TransformControls module was not loaded');
        const stageUrl = performance
            .getEntriesByType('resource')
            .map((item) => item.name)
            .find((name) => name.includes('/LocalPreviewStage.ts'));
        const { LocalPreviewStage } = await import(stageUrl);
        const setRuntime = LocalPreviewStage.prototype.setRuntime;
        LocalPreviewStage.prototype.setRuntime = function (...args) {
            window.__targetStage = this;
            return setRuntime.apply(this, args);
        };
        const { TransformControls } = await import(url);
        const setMode = TransformControls.prototype.setMode;
        TransformControls.prototype.setMode = function (mode) {
            window.__targetGizmo = this;
            return setMode.call(this, mode);
        };
    });
}

test('target transform opens beside settings, switches W E R and applies one gesture without rebuilding', async ({
    page,
}, info) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.addInitScript(() =>
        localStorage.setItem(
            'interaction-ui-memory',
            JSON.stringify([{ key: 'score', name: 'Điểm số', type: 'number', initialValue: 10 }]),
        ),
    );
    await open(page);
    await recordTargetGizmo(page);
    const before = await page.evaluate(() => structuredClone(window.__interaction.scene.objects));
    await chooseInNode(page, page.locator('[data-workflow-step="action-0"]'), 'Chuyển động');
    await page.getByRole('checkbox', { name: 'Thay đổi góc xoay', exact: true }).check();
    await page.getByRole('checkbox', { name: 'Thay đổi kích thước', exact: true }).check();
    const panel = page.getByRole('region', {
        name: 'Đặt trạng thái đích trong scene',
        exact: true,
    });
    await expect(panel.getByRole('radio', { name: 'Di chuyển (W)', exact: true })).toBeEnabled();
    await expect(
        page.getByRole('complementary', { name: 'Thiết lập bước tương tác', exact: true }),
    ).toBeVisible();
    await expect(
        page.getByRole('button', { name: 'Chọn trạng thái đích trong trang', exact: true }),
    ).toHaveCount(0);
    await expect(panel.locator('[aria-label="Ghi nhớ khi chạy thử"]')).toHaveCount(0);
    const move = panel.getByRole('radio', { name: 'Di chuyển (W)', exact: true });
    const rotate = panel.getByRole('radio', { name: 'Xoay (E)', exact: true });
    const scale = panel.getByRole('radio', { name: 'Kích thước (R)', exact: true });
    await expect(move).toBeChecked();
    const identity = await page.evaluate(() => {
        const gizmo = window.__targetGizmo;
        gizmo.object.position.set(0.35, 0.12, 0.18);
        return { gizmo: gizmo.uuid, object: gizmo.object.uuid };
    });
    await rotate.click();
    expect(await page.evaluate(() => window.__targetGizmo.getMode())).toBe('rotate');
    await page.evaluate(() => window.__targetGizmo.object.rotation.set(0, 0, Math.PI / 2));
    await scale.click();
    expect(await page.evaluate(() => window.__targetGizmo.getMode())).toBe('scale');
    await page.evaluate(() => window.__targetGizmo.object.scale.set(1.5, 1.25, 1.1));
    await page.keyboard.press('w');
    await expect(move).toBeChecked();
    await page.keyboard.press('e');
    await expect(rotate).toBeChecked();
    await page.keyboard.press('r');
    await expect(scale).toBeChecked();
    const search = page.getByRole('searchbox', { name: 'Tìm luồng tương tác', exact: true });
    await search.fill('e');
    await search.press('w');
    expect(await page.evaluate(() => window.__targetGizmo.getMode())).toBe('scale');
    await search.clear();
    expect(
        await page.evaluate(() => ({
            gizmo: window.__targetGizmo.uuid,
            object: window.__targetGizmo.object.uuid,
        })),
    ).toEqual(identity);
    await page.screenshot({ path: info.outputPath('target-tools.png') });
    await page.evaluate(() =>
        window.__targetGizmo.dispatchEvent({
            type: 'mouseUp',
            mode: window.__targetGizmo.getMode(),
        }),
    );
    await expect(panel).toBeVisible();
    const action = await page.evaluate(() => window.__interaction.scene.interactions[0].actions[0]);
    expect(action.position).toEqual([0.35, 0.12, 0.18]);
    expect(action.rotation[2]).toBeCloseTo(90);
    expect(action.scale).toEqual([1.5, 1.25, 1.1]);
    expect(
        await page.evaluate(() => ({
            gizmo: window.__targetGizmo.uuid,
            object: window.__targetGizmo.object.uuid,
        })),
    ).toEqual(identity);
    await page.getByTestId('scene-history-undo').click();
    await expect
        .poll(() =>
            page.evaluate(() => window.__interaction.scene.interactions[0].actions[0].position),
        )
        .toEqual([0.2, 0, 0.1]);
    await expect
        .poll(() => page.evaluate(() => window.__targetGizmo.object.position.toArray()))
        .toEqual([0.2, 0, 0.1]);
    expect(await page.evaluate(() => window.__interaction.scene.objects)).toEqual(before);
});

test('target transform disables channels not selected in the action', async ({ page }) => {
    await open(page);
    await recordTargetGizmo(page);
    await chooseInNode(page, page.locator('[data-workflow-step="action-0"]'), 'Chuyển động');
    const panel = page.getByRole('region', {
        name: 'Đặt trạng thái đích trong scene',
        exact: true,
    });
    await expect(panel.getByRole('radio', { name: 'Di chuyển (W)', exact: true })).toBeEnabled();
    await expect(panel.getByRole('radio', { name: 'Xoay (E)', exact: true })).toBeDisabled();
    await expect(panel.getByRole('radio', { name: 'Kích thước (R)', exact: true })).toBeDisabled();
    await panel.getByRole('radio', { name: 'Di chuyển (W)', exact: true }).click();
    await page.keyboard.press('e');
    expect(await page.evaluate(() => window.__targetGizmo.getMode())).toBe('translate');
    await page.getByRole('button', { name: 'Đóng thiết lập bước', exact: true }).click();
});

test('target authoring ignores object taps while normal trial still runs the workflow', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await open(page);
    await page.evaluate(async () => {
        const url = performance
            .getEntriesByType('resource')
            .map((item) => item.name)
            .find((name) => name.includes('/LocalPreviewStage.ts'));
        if (!url) throw new Error('Preview stage module was not loaded');
        const { LocalPreviewStage } = await import(url);
        const setRuntime = LocalPreviewStage.prototype.setRuntime;
        window.__previewTaps = 0;
        LocalPreviewStage.prototype.setRuntime = function (runtime, ...args) {
            if (runtime) {
                window.__trialStage = this;
                window.__trialRuntime = runtime;
                const tap = runtime.tap.bind(runtime);
                runtime.tap = (...args) => {
                    window.__previewTaps++;
                    return tap(...args);
                };
            }
            return setRuntime.call(this, runtime, ...args);
        };
    });
    const clickSource = async () => {
        const point = await page.evaluate(() => {
            const stage = window.__trialStage;
            const root = window.__trialRuntime.nodes.get('source').root;
            let mesh;
            root.traverse((child) => {
                if (!mesh && child.isMesh && child.visible) mesh = child;
            });
            if (!mesh) throw new Error('Source mesh was not loaded');
            mesh.geometry.computeBoundingBox();
            stage.scene.updateMatrixWorld(true);
            stage.camera.updateMatrixWorld(true);
            const center = mesh.geometry.boundingBox.getCenter(stage.camera.position.clone());
            mesh.localToWorld(center).project(stage.camera);
            const rect = stage.renderer.domElement.getBoundingClientRect();
            return {
                x: rect.left + ((center.x + 1) * rect.width) / 2,
                y: rect.top + ((1 - center.y) * rect.height) / 2,
            };
        });
        await page.mouse.click(point.x, point.y);
    };
    await chooseInNode(page, page.locator('[data-workflow-step="action-0"]'), 'Chuyển động');
    const panel = page.getByRole('region', {
        name: 'Đặt trạng thái đích trong scene',
        exact: true,
    });
    await expect(panel.getByRole('radio', { name: 'Di chuyển (W)', exact: true })).toBeEnabled();
    await clickSource();
    expect(await page.evaluate(() => window.__previewTaps)).toBe(0);
    await expect(page.locator('[data-step-state="waiting"]')).toHaveCount(0);
    await panel
        .getByRole('button', { name: 'Đặt lại góc nhìn trạng thái đích', exact: true })
        .click();
    await expect(panel.getByRole('radio', { name: 'Di chuyển (W)', exact: true })).toBeEnabled();
    await clickSource();
    expect(await page.evaluate(() => window.__previewTaps)).toBe(0);
    await page.getByRole('button', { name: 'Đóng thiết lập bước', exact: true }).click();
    await page.getByRole('button', { name: 'Tùy chọn chạy thử', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Chạy riêng luồng đang chọn', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Chạy', exact: true })).toBeEnabled();
    await clickSource();
    await expect.poll(() => page.evaluate(() => window.__previewTaps)).toBe(1);
    await expect(page.locator('[data-step-state="done"]')).toHaveCount(3);
});

for (const [theme, width, height] of [
    ['light', 1366, 768],
    ['dark', 1920, 1080],
]) {
    test(`target preview ${theme}: fields, real gizmo drag, undo and no overflow`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height });
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await open(page, theme);
        await recordTargetGizmo(page);
        const original = await page.evaluate(() =>
            structuredClone(window.__interaction.scene.objects),
        );
        await chooseInNode(page, page.locator('[data-workflow-step="action-0"]'), 'Chuyển động');
        const panel = page.getByRole('region', {
            name: 'Đặt trạng thái đích trong scene',
            exact: true,
        });
        await expect(
            panel.getByRole('radio', { name: 'Di chuyển (W)', exact: true }),
        ).toBeEnabled();
        const identity = await page
            .evaluate(() => ({
                canvas: window.__targetStage.renderer.domElement,
                camera: window.__targetStage.camera.position.toArray(),
                gizmo: window.__targetGizmo.uuid,
            }))
            .then(({ camera, gizmo }) => ({ camera, gizmo }));
        const x = page.getByRole('textbox', { name: 'Vị trí cuối X (mm)', exact: true });
        await x.fill('63');
        await expect
            .poll(() => page.evaluate(() => window.__targetGizmo.object.position.x))
            .toBeCloseTo(0.3);
        await x.clear();
        expect(
            await page.evaluate(() =>
                window.__targetGizmo.object.position.toArray().every(Number.isFinite),
            ),
        ).toBe(true);
        await x.fill('63');
        await x.press('Tab');
        const point = await page.evaluate(() => {
            const stage = window.__targetStage;
            const gizmo = window.__targetGizmo;
            stage.scene.updateMatrixWorld(true);
            const picker = gizmo._gizmo.picker.translate.children.find(
                (child) => child.name === 'X',
            );
            picker.geometry.computeBoundingBox();
            const center = picker.geometry.boundingBox.getCenter(stage.camera.position.clone());
            picker.localToWorld(center).project(stage.camera);
            const rect = stage.renderer.domElement.getBoundingClientRect();
            return {
                x: rect.left + ((center.x + 1) * rect.width) / 2,
                y: rect.top + ((1 - center.y) * rect.height) / 2,
            };
        });
        const updates = await page.evaluate(() => window.__interaction.updates);
        await page.mouse.move(point.x, point.y);
        await page.mouse.down();
        await page.mouse.move(point.x + 35, point.y, { steps: 8 });
        expect(await page.evaluate(() => window.__interaction.updates)).toBe(updates);
        await page.mouse.up();
        await expect
            .poll(() =>
                page.evaluate(
                    () => window.__interaction.scene.interactions[0].actions[0].position[0],
                ),
            )
            .not.toBeCloseTo(0.3);
        await page.getByTestId('scene-history-undo').click();
        await expect
            .poll(() => page.evaluate(() => window.__targetGizmo.object.position.x))
            .toBeCloseTo(0.3);
        const after = await page.evaluate(() => ({
            camera: window.__targetStage.camera.position.toArray(),
            gizmo: window.__targetGizmo.uuid,
        }));
        expect(after.gizmo).toBe(identity.gizmo);
        after.camera.forEach((value, index) => {
            expect(value).toBeCloseTo(identity.camera[index], 8);
        });
        expect(await page.evaluate(() => window.__interaction.scene.objects)).toEqual(original);
        expect(
            await page.evaluate(() => ({
                x: document.documentElement.scrollWidth > innerWidth,
                y: document.documentElement.scrollHeight > innerHeight,
            })),
        ).toEqual({ x: false, y: false });
        expect(errors).toEqual([]);
        await page.screenshot({ path: info.outputPath(`target-preview-${theme}.png`) });
        await page.getByRole('button', { name: 'Đóng thiết lập bước', exact: true }).click();
        await expect(panel).toHaveCount(0);
    });
}

test('target preview left drag orbits the camera before and after dragging the gizmo', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await open(page);
    await recordTargetGizmo(page);
    await chooseInNode(page, page.locator('[data-workflow-step="action-0"]'), 'Chuyển động');
    const panel = page.getByRole('region', {
        name: 'Đặt trạng thái đích trong scene',
        exact: true,
    });
    await expect(panel.getByRole('radio', { name: 'Di chuyển (W)', exact: true })).toBeEnabled();
    const canvas = panel.locator('canvas');
    const bounds = await canvas.boundingBox();
    const before = await page.evaluate(() => ({
        position: window.__targetStage.camera.position.toArray(),
        enabled: window.__targetStage.controls.enabled,
    }));
    expect(before.position[0]).toBeCloseTo(0, 8);
    expect(before.position[1]).toBeLessThan(0);
    expect((Math.atan2(before.position[2], -before.position[1]) * 180) / Math.PI).toBeCloseTo(
        30,
        6,
    );
    await page.mouse.move(bounds.x + 30, bounds.y + bounds.height * 0.7);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 110, bounds.y + bounds.height * 0.7 - 50, { steps: 10 });
    await page.mouse.up();
    const after = await page.evaluate(() => ({
        position: window.__targetStage.camera.position.toArray(),
        enabled: window.__targetStage.controls.enabled,
    }));
    expect(
        Math.hypot(...after.position.map((value, index) => value - before.position[index])),
    ).toBeGreaterThan(0.05);
    expect(after.enabled).toBe(true);
    const pickerPoint = await page.evaluate(() => {
        const stage = window.__targetStage;
        const gizmo = window.__targetGizmo;
        stage.scene.updateMatrixWorld(true);
        const picker = gizmo._gizmo.picker.translate.children.find((child) => child.name === 'X');
        picker.geometry.computeBoundingBox();
        const center = picker.geometry.boundingBox.getCenter(stage.camera.position.clone());
        picker.localToWorld(center).project(stage.camera);
        const rect = stage.renderer.domElement.getBoundingClientRect();
        return {
            x: rect.left + ((center.x + 1) * rect.width) / 2,
            y: rect.top + ((1 - center.y) * rect.height) / 2,
        };
    });
    await page.mouse.move(pickerPoint.x, pickerPoint.y);
    await page.mouse.down();
    await page.mouse.move(pickerPoint.x + 35, pickerPoint.y, { steps: 8 });
    await page.mouse.up();
    expect(await page.evaluate(() => window.__targetStage.controls.enabled)).toBe(true);
    const beforeSecond = await page.evaluate(() => window.__targetStage.camera.position.toArray());
    await page.mouse.move(bounds.x + 30, bounds.y + bounds.height * 0.7);
    await page.mouse.down();
    await page.mouse.move(bounds.x + 110, bounds.y + bounds.height * 0.7 - 50, { steps: 10 });
    await page.mouse.up();
    const afterSecond = await page.evaluate(() => window.__targetStage.camera.position.toArray());
    expect(
        Math.hypot(...afterSecond.map((value, index) => value - beforeSecond[index])),
    ).toBeGreaterThan(0.05);
    await panel
        .getByRole('button', { name: 'Đặt lại góc nhìn trạng thái đích', exact: true })
        .click();
    const reset = await page.evaluate(() => window.__targetStage.camera.position.toArray());
    reset.forEach((value, index) => {
        expect(value).toBeCloseTo(before.position[index], 8);
    });
});

test('camera-facing target locks rotation, preserves saved angles and still allows move and scale', async ({
    page,
}) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await open(page);
    await page.evaluate(() => {
        const scene = structuredClone(window.__interaction.scene);
        scene.objects.find((object) => object.id === 'target').billboard = true;
        scene.interactions[0].actions[0] = {
            type: 'transformTo',
            objectId: 'target',
            position: [0.2, 0, 0.1],
            rotation: [10, 20, 30],
            scale: [1, 1, 1],
            durationMs: 500,
            delayMsSchema: 0,
            easing: 'linear',
        };
        localStorage.setItem('interaction-ui-saved', JSON.stringify(scene));
    });
    await page.reload();
    await expect(page.locator('[data-workflow-step]')).toHaveCount(4);
    await recordTargetGizmo(page);
    await page.locator('[data-workflow-step="action-0"] .workflow-drag').click();
    const panel = page.getByRole('region', {
        name: 'Đặt trạng thái đích trong scene',
        exact: true,
    });
    const move = panel.getByRole('radio', { name: 'Di chuyển (W)', exact: true });
    const rotate = panel.getByRole('radio', { name: 'Xoay (E)', exact: true });
    const scale = panel.getByRole('radio', { name: 'Kích thước (R)', exact: true });
    await expect(move).toBeEnabled();
    await expect(rotate).toBeDisabled();
    await expect(scale).toBeEnabled();
    await expect(
        page.getByRole('checkbox', { name: 'Thay đổi góc xoay', exact: true }),
    ).toBeDisabled();
    for (const axis of ['X', 'Y', 'Z'])
        await expect(
            page.getByRole('textbox', { name: `Góc cuối ${axis} (°)`, exact: true }),
        ).toBeDisabled();
    await move.click();
    await page.keyboard.press('e');
    expect(await page.evaluate(() => window.__targetGizmo.getMode())).toBe('translate');
    await page.evaluate(() => {
        const gizmo = window.__targetGizmo;
        gizmo.object.position.x = 0.45;
        gizmo.object.scale.set(1.3, 1.3, 1.3);
        gizmo.dispatchEvent({ type: 'mouseUp', mode: gizmo.getMode() });
    });
    await expect
        .poll(() =>
            page.evaluate(() => window.__interaction.scene.interactions[0].actions[0].position[0]),
        )
        .toBe(0.45);
    expect(
        await page.evaluate(() => window.__interaction.scene.interactions[0].actions[0].rotation),
    ).toEqual([10, 20, 30]);
    await panel.getByRole('button', { name: 'Về trạng thái ban đầu', exact: true }).click();
    await expect(
        panel.getByRole('button', { name: 'Về trạng thái ban đầu', exact: true }),
    ).toBeDisabled();
    expect(
        await page.evaluate(() => window.__interaction.scene.interactions[0].actions[0].rotation),
    ).toEqual([10, 20, 30]);
    await page.getByRole('checkbox', { name: 'Thay đổi vị trí', exact: true }).uncheck();
    await page.getByRole('checkbox', { name: 'Thay đổi kích thước', exact: true }).uncheck();
    await expect.poll(() => page.evaluate(() => Boolean(window.__targetGizmo.object))).toBe(false);
    await page.keyboard.press('e');
    await expect(rotate).not.toBeChecked();
    // A regular object remains rotatable, including after switching from a billboard target.
    await chooseNodeTarget(page, page.locator('[data-workflow-step="action-0"]'), 'Khủng long');
    await expect(rotate).toBeEnabled();
    await expect(rotate).toBeChecked();
    await expect(page.getByRole('textbox', { name: 'Góc cuối X (°)', exact: true })).toBeEnabled();
});
