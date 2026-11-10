import { expect, test } from '@playwright/test';

async function openEditor(page) {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/tests/browser/editor-pages.html?pages=2&repair=1');
    await expect(page.locator('.scene-editor')).toBeVisible();
    await page.evaluate(() => {
        const store = window.__editorPages.store;
        store.setAutosavePaused('input-tests', true);
        window.__inputAudit = { writes: 0, saves: [] };
        const original = store.setScene;
        store.setScene = function (...args) {
            window.__inputAudit.writes++;
            return original.apply(this, args);
        };
    });
}
async function selectObject(page, name = 'Nút khám phá') {
    const choice = page.getByRole('button', { name: `Chọn ${name}`, exact: true });
    if (!(await choice.isVisible()))
        await page.getByRole('button', { name: /^Đối tượng \(/ }).click();
    await choice.click();
}
async function objectName(page, id = 'source') {
    const field = page.locator(`#object-${id}-name`);
    if (!(await field.isVisible()))
        await page.getByRole('button', { name: 'Thông tin cơ bản', exact: true }).click();
    return field;
}
async function snapshot(page, index = 0) {
    return page.evaluate((i) => {
        const store = window.__editorPages.store;
        return store.getPage(store.getSnapshot().working.pages[i].id);
    }, index);
}
async function writes(page) {
    return page.evaluate(() => window.__inputAudit.writes);
}

test('text typing stays local, batches scene writes and preserves the entire final value', async ({
    page,
}) => {
    await openEditor(page);
    await selectObject(page);
    const name = await objectName(page);
    await page.evaluate(() => {
        window.__inputAudit.writes = 0;
    });
    await name.fill('');
    await name.pressSequentially('Object typing audit', { delay: 5 });
    await expect(name).toHaveValue('Object typing audit');
    await expect
        .poll(async () => (await snapshot(page)).scene.objects[0].name)
        .toBe('Object typing audit');
    expect(await writes(page)).toBeLessThan(5);
    // Editing another property immediately still uses the latest text patch.
    const text = page.locator('#object-source-text');
    if (!(await text.isVisible()))
        await page.getByRole('button', { name: 'Thuộc tính văn bản', exact: true }).click();
    await text.fill('Nội dung được giữ nguyên');
    await page.getByRole('button', { name: 'Lưu sách', exact: true }).click();
    await expect
        .poll(async () => (await snapshot(page)).scene.objects[0].text)
        .toBe('Nội dung được giữ nguyên');
    expect((await snapshot(page)).scene.objects[0].name).toBe('Object typing audit');
});

test('Vietnamese composition does not publish intermediate syllables and flushes on immediate save', async ({
    page,
}) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openEditor(page);
    await selectObject(page);
    const name = await objectName(page);
    await name.focus();
    await name.dispatchEvent('compositionstart');
    await name.fill('Rùa đang chạ');
    // Some IMEs report the confirming Enter without isComposing.
    await name.dispatchEvent('keydown', { key: 'Enter', isComposing: false });
    await page.waitForTimeout(250);
    expect((await snapshot(page)).scene.objects[0].name).toBe('Nút khám phá');
    await name.fill('Rùa đang chạy');
    await name.dispatchEvent('compositionend', { data: 'Rùa đang chạy' });
    await name.press('Control+s');
    await expect
        .poll(async () => (await snapshot(page)).scene.objects[0].name)
        .toBe('Rùa đang chạy');
    await expect(
        page.getByRole('button', { name: 'Trạng thái lưu sách: Đã lưu sách', exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
});

test('native click on a previously disabled Save button flushes pending text before the save', async ({
    page,
}) => {
    await openEditor(page);
    await selectObject(page);
    const name = await objectName(page);
    const save = page.getByRole('button', { name: 'Lưu sách', exact: true });
    await expect(save).toBeDisabled();
    const box = await save.boundingBox();
    await name.fill('Tên mới lưu ngay');
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect
        .poll(async () => (await snapshot(page)).scene.objects[0].name)
        .toBe('Tên mới lưu ngay');
    await expect(
        page.getByRole('button', { name: 'Trạng thái lưu sách: Đã lưu sách', exact: true }),
    ).toBeVisible();
    await expect(save).toBeDisabled();
});

test('switching object/page flushes the source and undo/redo never replays a stale timer', async ({
    page,
}) => {
    await openEditor(page);
    await selectObject(page);
    const name = await objectName(page);
    await name.fill('Nguồn được đổi');
    await selectObject(page, 'Thông tin');
    const target = await objectName(page, 'target');
    await target.fill('Đích được đổi');
    await page.getByRole('link', { name: 'Trang 2: Nội dung 2', exact: true }).click();
    await expect
        .poll(() => page.evaluate(() => window.__editorPages.router.state.location.pathname))
        .toMatch(/000000000002$/);
    expect((await snapshot(page)).scene.objects.map((o) => o.name)).toEqual([
        'Nguồn được đổi',
        'Đích được đổi',
    ]);
    await page.waitForTimeout(250);
    expect((await snapshot(page, 1)).scene.objects.map((o) => o.name)).toEqual([
        'Nút khám phá',
        'Thông tin',
    ]);
    await page.getByTestId('scene-history-undo').click();
    await expect.poll(async () => (await snapshot(page)).scene.objects[1].name).toBe('Thông tin');
    await page.getByTestId('scene-history-redo').click();
    await expect
        .poll(async () => (await snapshot(page)).scene.objects[1].name)
        .toBe('Đích được đổi');
});

test('an external scene replacement cancels pending text instead of resurrecting it', async ({
    page,
}) => {
    await openEditor(page);
    await selectObject(page);
    const name = await objectName(page);
    await name.fill('Bản đang nhập');
    await page.evaluate(() => {
        const store = window.__editorPages.store;
        const id = store.getSnapshot().working.pages[0].id;
        store.setScene(id, (scene) => ({
            ...scene,
            objects: scene.objects.map((o) =>
                o.id === 'source' ? { ...o, name: 'Bản được khôi phục' } : o,
            ),
        }));
    });
    await expect(name).toHaveValue('Bản được khôi phục');
    await page.waitForTimeout(250);
    expect((await snapshot(page)).scene.objects[0].name).toBe('Bản được khôi phục');
});

async function openWorkflow(page) {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto('/tests/browser/interaction.html');
    await expect(page.getByTestId('interaction-flow-canvas')).toBeVisible();
    await page.evaluate(() => {
        const scene = structuredClone(window.__interaction.scene);
        scene.interactions[0].actions = [
            {
                type: 'askQuestion',
                delayMsSchema: 0,
                question: {
                    questionId: 'input-question',
                    title: 'Câu hỏi ban đầu',
                    choices: [
                        { id: 'yes', text: 'Đúng' },
                        { id: 'no', text: 'Sai' },
                    ],
                    correctChoiceId: 'yes',
                },
            },
            { type: 'openUrl', url: 'https://example.com', delayMsSchema: 0 },
            { type: 'setState', key: 'note', operation: 'set', value: 'Ghi nhớ', delayMsSchema: 0 },
        ];
        delete scene.interactions[0].editorLayout;
        localStorage.setItem('interaction-ui-saved', JSON.stringify(scene));
    });
    await page.reload();
    await expect(page.locator('[data-workflow-step]')).toHaveCount(4);
}

test('workflow name, question, choice and URL flush before save/test, retaining spaces during pauses', async ({
    page,
}) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await openWorkflow(page);
    const name = page.getByRole('textbox', { name: 'Tên luồng tương tác', exact: true });
    await name.fill('Luồng ');
    await page.waitForTimeout(250);
    await expect(name).toHaveValue('Luồng ');
    await name.pressSequentially('mới', { delay: 5 });
    await page.locator('[data-workflow-step="action-0"] .workflow-drag').click();
    const question = page.getByRole('textbox', { name: 'Nội dung câu hỏi', exact: true });
    await question.fill('Rùa ');
    await page.waitForTimeout(250);
    await expect(question).toHaveValue('Rùa ');
    await question.pressSequentially('có thắng không?', { delay: 5 });
    await page.getByLabel('Đáp án 1', { exact: true }).fill('Rùa thắng');
    await page.getByRole('button', { name: 'Chạy thử', exact: true }).click();
    await page.getByRole('button', { name: 'Chạy', exact: true }).click();
    await expect(
        page.getByRole('heading', { name: 'Rùa có thắng không?', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rùa thắng', exact: true })).toBeVisible();
    await page
        .getByRole('dialog', { name: 'Câu hỏi tương tác', exact: true })
        .getByRole('button', { name: 'Đóng câu hỏi', exact: true })
        .click();
    await page.getByRole('button', { name: 'Đóng chạy thử', exact: true }).click();
    await page.locator('[data-workflow-step="action-1"] .workflow-drag').click();
    await page
        .getByLabel('Địa chỉ liên kết', { exact: true })
        .fill('https://example.com/new-target');
    // .click() exercises keyboard/programmatic activation without pointerdown.
    await page
        .getByRole('button', { name: 'Lưu sách', exact: true })
        .evaluate((button) => button.click());
    const saved = await page.evaluate(() =>
        JSON.parse(localStorage.getItem('interaction-ui-saved')),
    );
    expect(saved.interactions[0].name).toBe('Luồng mới');
    expect(saved.interactions[0].actions[0].question.title).toBe('Rùa có thắng không?');
    expect(saved.interactions[0].actions[0].question.choices[0].text).toBe('Rùa thắng');
    expect(saved.interactions[0].actions[1].url).toBe('https://example.com/new-target');
    expect(errors).toEqual([]);
});

test('Enter flushes a name, textarea Enter retains newlines and memory input remains batched', async ({
    page,
}) => {
    await openWorkflow(page);
    const name = page.getByRole('textbox', { name: 'Tên luồng tương tác', exact: true });
    await name.fill('Tên bằng Enter');
    await name.press('Enter');
    expect(await page.evaluate(() => window.__interaction.scene.interactions[0].name)).toBe(
        'Tên bằng Enter',
    );
    await page.locator('[data-workflow-step="action-0"] .workflow-drag').click();
    const question = page.getByRole('textbox', { name: 'Nội dung câu hỏi', exact: true });
    await question.fill('Dòng một');
    await question.press('End');
    await question.press('Enter');
    await question.pressSequentially('Dòng hai');
    await expect(question).toHaveValue('Dòng một\nDòng hai');
    await page.locator('[data-workflow-step="action-2"] .workflow-drag').click();
    const memory = page.getByRole('textbox', { name: 'Giá trị ghi nhớ', exact: true });
    const before = await page.evaluate(() => window.__interaction.updates);
    await memory.fill('');
    await memory.pressSequentially('Ghi nhớ tiếng Việt', { delay: 5 });
    await expect
        .poll(() =>
            page.evaluate(() => window.__interaction.scene.interactions[0].actions[2].value),
        )
        .toBe('Ghi nhớ tiếng Việt');
    expect((await page.evaluate(() => window.__interaction.updates)) - before).toBeLessThan(5);
});

test('page title flushes on Ctrl+S and Enter before settings/book saving', async ({ page }) => {
    await openEditor(page);
    await page.getByRole('button', { name: 'Thiết lập trang', exact: true }).click();
    const title = page.locator('#page-settings-name');
    await title.fill('Tên trang lưu bằng phím tắt');
    await title.press('Control+s');
    await expect.poll(async () => (await snapshot(page)).title).toBe('Tên trang lưu bằng phím tắt');
    await expect(
        page.getByRole('button', { name: 'Trạng thái lưu sách: Đã lưu sách', exact: true }),
    ).toBeVisible();
    await title.fill('Tên trang lưu bằng Enter');
    await title.press('Enter');
    await expect.poll(async () => (await snapshot(page)).title).toBe('Tên trang lưu bằng Enter');
});

test('clearing a question blocks an immediate save shortcut until the local flow is valid again', async ({
    page,
}) => {
    await openEditor(page);
    await page.getByRole('radio', { name: 'Tương tác', exact: true }).click();
    await page.getByRole('button', { name: /^Luồng hợp lệ Khi/ }).click();
    await page.locator('[data-workflow-step="action-1"] .workflow-drag').click();
    await page.evaluate(() => {
        const store = window.__editorPages.store;
        const original = store.save;
        window.__inputAudit.saveCalls = 0;
        store.save = function (...args) {
            window.__inputAudit.saveCalls++;
            return original.apply(this, args);
        };
    });
    const question = page.getByRole('textbox', { name: 'Nội dung câu hỏi', exact: true });
    await question.fill('');
    await question.press('Control+s');
    await expect(page.getByRole('button', { name: 'Lưu sách', exact: true })).toBeDisabled();
    expect(await page.evaluate(() => window.__inputAudit.saveCalls)).toBe(0);
    await question.fill('Câu hỏi hợp lệ sau sửa');
    await question.press('Control+s');
    await expect.poll(() => page.evaluate(() => window.__inputAudit.saveCalls)).toBe(1);
    expect(
        (await snapshot(page)).scene.interactions.find((r) => r.id === 'healthy-flow').actions[1]
            .question.title,
    ).toBe('Câu hỏi hợp lệ sau sửa');
});

test('pending text reaches unload guards and the real provider checkpoint before it reads the draft', async ({
    page,
}) => {
    await openEditor(page);
    await selectObject(page);
    const name = await objectName(page);
    await page.evaluate(() => {
        const store = window.__editorPages.store;
        const original = store.flush;
        window.__checkpointObserved = [];
        store.flush = function (...args) {
            const id = store.getSnapshot().working.pages[0].id;
            window.__checkpointObserved.push(store.getPage(id).scene.objects[0].name);
            return original.apply(this, args);
        };
    });
    await name.fill('Tên mới trước khi rời trang');
    const unloading = await page.evaluate(() => {
        const event = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(event);
        const store = window.__editorPages.store;
        return {
            prevented: event.defaultPrevented,
            name: store.getPage(store.getSnapshot().working.pages[0].id).scene.objects[0].name,
        };
    });
    expect(unloading).toEqual({ prevented: true, name: 'Tên mới trước khi rời trang' });
    for (const event of ['pagehide', 'visibilitychange']) {
        await name.fill(`Tên mới trước ${event}`);
        const observed = await page.evaluate((type) => {
            window.__checkpointObserved = [];
            if (type === 'visibilitychange') {
                Object.defineProperty(document, 'visibilityState', {
                    configurable: true,
                    value: 'hidden',
                });
                document.dispatchEvent(new Event(type));
                Object.defineProperty(document, 'visibilityState', {
                    configurable: true,
                    value: 'visible',
                });
            } else window.dispatchEvent(new Event(type));
            return window.__checkpointObserved[0];
        }, event);
        expect(observed).toBe(`Tên mới trước ${event}`);
    }
});
