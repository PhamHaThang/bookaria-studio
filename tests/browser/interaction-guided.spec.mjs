import { expect, test } from '@playwright/test';

async function openWithRules(page, interactions) {
    await page.goto('/tests/browser/interaction.html');
    await page.evaluate((rules) => {
        const scene = { ...window.__interaction.scene, interactions: rules };
        localStorage.setItem('interaction-ui-saved', JSON.stringify(scene));
    }, interactions);
    await page.reload();
    await expect(page.getByTestId('interaction-flow-canvas')).toBeVisible();
}

const score = (value, operation = 'set') => ({ type: 'setState', key: 'score', operation, value });
const rule = (id, name, trigger, action) => ({
    id,
    name,
    trigger,
    enabled: true,
    onRetrigger: 'ignore',
    actions: [action],
});

test('page preview preserves rule order and simulates only configured events until leaving', async ({
    page,
}) => {
    await openWithRules(page, [
        rule('initial', 'Đặt điểm', { type: 'onPageEnter' }, score(5)),
        rule('increase', 'Cộng điểm', { type: 'onPageEnter' }, score(2, 'increment')),
        rule('found', 'Nhận diện', { type: 'onMarkerFound' }, score(10)),
        rule('lost', 'Mất dấu', { type: 'onMarkerLost' }, score(20)),
        rule('leave', 'Rời trang', { type: 'onPageLeave' }, score(30)),
    ]);
    await page.getByRole('button', { name: 'Chạy thử', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Chạy thử tương tác', exact: true });
    await panel.getByRole('button', { name: 'Chi tiết chạy thử', exact: true }).click();
    const details = page.getByRole('dialog', { name: 'Chi tiết chạy thử', exact: true });
    const memory = details.locator('[aria-label="Ghi nhớ khi chạy thử"]');
    await expect(memory).toContainText('→ 7');
    await details.getByRole('button', { name: 'Đóng chi tiết chạy thử', exact: true }).click();
    const simulate = panel.getByRole('button', { name: 'Mô phỏng sự kiện', exact: true });
    for (const [event, value] of [
        ['Nhận diện AR', 10],
        ['Mất dấu AR', 20],
        ['Rời trang', 30],
    ]) {
        await simulate.click();
        await expect(page.getByRole('menuitem')).toHaveCount(3);
        await page.getByRole('menuitem', { name: event, exact: true }).click();
        await panel.getByRole('button', { name: 'Chi tiết chạy thử', exact: true }).click();
        await expect(memory).toContainText(`→ ${value}`);
        await details.getByRole('button', { name: 'Đóng chi tiết chạy thử', exact: true }).click();
    }
    await expect(simulate).toBeDisabled();
    await expect(panel.getByRole('button', { name: 'Chạm thử', exact: true })).toBeDisabled();
    await panel.getByRole('button', { name: 'Đặt lại từ đầu', exact: true }).click();
    await expect(simulate).toBeEnabled();
    await panel.getByRole('button', { name: 'Chi tiết chạy thử', exact: true }).click();
    await expect(memory).toContainText('→ 7');
});

test('a cross-rule answer event opens page preview and fires after the question is answered', async ({
    page,
}) => {
    await openWithRules(page, [
        rule(
            'reward',
            'Thưởng đáp án đúng',
            { type: 'onAnswer', questionId: 'q1', answer: 'correct' },
            score(5),
        ),
        rule(
            'ask',
            'Hỏi khi chạm',
            { type: 'onTap', objectId: 'source' },
            {
                type: 'askQuestion',
                question: {
                    questionId: 'q1',
                    title: 'Ai đến đích?',
                    choices: [
                        { id: 'yes', text: 'Rùa' },
                        { id: 'no', text: 'Thỏ' },
                    ],
                    correctChoiceId: 'yes',
                },
            },
        ),
    ]);
    await page.getByRole('button', { name: 'Tùy chọn chạy thử', exact: true }).click();
    await expect(
        page.getByRole('menuitem', { name: 'Chạy riêng luồng đang chọn', exact: true }),
    ).toHaveCount(0);
    await page.getByRole('menuitem', { name: 'Thử cả trang với câu hỏi', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Chạy thử tương tác', exact: true });
    await expect(panel.getByRole('heading', { name: 'Thử cả trang', exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Mô phỏng sự kiện', exact: true })).toHaveCount(
        0,
    );
    await panel.getByRole('button', { name: 'Chạm thử', exact: true }).click();
    const question = page.getByRole('dialog', { name: 'Câu hỏi tương tác', exact: true });
    await question.getByRole('button', { name: 'Rùa', exact: true }).click();
    await expect(question.getByText('Bạn đã trả lời đúng.', { exact: true })).toBeVisible();
    await question.getByRole('button', { name: 'Đóng', exact: true }).click();
    await panel.getByRole('button', { name: 'Chi tiết chạy thử', exact: true }).click();
    await expect(page.getByLabel('Ghi nhớ khi chạy thử')).toContainText('→ 5');
});

for (const theme of ['light', 'dark']) {
    test(`preview canvas ${theme}: stays the same size with many values and live logs`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width: 1366, height: 760 });
        await page.addInitScript((value) => localStorage.setItem('bookaria.theme', value), theme);
        await page.goto('/tests/browser/interaction.html');
        const scene = await page.evaluate(() => structuredClone(window.__interaction.scene));
        scene.interactions = [
            {
                id: 'counter',
                name: 'Chạm để cộng điểm',
                enabled: true,
                onRetrigger: 'restart',
                trigger: { type: 'onTap', objectId: 'source' },
                actions: [
                    { type: 'setState', key: 'score', operation: 'increment', value: 1 },
                    { type: 'wait', ms: 30 },
                ],
            },
        ];
        await page.evaluate((scene) => {
            localStorage.setItem('interaction-ui-saved', JSON.stringify(scene));
            localStorage.setItem(
                'interaction-ui-memory',
                JSON.stringify([
                    { key: 'score', name: 'Điểm số', type: 'number', initialValue: 0 },
                    ...Array.from({ length: 30 }, (_, index) => ({
                        key: `value${index}`,
                        name: `Thông tin ${index + 1}`,
                        type: 'number',
                        initialValue: index,
                    })),
                    {
                        key: 'note',
                        name: 'Ghi nhớ dài',
                        type: 'string',
                        initialValue: 'x'.repeat(400),
                    },
                ]),
            );
        }, scene);
        await page.reload();
        await page.getByRole('button', { name: 'Chạy thử', exact: true }).click();
        const panel = page.getByRole('region', { name: 'Chạy thử tương tác', exact: true });
        const tap = panel.getByRole('button', { name: 'Chạm thử', exact: true });
        await expect(tap).toBeEnabled({ timeout: 30000 });
        const canvas = panel.locator('canvas');
        await expect(canvas).toBeVisible();
        const graph = page.getByTestId('interaction-flow-canvas');
        await expect(graph.locator('.react-flow__background')).toBeVisible();
        const previewGround = await canvas.evaluate((element) =>
            getComputedStyle(element).getPropertyValue('--editor-ground').trim(),
        );
        const diagramGround = await graph.evaluate((element) =>
            getComputedStyle(element).getPropertyValue('--editor-ground').trim(),
        );
        expect(previewGround).not.toBe(diagramGround);
        const status = await panel.getByRole('status').boundingBox();
        expect(status.height).toBeLessThanOrEqual(20);
        const original = await canvas.boundingBox();
        await expect(
            page.getByRole('dialog', { name: 'Chi tiết chạy thử', exact: true }),
        ).toHaveCount(0);
        for (let count = 0; count < 8; count++) await tap.click();
        let current = await canvas.boundingBox();
        expect(Math.abs(current.height - original.height)).toBeLessThanOrEqual(1);
        expect(Math.abs(current.width - original.width)).toBeLessThanOrEqual(1);
        await page.screenshot({
            animations: 'disabled',
            path: info.outputPath(`preview-clean-${theme}.png`),
        });
        const trigger = panel.getByRole('button', { name: 'Chi tiết chạy thử', exact: true });
        await trigger.click();
        const details = page.getByRole('dialog', { name: 'Chi tiết chạy thử', exact: true });
        const score = details.getByText('Điểm số', { exact: true }).locator('..').locator('dd');
        await expect(score).toHaveText('0 → 8');
        await expect(
            details.getByRole('list', { name: 'Nhật ký chạy thử' }).locator('li'),
        ).toHaveCount(6);
        const scroll = details.locator('[data-slot="scroll-area-viewport"]');
        await expect
            .poll(() => scroll.evaluate((element) => element.scrollHeight > element.clientHeight))
            .toBe(true);
        expect(
            await scroll.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
        ).toBe(true);
        await expect(scroll).toHaveAttribute('tabindex', '0');
        await scroll.focus();
        await page.keyboard.press('End');
        await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
        await tap.click();
        await expect(details).toBeVisible();
        await expect(score).toHaveText('0 → 9');
        current = await canvas.boundingBox();
        expect(Math.abs(current.height - original.height)).toBeLessThanOrEqual(1);
        await page.screenshot({
            animations: 'disabled',
            path: info.outputPath(`preview-details-${theme}.png`),
        });
        await panel.getByRole('button', { name: 'Đặt lại từ đầu', exact: true }).click();
        await expect(score).toHaveText('0 → 0');
        await expect(details).toBeVisible();
        current = await canvas.boundingBox();
        expect(Math.abs(current.height - original.height)).toBeLessThanOrEqual(1);
        await page.keyboard.press('Escape');
        await expect(details).toHaveCount(0);
        await expect(trigger).toBeFocused();
        await trigger.click();
        await page.getByRole('button', { name: 'Đóng thử', exact: true }).click();
        await expect(details).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Chạy thử', exact: true })).toBeFocused();
    });
}

for (const theme of ['light', 'dark']) {
    test(`combined test control ${theme}: defaults to page and opens isolated mode from its menu`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width: 1366, height: 900 });
        await page.addInitScript((value) => localStorage.setItem('bookaria.theme', value), theme);
        await page.goto('/tests/browser/interaction.html');
        await expect(page.getByTestId('interaction-flow-canvas')).toBeVisible();
        const authored = await page.evaluate(() => structuredClone(window.__interaction.scene));
        const run = page.getByRole('button', { name: 'Chạy thử', exact: true });
        const options = page.getByRole('button', { name: 'Tùy chọn chạy thử', exact: true });
        await expect(page.getByRole('button', { name: 'Thử cả trang', exact: true })).toHaveCount(
            0,
        );
        await expect(
            page.getByRole('button', { name: 'Thử riêng luồng', exact: true }),
        ).toHaveCount(0);
        const [main, arrow] = await Promise.all([run.boundingBox(), options.boundingBox()]);
        expect(Math.abs(main.y - arrow.y)).toBeLessThanOrEqual(1);
        expect(Math.abs(main.height - arrow.height)).toBeLessThanOrEqual(1);
        expect(Math.abs(main.x + main.width - arrow.x)).toBeLessThanOrEqual(1);
        await run.click();
        const panel = page.getByRole('region', { name: 'Chạy thử tương tác', exact: true });
        await expect(
            panel.getByRole('heading', { name: 'Thử cả trang', exact: true }),
        ).toBeFocused();
        await expect(panel.getByRole('button', { name: 'Chạy', exact: true })).toHaveCount(0);
        await expect(options).toHaveCount(0);
        await page.getByRole('button', { name: 'Đóng thử', exact: true }).click();
        await expect(run).toBeFocused();
        await options.focus();
        await page.keyboard.press('ArrowDown');
        const isolated = page.getByRole('menuitem', {
            name: 'Chạy riêng luồng đang chọn',
            exact: true,
        });
        await expect(isolated).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(options).toBeFocused();
        await options.click();
        await page.screenshot({
            animations: 'disabled',
            path: info.outputPath(`run-options-${theme}.png`),
        });
        await isolated.click();
        await expect(
            panel.getByRole('heading', { name: 'Thử riêng: Chạm để khám phá', exact: true }),
        ).toBeFocused();
        await expect(panel.getByRole('button', { name: 'Chạy', exact: true })).toBeVisible();
        await expect(panel.getByRole('button', { name: 'Chạm thử', exact: true })).toHaveCount(0);
        await expect(panel.getByRole('button', { name: 'Đóng chạy thử', exact: true })).toHaveCount(
            0,
        );
        await page.getByRole('button', { name: 'Đóng thử', exact: true }).click();
        await expect(panel).toHaveCount(0);
        await expect(run).toBeFocused();
        expect(await page.evaluate(() => window.__interaction.scene)).toEqual(authored);
    });
}

async function addGraphAction(page, kind) {
    await page.locator('[data-workflow-step="start"] .workflow-drag').click();
    await page
        .locator('[data-workflow-step="start"]')
        .getByRole('button', { name: 'Thêm bước sau khối này', exact: true })
        .click();
    const picker = page.getByRole('dialog', { name: 'Thêm khối tương tác', exact: true });
    await picker
        .getByRole('button', {
            name: kind === 'condition' ? 'Điều kiện' : kind === 'link' ? 'Điều hướng' : 'Hành động',
            exact: true,
        })
        .click();
    if (kind === 'hide') {
        const action = page.locator('.react-flow__node.selected [data-workflow-step]');
        await action.getByRole('combobox', { name: /^Chức năng khối/ }).click();
        await page.getByRole('option', { name: 'Hiển thị đối tượng', exact: true }).click();
        await action.getByRole('combobox', { name: /^Thao tác khối/ }).click();
        await page.getByRole('option', { name: 'Ẩn', exact: true }).click();
    }
}

test('sidebar step count follows valid and incomplete edits, undo, redo and deletion', async ({
    page,
}) => {
    await page.goto('/tests/browser/interaction.html');
    const row = page.getByRole('group', { name: 'Luồng Chạm để khám phá', exact: true });
    await expect(row.getByText('3 bước', { exact: true })).toBeVisible();
    await addGraphAction(page, 'hide');
    await expect(row.getByText('4 bước', { exact: true })).toBeVisible();
    await expect
        .poll(() => page.evaluate(() => window.__interaction.scene.interactions[0].actions.length))
        .toBe(4);
    await addGraphAction(page, 'link');
    await expect(row.getByText('5 bước', { exact: true })).toBeVisible();
    expect(
        await page.evaluate(() => window.__interaction.scene.interactions[0].actions.length),
    ).toBe(4);
    await page.getByLabel('Địa chỉ liên kết', { exact: true }).fill('https://example.com');
    await expect
        .poll(() => page.evaluate(() => window.__interaction.scene.interactions[0].actions.length))
        .toBe(5);
    await expect(row.getByText('5 bước', { exact: true })).toBeVisible();
    await page.getByTestId('scene-history-undo').click();
    await expect(row.getByText('4 bước', { exact: true })).toBeVisible();
    await page.getByTestId('scene-history-redo').click();
    await expect(row.getByText('5 bước', { exact: true })).toBeVisible();
    await page.locator('[data-workflow-step]').nth(1).locator('.workflow-drag').click();
    await page.getByRole('button', { name: 'Xóa bước', exact: true }).click();
    await expect(row.getByText('4 bước', { exact: true })).toBeVisible();
    await expect(page.locator('[data-workflow-step]')).toHaveCount(5);
    await expect(row.getByText('4 bước', { exact: true })).toBeVisible();
});

test('sidebar counts steps in a new incomplete flow without counting the event', async ({
    page,
}) => {
    await page.goto('/tests/browser/interaction.html');
    await page.getByRole('button', { name: 'Thêm tương tác', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Luồng mới', exact: true }).click();
    const list = page.getByRole('region', { name: 'Danh sách luồng tương tác', exact: true });
    const row = list.getByRole('group').last();
    await expect(row).toContainText('0 bước — Đang thiết lập');
    await addGraphAction(page, 'link');
    await expect(row).toContainText('1 bước — Đang thiết lập');
    expect(await page.evaluate(() => window.__interaction.scene.interactions.length)).toBe(1);
    await page.getByLabel('Địa chỉ liên kết', { exact: true }).fill('https://example.com');
    await expect(row.getByText('1 bước', { exact: true })).toBeVisible();
    await expect(row).not.toContainText('Đang thiết lập');
});

test('sidebar counts every condition branch step and excludes the start event', async ({
    page,
}) => {
    await page.goto('/tests/browser/interaction.html');
    await addGraphAction(page, 'condition');
    const row = page.getByRole('group', { name: 'Luồng Chạm để khám phá', exact: true });
    await expect(row.getByText('6 bước', { exact: true })).toBeVisible();
    await expect(page.locator('[data-workflow-step]')).toHaveCount(7);
});

for (const theme of ['light', 'dark']) {
    test(`event settings ${theme}: explains the event and saves repeat behavior`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width: theme === 'light' ? 1024 : 1440, height: 800 });
        await page.addInitScript((value) => localStorage.setItem('bookaria.theme', value), theme);
        await openWithRules(page, [
            rule('scan', 'Quét trang', { type: 'onMarkerFound' }, score(1)),
        ]);

        const start = page.locator('[data-workflow-step="start"]');
        await start.locator('.workflow-drag').click();
        const settings = page.getByRole('complementary', { name: 'Thiết lập bước tương tác' });
        const eventTypes = settings.getByRole('group', { name: 'Loại sự kiện' });
        const found = eventTypes.getByRole('radio', { name: 'Khi nhận diện trang AR' });
        const lost = eventTypes.getByRole('radio', { name: 'Khi mất dấu trang AR' });
        const blockType = start.getByRole('combobox', { name: 'Chức năng khối Sự kiện' });
        await expect(eventTypes.getByRole('radio')).toHaveCount(8);
        await expect(found).toBeChecked();
        await found.press('ArrowRight');
        await expect(lost).toBeChecked();
        await expect(blockType).toHaveText('Khi mất dấu trang AR');
        await expect(settings.getByText(/camera mất dấu ảnh hoặc marker/)).toBeVisible();
        await blockType.click();
        await page.getByRole('option', { name: 'Khi nhận diện trang AR', exact: true }).click();
        await expect(found).toBeChecked();
        await expect(settings.getByText(/camera nhận diện được ảnh hoặc marker/)).toBeVisible();
        const ignore = settings.getByRole('radio', { name: 'Bỏ qua lần kích hoạt mới' });
        const restart = settings.getByRole('radio', { name: 'Chạy lại từ đầu' });
        await expect(ignore).toBeChecked();
        await ignore.focus();
        await page.keyboard.press('ArrowDown');
        await expect(restart).toBeChecked();
        await expect
            .poll(() => page.evaluate(() => window.__interaction.scene.interactions[0].onRetrigger))
            .toBe('restart');
        await page.getByRole('button', { name: 'Lưu sách', exact: true }).click();
        await page.reload();
        await start.locator('.workflow-drag').click();
        await expect(restart).toBeChecked();
        await settings.screenshot({ path: info.outputPath(`event-settings-${theme}.png`) });
        await settings.getByText('Lượt hiện tại tiếp tục chạy.', { exact: true }).click();
        await expect(ignore).toBeChecked();
        await settings.getByRole('button', { name: 'Đóng thiết lập bước' }).click();
        await expect(settings).toHaveCount(0);
    });
}

test('memory condition is configured in the event and omitted from new-action menus', async ({
    page,
}, info) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/tests/browser/interaction.html');
    await page.locator('[data-workflow-step="start"] .workflow-drag').click();
    await page
        .getByRole('group', { name: 'Loại sự kiện' })
        .getByRole('radio', { name: 'Khi ghi nhớ đạt điều kiện', exact: true })
        .check();
    await expect(
        page.getByText('Tự chạy khi ghi nhớ chuyển từ chưa đạt sang đạt.', { exact: false }),
    ).toBeVisible();
    await page.getByRole('spinbutton', { name: 'Giá trị ghi nhớ', exact: true }).fill('5');
    await expect
        .poll(() => page.evaluate(() => window.__interaction.scene.interactions[0].trigger))
        .toMatchObject({
            type: 'onStateCondition',
            test: { type: 'variable', key: 'score', operator: 'gte', value: 5 },
        });
    await page.screenshot({ path: info.outputPath('memory-event-editor.png') });
    await page
        .locator('[data-workflow-step]')
        .nth(1)
        .getByRole('combobox', { name: /^Chức năng khối/ })
        .click();
    await expect(
        page.getByRole('option', { name: 'Chờ đến khi điều kiện đúng', exact: true }),
    ).toHaveCount(0);
    await page.keyboard.press('Escape');
    const saved = await page.evaluate(() => structuredClone(window.__interaction.scene));
    await expect(page.getByTestId('interaction-flow-canvas')).toBeVisible();
    expect(await page.evaluate(() => window.__interaction.scene)).toEqual(saved);
});

test('condition settings change the check and add steps to the correct branches', async ({
    page,
}, info) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openWithRules(page, [
        rule(
            'branch-check',
            'Kiểm tra điểm',
            { type: 'onPageEnter' },
            {
                type: 'condition',
                test: { type: 'variable', key: 'score', operator: 'gte', value: 5 },
                delayMsSchema: 0,
            },
        ),
    ]);
    const node = page.locator('[data-workflow-step="action-0"]');
    const selectCondition = () => node.locator('.workflow-drag').click();
    await selectCondition();
    const settings = page.getByRole('complementary', { name: 'Thiết lập bước tương tác' });
    const types = settings.getByRole('group', { name: 'Loại điều kiện' });
    await expect(types.getByRole('radio')).toHaveCount(4);
    await expect(settings.getByText('“Điểm số” ít nhất 5?', { exact: true })).toBeVisible();
    await types.getByRole('radio', { name: 'Số lần chạm' }).check();
    await expect(node.getByRole('combobox', { name: 'Chức năng khối Điều kiện' })).toHaveText(
        'Số lần chạm',
    );
    await settings.getByRole('spinbutton', { name: 'Số lần chạm tối thiểu' }).fill('2');
    await settings.screenshot({ path: info.outputPath('condition-settings.png') });
    for (const [branch, group] of [
        ['Đúng', 'Ghi nhớ'],
        ['Sai', 'Hành động'],
    ]) {
        const label = `Thêm bước nhánh ${branch}`;
        await settings.getByRole('button', { name: label }).click();
        await page
            .getByRole('dialog', { name: label })
            .getByRole('button', { name: group, exact: true })
            .click();
        await selectCondition();
        await expect(settings.getByRole('button', { name: label })).toHaveCount(0);
    }
    await expect
        .poll(() => page.evaluate(() => window.__interaction.scene.interactions[0].actions[0].test))
        .toMatchObject({
            type: 'interactionCount',
            min: 2,
        });
    const saved = await page.evaluate(() => window.__interaction.scene.interactions[0]);
    expect(
        saved.workflow.edges
            .filter((edge) => edge.source === 'action-0')
            .map((edge) => edge.port)
            .sort(),
    ).toEqual(['false', 'true']);
    const nodes = new Map(
        saved.editorLayout.map((step, index) => [step.id, saved.actions[index - 1]?.type]),
    );
    expect(nodes.get(saved.workflow.edges.find((edge) => edge.port === 'true').target)).toBe(
        'setState',
    );
    expect(nodes.get(saved.workflow.edges.find((edge) => edge.port === 'false').target)).toBe(
        'wait',
    );
});

test('navigation settings show only fields for the selected destination and protect following steps', async ({
    page,
}, info) => {
    const link = { type: 'openUrl', url: 'https://example.com/', delayMsSchema: 0 };
    const start = { type: 'onPageEnter' };
    await openWithRules(page, [rule('navigation', 'Đi đến trang', start, link)]);
    const node = page.locator('[data-workflow-step="action-0"]');
    await node.locator('.workflow-drag').click();
    const settings = page.getByRole('complementary', { name: 'Thiết lập bước tương tác' });
    const options = settings.getByRole('group', { name: 'Đi đến đâu?' });
    await expect(options.getByRole('radio')).toHaveCount(5);
    await expect(settings.getByRole('textbox', { name: 'Địa chỉ liên kết' })).toBeVisible();
    await options.getByRole('radio', { name: 'Một trang cụ thể' }).check();
    await expect(settings.getByRole('combobox', { name: 'Trang đích' })).toBeVisible();
    await expect(settings.getByRole('textbox', { name: 'Địa chỉ liên kết' })).toHaveCount(0);
    await expect(settings.getByText(/Nhánh kết thúc tại bước này/)).toBeVisible();
    await expect(settings.getByRole('button', { name: 'Nhân bản bước' })).toHaveCount(0);
    await expect(node.getByRole('combobox', { name: 'Chức năng khối Điều hướng' })).toHaveText(
        'Một trang cụ thể',
    );
    await settings.screenshot({ path: info.outputPath('navigation-settings.png') });
    await options.getByRole('radio', { name: 'Kết thúc trải nghiệm' }).check();
    await expect(settings.getByRole('combobox', { name: 'Trang đích' })).toHaveCount(0);
    await settings.getByRole('textbox', { name: 'Lời kết trải nghiệm' }).fill('Hoàn thành');
    await expect
        .poll(() =>
            page.evaluate(() => window.__interaction.scene.interactions[0].actions[0].navigation),
        )
        .toMatchObject({
            target: 'end',
            message: 'Hoàn thành',
        });

    await openWithRules(page, [
        {
            ...rule('connected-link', 'Mở rồi đợi', start, link),
            actions: [link, { type: 'wait', ms: 100 }],
        },
    ]);
    await node.locator('.workflow-drag').click();
    await expect(options.getByRole('radio', { name: 'Trang tiếp theo' })).toBeDisabled();
    await expect(options.getByRole('radio', { name: 'Mở liên kết' })).toBeChecked();
    await expect(settings.getByText(/Ngắt dây nối sau bước này/)).toBeVisible();
});

test('points template creates a memory event and one action', async ({ page }) => {
    await page.goto('/tests/browser/interaction.html');
    await page.getByRole('button', { name: 'Thêm tương tác', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Dùng mẫu', exact: true }).click();
    await page.getByRole('radio', { name: 'Mở khóa theo điểm', exact: true }).check();
    await page.getByRole('button', { name: 'Sử dụng mẫu', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Mở khóa theo điểm', exact: true });
    await expect(dialog.getByRole('combobox', { name: 'Bắt đầu khi', exact: true })).toHaveText(
        'Khi ghi nhớ đạt điều kiện',
    );
    await dialog.getByRole('spinbutton', { name: 'Giá trị ghi nhớ', exact: true }).fill('4');
    await dialog.getByRole('button', { name: 'Tạo tương tác', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const added = await page.evaluate(() => window.__interaction.scene.interactions.at(-1));
    expect(added.trigger).toMatchObject({
        type: 'onStateCondition',
        test: { key: 'score', value: 4 },
    });
    expect(added.actions).toHaveLength(1);
    expect(added.actions[0].type).toBe('setVisible');
    expect(added.workflow.edges.map((edge) => edge.port)).toEqual(['next']);
});

test('an incomplete memory event survives reload and can be corrected', async ({ page }) => {
    await page.goto('/tests/browser/interaction.html');
    await page.locator('[data-workflow-step="start"] .workflow-drag').click();
    await page
        .locator('[data-workflow-step="start"]')
        .getByRole('combobox', { name: 'Chức năng khối Sự kiện', exact: true })
        .click();
    await page.getByRole('option', { name: 'Khi ghi nhớ đạt điều kiện', exact: true }).click();
    await expect
        .poll(() => page.evaluate(() => window.__interaction.scene.interactions[0].trigger.type))
        .toBe('onStateCondition');
    await page.getByRole('button', { name: 'Lưu sách', exact: true }).click();
    await page.getByRole('spinbutton', { name: 'Giá trị ghi nhớ', exact: true }).fill('');
    await expect.poll(() => page.evaluate(() => window.__interaction.invalid)).toBe(true);
    await page.reload();
    await page.locator('[data-workflow-step="start"] .workflow-drag').click();
    await expect(
        page
            .locator('[data-workflow-step="start"]')
            .getByRole('combobox', { name: 'Chức năng khối Sự kiện', exact: true }),
    ).toHaveText('Khi ghi nhớ đạt điều kiện');
    const value = page.getByRole('spinbutton', { name: 'Giá trị ghi nhớ', exact: true });
    await expect(value).toHaveValue('');
    await value.fill('5');
    await expect.poll(() => page.evaluate(() => window.__interaction.invalid)).toBe(false);
    expect(
        await page.evaluate(() => window.__interaction.scene.interactions[0].trigger.test.value),
    ).toBe(5);
});

for (const initialScore of [0, 3]) {
    test(`memory events run on threshold crossing or satisfied page entry (${initialScore}), without repeat and with reset`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width: initialScore === 0 ? 1366 : 1024, height: 900 });
        await page.goto('/tests/browser/interaction.html');
        const snapshot = await page.evaluate(() => structuredClone(window.__interaction.scene));
        snapshot.interactions = [
            {
                id: 'reward',
                name: 'Đủ điểm nhận thưởng',
                enabled: true,
                onRetrigger: 'ignore',
                trigger: {
                    type: 'onStateCondition',
                    test: { type: 'variable', key: 'score', operator: 'gte', value: 3 },
                },
                actions: [
                    { type: 'setState', key: 'rewardCount', operation: 'increment', value: 1 },
                ],
            },
            {
                id: 'tap',
                name: 'Chạm cộng điểm',
                enabled: true,
                onRetrigger: 'ignore',
                trigger: { type: 'onTap', objectId: 'source' },
                actions: [{ type: 'setState', key: 'score', operation: 'increment', value: 1 }],
            },
        ];
        await page.evaluate(
            ({ scene, initialScore }) => {
                localStorage.setItem('interaction-ui-saved', JSON.stringify(scene));
                localStorage.setItem(
                    'interaction-ui-memory',
                    JSON.stringify([
                        {
                            key: 'score',
                            name: 'Điểm số',
                            type: 'number',
                            initialValue: initialScore,
                        },
                        {
                            key: 'rewardCount',
                            name: 'Số lần thưởng',
                            type: 'number',
                            initialValue: 0,
                        },
                    ]),
                );
            },
            { scene: snapshot, initialScore },
        );
        await page.reload();
        const authored = await page.evaluate(() => structuredClone(window.__interaction.scene));
        await page.getByRole('button', { name: 'Chạy thử', exact: true }).click();
        const panel = page.getByRole('region', { name: 'Chạy thử tương tác', exact: true });
        await panel.getByRole('button', { name: 'Chi tiết chạy thử', exact: true }).click();
        const details = page.getByRole('dialog', { name: 'Chi tiết chạy thử', exact: true });
        const count = details
            .locator('[aria-label="Ghi nhớ khi chạy thử"]')
            .getByText('Số lần thưởng', { exact: true })
            .locator('..')
            .locator('dd');
        await expect(count).toHaveText(initialScore === 0 ? '0 → 0' : '0 → 1', { timeout: 30000 });
        const tap = panel.getByRole('button', { name: 'Chạm thử', exact: true });
        if (initialScore === 0) {
            await tap.click();
            await tap.click();
            await expect(count).toHaveText('0 → 0');
            await tap.click();
            await expect(count).toHaveText('0 → 1');
        }
        await tap.click();
        await expect(count).toHaveText('0 → 1');
        await panel.getByRole('button', { name: 'Đặt lại từ đầu', exact: true }).click();
        await expect(count).toHaveText(initialScore === 0 ? '0 → 0' : '0 → 1');
        await page.screenshot({
            path: info.outputPath(`memory-event-preview-${initialScore}.png`),
        });
        await page.getByRole('button', { name: 'Đóng thử', exact: true }).click();
        expect(await page.evaluate(() => window.__interaction.scene)).toEqual(authored);
    });
}

for (const kind of ['memory', 'visibility', 'hide-already-hidden']) {
    test(`page preview waitUntil ${kind} resumes after another rule changes state and resets cleanly`, async ({
        page,
    }, info) => {
        await page.goto('/tests/browser/interaction.html');
        const snapshot = await page.evaluate(() => structuredClone(window.__interaction.scene));
        snapshot.interactions = [
            {
                id: 'waiter',
                name: 'Đợi điều kiện',
                enabled: true,
                onRetrigger: 'ignore',
                trigger: { type: 'onPageEnter' },
                actions: [
                    {
                        type: 'waitUntil',
                        test:
                            kind === 'memory'
                                ? { type: 'variable', key: 'score', operator: 'gte', value: 3 }
                                : { type: 'visible', objectId: 'target', value: true },
                    },
                    { type: 'setState', key: 'completed', operation: 'set', value: true },
                ],
            },
            {
                id: 'producer',
                name: 'Chạm để thay đổi',
                enabled: true,
                onRetrigger: 'ignore',
                trigger: { type: 'onTap', objectId: 'source' },
                actions: [
                    kind === 'memory'
                        ? { type: 'setState', key: 'score', operation: 'increment', value: 3 }
                        : {
                              type: 'setVisible',
                              objectId: 'target',
                              value: kind !== 'hide-already-hidden',
                              durationMs: 0,
                          },
                ],
            },
        ];
        await page.evaluate(
            (scene) => localStorage.setItem('interaction-ui-saved', JSON.stringify(scene)),
            snapshot,
        );
        await page.reload();
        if (kind === 'memory') {
            await page.locator('[data-workflow-step]').nth(1).locator('.workflow-drag').click();
            const value = page.getByRole('spinbutton', { name: 'Giá trị ghi nhớ', exact: true });
            await value.fill('4');
            await expect
                .poll(() =>
                    page.evaluate(
                        () => window.__interaction.scene.interactions[0].actions[0].test.value,
                    ),
                )
                .toBe(4);
            await value.fill('3');
        }
        const authored = await page.evaluate(() => structuredClone(window.__interaction.scene));
        await page.getByRole('button', { name: 'Chạy thử', exact: true }).click();
        const panel = page.getByRole('region', { name: 'Chạy thử tương tác', exact: true });
        await panel.getByRole('button', { name: 'Chi tiết chạy thử', exact: true }).click();
        const details = page.getByRole('dialog', { name: 'Chi tiết chạy thử', exact: true });
        const log = details.getByRole('list', { name: 'Nhật ký chạy thử' });
        await expect(log).toContainText('Đợi điều kiện: bước 1 — đang đợi', { timeout: 30000 });
        await expect(log).not.toContainText('Đợi điều kiện: bước 2 — đã xong');
        await panel.getByRole('button', { name: 'Chạm thử', exact: true }).click();
        if (kind === 'hide-already-hidden') {
            await expect(log).toContainText('Chạm để thay đổi: bước 1 — đã xong');
            await expect(log).not.toContainText('Đợi điều kiện: bước 2 — đã xong');
            await page.getByRole('button', { name: 'Đóng thử', exact: true }).click();
            expect(await page.evaluate(() => window.__interaction.scene)).toEqual(authored);
            return;
        }
        await expect(log).toContainText('Đợi điều kiện: bước 2 — đã xong');
        await panel.getByRole('button', { name: 'Đặt lại từ đầu', exact: true }).click();
        await expect(log).toContainText('Đợi điều kiện: bước 1 — đang đợi');
        await expect(log).not.toContainText('Đợi điều kiện: bước 2 — đã xong');
        await page.screenshot({ path: info.outputPath(`wait-until-${kind}.png`) });
        await page.getByRole('button', { name: 'Đóng thử', exact: true }).click();
        expect(await page.evaluate(() => window.__interaction.scene)).toEqual(authored);
    });
}

test('guided template validates before insertion and keeps source/target choices', async ({
    page,
}, info) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/tests/browser/interaction.html');
    await expect(page.getByTestId('interaction-flow-canvas')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tạo từ mẫu', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Thêm tương tác', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Dùng mẫu', exact: true }).click();
    await page.getByRole('radio', { name: 'Mở tài liệu liên quan', exact: true }).check();
    await page.getByRole('button', { name: 'Sử dụng mẫu', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Mở tài liệu liên quan', exact: true });
    await dialog.getByRole('button', { name: 'Tạo tương tác', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('Nhập liên kết');
    expect(await page.evaluate(() => window.__interaction.scene.interactions.length)).toBe(1);
    await dialog.getByLabel('Địa chỉ liên kết').fill('https://example.com/guide');
    await dialog.getByLabel('Tên tương tác', { exact: true }).fill('Tài liệu của Rùa');
    await dialog.getByRole('button', { name: 'Tạo tương tác', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect
        .poll(() => page.evaluate(() => window.__interaction.scene.interactions.length))
        .toBe(2);
    expect(
        await page.evaluate(() => window.__interaction.scene.interactions.at(-1).actions[0].url),
    ).toBe('https://example.com/guide');
    await page.screenshot({ path: info.outputPath('guided-link.png') });
});

for (const theme of ['light', 'dark']) {
    test(`graph ${theme}: opens directly and supports adding and configuring an action`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width: 1366, height: 768 });
        await page.addInitScript((theme) => localStorage.setItem('bookaria.theme', theme), theme);
        await page.goto('/tests/browser/interaction.html');
        await expect(page.getByTestId('interaction-flow-canvas')).toBeVisible();
        await expect(page.getByLabel('Cách xem tương tác', { exact: true })).toHaveCount(0);
        await expect(
            page.getByRole('region', { name: 'Các bước tương tác', exact: true }),
        ).toHaveCount(0);
        const before = await page.evaluate(() => structuredClone(window.__interaction.scene));
        await expect(page.getByTestId('interaction-flow-canvas')).toBeVisible();
        expect(await page.evaluate(() => window.__interaction.scene)).toEqual(before);
        await addGraphAction(page, 'hide');
        await expect(page.getByRole('menu')).toHaveCount(0);
        await expect
            .poll(() =>
                page.evaluate(() => window.__interaction.scene.interactions[0].actions[0].type),
            )
            .toBe('setVisible');
        expect(
            await page.evaluate(() => window.__interaction.scene.interactions[0].actions[0].value),
        ).toBe(false);
        const overflow = await page.evaluate(() => ({
            x: document.documentElement.scrollWidth > innerWidth,
            y: document.documentElement.scrollHeight > innerHeight,
        }));
        expect(overflow).toEqual({ x: false, y: false });
        await page.screenshot({
            animations: 'disabled',
            path: info.outputPath(`graph-${theme}.png`),
        });
    });
}

test('whole-page preview runs producer and consumer rules together and resets memory', async ({
    page,
}, info) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto('/tests/browser/interaction.html');
    const snapshot = await page.evaluate(() => structuredClone(window.__interaction.scene));
    snapshot.interactions = [
        {
            id: 'producer',
            name: 'Khởi tạo điểm',
            enabled: true,
            onRetrigger: 'ignore',
            trigger: { type: 'onPageEnter' },
            actions: [
                {
                    type: 'setState',
                    operation: 'increment',
                    key: 'score',
                    value: 2,
                    delayMsSchema: 0,
                },
            ],
        },
        {
            id: 'consumer',
            name: 'Chạm để thêm điểm',
            enabled: true,
            onRetrigger: 'ignore',
            trigger: { type: 'onTap', objectId: 'source' },
            actions: [
                {
                    type: 'setState',
                    operation: 'increment',
                    key: 'score',
                    value: 3,
                    delayMsSchema: 0,
                },
            ],
        },
    ];
    await page.evaluate(
        (scene) => localStorage.setItem('interaction-ui-saved', JSON.stringify(scene)),
        snapshot,
    );
    await page.reload();
    await expect(page.getByTestId('interaction-flow-canvas')).toBeVisible();
    const authored = await page.evaluate(() => structuredClone(window.__interaction.scene));
    await page.getByRole('button', { name: 'Chạy thử', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Chạy thử tương tác', exact: true });
    await panel.getByRole('button', { name: 'Chi tiết chạy thử', exact: true }).click();
    const details = page.getByRole('dialog', { name: 'Chi tiết chạy thử', exact: true });
    const memory = details.locator('[aria-label="Ghi nhớ khi chạy thử"]');
    await expect(memory).toContainText('→ 2', { timeout: 30000 });
    await panel.getByRole('button', { name: 'Chạm thử', exact: true }).click();
    await expect(memory).toContainText('→ 5');
    await expect(details.getByRole('list', { name: 'Nhật ký chạy thử' })).toContainText(
        'Chạm để thêm điểm',
    );
    await panel.getByRole('button', { name: 'Đặt lại từ đầu', exact: true }).click();
    await expect(memory).toContainText('→ 2');
    await page.getByRole('button', { name: 'Đóng thử', exact: true }).click();
    expect(await page.evaluate(() => window.__interaction.scene)).toEqual(authored);
    await page.screenshot({ path: info.outputPath('page-test.png') });
});

test('canceling a configured template makes no changes to the authored scene', async ({ page }) => {
    await page.goto('/tests/browser/interaction.html?visible-content');
    const before = await page.evaluate(() => structuredClone(window.__interaction.scene));
    await page.getByRole('button', { name: 'Thêm tương tác', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Dùng mẫu', exact: true }).click();
    await page.getByRole('radio', { name: 'Chạm để hiện thông tin', exact: true }).check();
    await page.getByRole('button', { name: 'Sử dụng mẫu', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Ẩn nội dung này khi mở trang' }).check();
    await page.getByRole('button', { name: 'Hủy', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Thêm tương tác', exact: true })).toBeFocused();
    expect(await page.evaluate(() => window.__interaction.scene)).toEqual(before);
});

test('creating a reveal template hides its chosen target in one undoable change', async ({
    page,
}, info) => {
    await page.goto('/tests/browser/interaction.html?visible-content');
    const before = await page.evaluate(() => structuredClone(window.__interaction.scene));
    expect(before.objects.find((object) => object.id === 'target').visible).toBe(true);
    await page.getByRole('button', { name: 'Thêm tương tác', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Dùng mẫu', exact: true }).click();
    await page.getByRole('radio', { name: 'Chạm để hiện thông tin', exact: true }).check();
    await page.getByRole('button', { name: 'Sử dụng mẫu', exact: true }).click();
    await expect(page.getByRole('dialog').getByText('Thao tác', { exact: true })).toHaveCount(0);
    await page.getByRole('checkbox', { name: 'Ẩn nội dung này khi mở trang' }).check();
    await page.screenshot({ animations: 'disabled', path: info.outputPath('reveal-form.png') });
    await page.getByRole('button', { name: 'Tạo tương tác', exact: true }).click();
    await expect
        .poll(() => page.evaluate(() => window.__interaction.scene.interactions.length))
        .toBe(2);
    const saved = await page.evaluate(() => structuredClone(window.__interaction.scene));
    expect(saved.objects.find((object) => object.id === 'target').visible).toBe(false);
    expect(saved.interactions.at(-1).trigger.objectId).toBe('source');
    expect(saved.interactions.at(-1).actions[0].objectId).toBe('target');
    await page.getByTestId('scene-history-undo').click();
    await expect.poll(() => page.evaluate(() => window.__interaction.scene)).toEqual(before);
});
