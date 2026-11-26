import { expect, test } from '@playwright/test';
import { SceneSchema } from '../../src/shared/contracts/scene.schema';

const rule = {
    id: 'ai-rule',
    name: 'Hiện thông tin',
    enabled: true,
    onRetrigger: 'ignore',
    trigger: { type: 'onTap', objectId: 'source' },
    actions: [
        { type: 'setVisible', objectId: 'target', value: true, durationMs: 0, delayMsSchema: 0 },
    ],
};
const result = (body, extra = {}) => ({
    data: {
        status: 'proposal',
        rule,
        revision: body.revision,
        usage: {
            model: 'mock-openai',
            promptVersion: 'bookaria-interactions-v1',
            attempts: 1,
            latencyMs: 15,
            inputTokens: 50,
            outputTokens: 20,
        },
        ...extra,
    },
});

for (const surface of ['interaction', 'design']) {
    for (const replyLength of ['short', 'long']) {
        test(`chat scroll follows long conversations and preserves reading position: ${surface}, ${replyLength}`, async ({
            page,
        }) => {
            await page.setViewportSize({ width: 1440, height: 900 });
            let turn = 0;
            let holdReply = false;
            let releaseReply;
            await page.route('**/pages/*/interaction-proposals', (route) => {
                turn++;
                const json = result(route.request().postDataJSON(), {
                    status: 'answer',
                    rule: undefined,
                    message: `Trả lời lượt ${turn}.\n\n${'Bạn có thể chọn đối tượng trên trang, chỉnh nội dung rồi chạy thử để kiểm tra kết quả trước khi áp dụng thay đổi.\n\n'.repeat(replyLength === 'long' ? 10 : 1)}Kết thúc lượt ${turn}.`,
                });
                if (holdReply) {
                    releaseReply = () => route.fulfill({ json });
                    return;
                }
                return route.fulfill({ json });
            });
            await open(page);
            if (surface === 'design')
                await page.getByRole('button', { name: 'Thiết kế', exact: true }).click();
            const input = page.getByLabel('Yêu cầu cho trợ lý');
            const send = page.getByRole('button', { name: 'Gửi tin nhắn', exact: true });
            const viewport = page.getByRole('region', { name: 'Lịch sử trao đổi' });
            const bottomDistance = () =>
                viewport.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop);
            const tailGap = () =>
                viewport.evaluate((el) => {
                    const last = Array.from(
                        el.querySelectorAll('[data-slot="message-scroller-item"]'),
                    ).at(-1);
                    const padding = Number.parseFloat(
                        getComputedStyle(el.querySelector('[data-slot="message-scroller-content"]'))
                            .paddingBottom,
                    );
                    return Math.abs(
                        el.getBoundingClientRect().bottom -
                            last.getBoundingClientRect().bottom -
                            padding,
                    );
                });
            for (let index = 1; index <= 12; index++) {
                await input.fill(`Giải thích cách chỉnh trang, lượt ${index}`);
                await send.click();
                await expect(viewport.locator('[data-slot="message-scroller-item"]')).toHaveCount(
                    index * 2,
                );
                await expect(viewport.getByRole('log')).toHaveAttribute('aria-busy', 'false');
            }
            await expect.poll(bottomDistance).toBeLessThan(3);
            await expect.poll(tailGap).toBeLessThan(3);

            holdReply = true;
            await input.fill('Giải thích thêm trong lúc tôi xem lại tin cũ');
            await send.click();
            await expect.poll(() => typeof releaseReply).toBe('function');
            await viewport.hover();
            await page.mouse.wheel(0, -1400);
            await expect.poll(bottomDistance).toBeGreaterThan(600);
            const reading = await viewport.evaluate(async (el) => {
                await new Promise(requestAnimationFrame);
                await new Promise(requestAnimationFrame);
                const top = el.getBoundingClientRect().top;
                const item = Array.from(
                    el.querySelectorAll('[data-slot="message-scroller-item"]'),
                ).find((item) => item.getBoundingClientRect().bottom > top + 30);
                return {
                    id: item.getAttribute('data-message-id'),
                    top: item.getBoundingClientRect().top - top,
                };
            });
            await releaseReply();
            await expect(viewport.getByRole('log')).toHaveAttribute('aria-busy', 'false');
            await expect(viewport.locator('[data-slot="message-scroller-item"]')).toHaveCount(26);
            await expect
                .poll(() =>
                    viewport.evaluate((el, reading) => {
                        const item = el.querySelector(`[data-message-id="${reading.id}"]`);
                        return Math.abs(
                            item.getBoundingClientRect().top -
                                el.getBoundingClientRect().top -
                                reading.top,
                        );
                    }, reading),
                )
                .toBeLessThan(3);
            const latest = page.getByRole('button', { name: 'Đến tin nhắn mới nhất', exact: true });
            await expect(latest).toHaveAttribute('data-active', 'true');
            await latest.click();
            await expect.poll(bottomDistance).toBeLessThan(3);
            await expect.poll(tailGap).toBeLessThan(3);
            await page.getByRole('button', { name: 'Thu gọn chat', exact: true }).click();
            await page.getByRole('button', { name: 'Trợ lý Boki', exact: true }).click();
            await expect.poll(bottomDistance).toBeLessThan(3);

            await viewport.hover();
            await page.mouse.wheel(0, -1400);
            await expect.poll(bottomDistance).toBeGreaterThan(600);
            holdReply = false;
            await input.fill('Câu hỏi mới sau khi xem lại lịch sử');
            await send.click();
            await expect(viewport.getByRole('log')).toHaveAttribute('aria-busy', 'false');
            await expect(viewport.locator('[data-slot="message-scroller-item"]')).toHaveCount(28);
            await expect.poll(bottomDistance).toBeLessThan(3);
            await expect.poll(tailGap).toBeLessThan(3);
        });
    }
}

test('library references can add an object while removal is confirmed and undone together', async ({
    page,
}, info) => {
    const asset = {
        id: '44444444-4444-4444-8444-444444444444',
        type: 'IMAGE',
        name: 'Ảnh Mặt trăng',
        url: new URL('/tests/browser/page.png', info.project.use.baseURL).href,
        thumbnailUrl: null,
        meta: {},
        status: 'READY',
        sizeBytes: 1000,
        format: 'png',
        tags: [],
        license: null,
        authorName: null,
        sourceUrl: null,
        scope: 'library',
        categoryId: null,
        createdAt: '2026-01-01T00:00:00.000Z',
    };
    let requested;
    await page.route(/\/assets(?:\?|$)/, (route) => {
        const scope = new URL(route.request().url()).searchParams.get('scope');
        return route.fulfill({
            json: {
                data: scope === 'library' ? [asset] : [],
                meta: {
                    page: 1,
                    limit: 20,
                    total: scope === 'library' ? 1 : 0,
                    totalPages: scope === 'library' ? 1 : 0,
                },
            },
        });
    });
    await page.route(`**/assets/${asset.id}`, (route) => route.fulfill({ json: { data: asset } }));
    await page.route('**/pages/*/interaction-proposals', (route) => {
        requested = route.request().postDataJSON();
        return route.fulfill({
            json: result(requested, {
                status: 'edit_plan',
                plan: {
                    rules: [],
                    variables: [],
                    objectAdds: [
                        {
                            id: 'added-picture',
                            type: 'image',
                            assetId: asset.id,
                            name: asset.name,
                            transform: {},
                        },
                    ],
                    removeObjectIds: ['target'],
                    removeRuleIds: ['test-rule'],
                },
            }),
        });
    });
    await open(page);
    await page.getByRole('button', { name: 'Thiết kế', exact: true }).click();
    await page.getByRole('button', { name: 'Thêm từ thư viện', exact: true }).click();
    const picker = page.getByRole('dialog', { name: 'Tham chiếu trên trang' });
    await picker.getByRole('combobox', { name: 'Tìm tài nguyên thư viện' }).fill('Mặt trăng');
    await picker.getByRole('option', { name: /Ảnh Mặt trăng/ }).click();
    const input = page.getByLabel('Yêu cầu cho trợ lý');
    await expect(input).toHaveValue('Thêm @Ảnh Mặt trăng vào giữa trang.');
    await input.press('End');
    await page.keyboard.insertText(' Xóa Thông tin và luồng Chạm để khám phá.');
    await page.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click();
    const card = page.getByRole('region', { name: 'Đề xuất chỉnh sửa' });
    await expect(card).toContainText('Ảnh Mặt trăng');
    await expect(card).toContainText('Chạm để khám phá');
    expect(requested.editor.assetIds).toEqual([asset.id]);
    expect(requested.instruction).toContain('"kind":"asset"');
    const scene = () => page.evaluate(() => window.__interaction.scene);
    const before = await scene();
    await card.getByRole('button', { name: 'Xem thử', exact: true }).click();
    const preview = page.getByRole('dialog', { name: 'Xem thử đề xuất' });
    await expect(
        preview.getByRole('status', { name: 'Đang xem trạng thái ban đầu của trang.' }),
    ).toBeVisible();
    await expect(preview.locator('canvas')).toBeVisible();
    await preview.getByRole('button', { name: 'Đặt lại góc nhìn', exact: true }).click();
    await preview.screenshot({ path: info.outputPath('assistant-layout-preview.png') });
    await preview.getByRole('button', { name: 'Đóng', exact: true }).click();
    const apply = card.getByRole('button', { name: 'Áp dụng thay đổi', exact: true });
    await apply.click();
    const confirm = page.getByRole('alertdialog', { name: 'Xác nhận xóa khỏi trang' });
    await expect(confirm).toBeVisible();
    await page.screenshot({ path: info.outputPath('assistant-removal.png') });
    await confirm.getByRole('button', { name: 'Quay lại' }).click();
    expect(await scene()).toEqual(before);
    await apply.click();
    await confirm.getByRole('button', { name: 'Xóa và áp dụng' }).click();
    await expect
        .poll(async () => (await scene()).objects.map(({ id }) => id))
        .toEqual(['source', 'added-picture']);
    expect((await scene()).interactions).toEqual([]);
    await page.getByTestId('scene-history-undo').click();
    await expect.poll(scene).toEqual(before);
});

async function open(page) {
    await page.goto('/tests/browser/interaction.html');
    await page.getByRole('button', { name: 'Trợ lý Boki', exact: true }).click();
    await page.getByLabel('Yêu cầu cho trợ lý').fill('Chạm Khủng long thì hiện Thông tin');
}

async function expectPickerAboveComposer(
    page,
    picker = page.getByRole('dialog', { name: 'Tham chiếu trên trang' }),
) {
    await expect(picker).toBeVisible();
    await expect
        .poll(async () => {
            const popup = await picker.boundingBox();
            const composer = await page
                .locator('[data-slot="input-group"]')
                .filter({ has: page.getByLabel('Yêu cầu cho trợ lý') })
                .boundingBox();
            return popup && composer && popup.y + popup.height <= composer.y - 6;
        })
        .toBe(true);
}

test('chat previews and applies newly created black text at the center of the page', async ({
    page,
}) => {
    const text = 'Hãy là chính mình';
    await page.route('**/pages/*/interaction-proposals', (route) => {
        const body = route.request().postDataJSON();
        expect(body.instruction).toBe(`Thêm chữ ${text} màu đen vào giữa trang`);
        expect(body.editor.selectedObjectId).toBeUndefined();
        expect(body.editor.selectedRuleId).toBeUndefined();
        return route.fulfill({
            json: result(body, {
                status: 'edit_plan',
                rule: undefined,
                plan: {
                    rules: [],
                    variables: [],
                    objectAdds: [
                        {
                            id: 'new-text',
                            type: 'text',
                            text,
                            style: { color: '#000000' },
                            transform: { position: [0, 0, 0] },
                        },
                    ],
                },
            }),
        });
    });
    await open(page);
    await page.getByLabel('Yêu cầu cho trợ lý').fill(`Thêm chữ ${text} màu đen vào giữa trang`);
    await page.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click();
    const proposal = page.getByRole('region', { name: 'Đề xuất chỉnh sửa' });
    await expect(proposal).toContainText(text);
    await expect(proposal).toContainText('Màu chữ #000000');
    await proposal.getByRole('button', { name: 'Xem thử', exact: true }).click();
    const preview = page.getByRole('dialog', { name: 'Xem thử đề xuất' });
    await expect(preview.locator('canvas')).toBeVisible();
    const added = () =>
        page.evaluate(() => window.__interaction.scene.objects.find(({ id }) => id === 'new-text'));
    expect(await added()).toBeUndefined();
    await preview.getByRole('button', { name: 'Đóng', exact: true }).click();
    await proposal.getByRole('button', { name: 'Áp dụng thay đổi', exact: true }).click();
    await expect
        .poll(added)
        .toMatchObject({ text, style: { color: '#000000' }, transform: { position: [0, 0, 0] } });
});

test('chat scope switches between the page and an explicit flow and blocks a proposal from the old scope', async ({
    page,
}) => {
    const requests = [];
    await page.route('**/pages/*/interaction-proposals', (route) => {
        const body = route.request().postDataJSON();
        requests.push(body);
        if (!body.editor.selectedRuleId) return route.fulfill({ json: result(body) });
        const target = body.scene.interactions.find(
            (entry) => entry.id === body.editor.selectedRuleId,
        );
        return route.fulfill({
            json: result(body, {
                status: 'edit_plan',
                rule: undefined,
                plan: {
                    variables: [],
                    rules: [
                        {
                            replaceId: target.id,
                            rule: {
                                ...target,
                                actions: [{ type: 'wait', ms: 2000 }],
                                workflow: undefined,
                                editorLayout: undefined,
                            },
                        },
                    ],
                },
            }),
        });
    });
    await open(page);
    const scope = page.getByRole('combobox', { name: 'Phạm vi trao đổi' });
    await expect(scope).toContainText('Trang hiện tại');
    await page.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click();
    const card = page.getByRole('region', { name: 'Đề xuất tương tác' });
    await expect(card).toBeVisible();
    expect(requests[0].editor.selectedRuleId).toBeUndefined();
    await scope.click();
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.getByRole('option', { name: 'Chạm để khám phá', exact: true }).click();
    await expect(card.getByRole('button', { name: 'Thêm vào trang' })).toBeDisabled();
    await page.getByLabel('Yêu cầu cho trợ lý').fill('Đổi thành chờ 2 giây');
    await page.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click();
    await expect(card.getByRole('button', { name: 'Cập nhật luồng' })).toBeEnabled();
    expect(requests[1].editor.selectedRuleId).toBe('test-rule');
    expect(requests[1].editor.currentPlan).toBeUndefined();
    await card.getByRole('button', { name: 'Cập nhật luồng' }).click();
    await expect
        .poll(() => page.evaluate(() => window.__interaction.scene.interactions.length))
        .toBe(1);
    await expect(scope).toContainText('Chạm để khám phá');
    await page.getByRole('button', { name: 'Thu gọn chat' }).click();
    await page.getByRole('button', { name: 'Trợ lý Boki', exact: true }).click();
    await expect(scope).toContainText('Chạm để khám phá');
    await scope.click();
    await page.getByRole('option', { name: 'Trang hiện tại', exact: true }).click();
    await expect(scope).toContainText('Trang hiện tại');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(scope).toBeVisible();
    await scope.click();
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.getByRole('option', { name: 'Chạm để khám phá', exact: true }).click();
    await expect(scope).toContainText('Chạm để khám phá');
});

test('reference picker opens after chat is reopened and explains an empty page', async ({
    page,
}) => {
    await open(page);
    const trigger = page.getByRole('button', { name: 'Chọn đối tượng hoặc âm thanh' });
    const picker = page.getByRole('dialog', { name: 'Tham chiếu trên trang' });
    await trigger.click();
    await expectPickerAboveComposer(page);
    await page.getByRole('combobox', { name: 'Tìm đối tượng hoặc âm thanh' }).press('Escape');
    await expect(picker).toHaveCount(0);
    await page.getByRole('button', { name: 'Thu gọn chat' }).click();
    await page.getByRole('button', { name: 'Trợ lý Boki', exact: true }).click();
    await trigger.click();
    await expectPickerAboveComposer(page);
    await page.getByRole('combobox', { name: 'Tìm đối tượng hoặc âm thanh' }).press('Escape');
    await page.evaluate(() => {
        const state = window.__interaction;
        state.replaceScene({ ...state.scene, objects: [], interactions: [] });
    });
    await trigger.click();
    await expectPickerAboveComposer(page);
    await expect(picker.getByRole('status')).toContainText('Trang chưa có đối tượng hoặc âm thanh');
});

test('proposal preview does not mutate the draft; explicit apply adds exactly once and survives save', async ({
    page,
}) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let calls = 0;
    await page.route('**/pages/*/interaction-proposals', (route) => {
        calls++;
        return route.fulfill({ json: result(route.request().postDataJSON()) });
    });
    await open(page);
    await page.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Đề xuất tương tác' })).toBeVisible();
    expect(await page.evaluate(() => window.__interaction.scene.interactions.length)).toBe(1);
    await page
        .getByRole('region', { name: 'Đề xuất tương tác' })
        .getByRole('button', { name: 'Chạy thử', exact: true })
        .click();
    await expect(page.getByRole('region', { name: 'Chạy thử tương tác' })).toBeVisible();
    expect(await page.evaluate(() => window.__interaction.scene.interactions.length)).toBe(1);
    await page.getByRole('dialog').getByRole('button', { name: 'Đóng', exact: true }).click();
    await page.getByRole('button', { name: 'Thêm vào trang' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect
        .poll(() => page.evaluate(() => window.__interaction.scene.interactions.length))
        .toBe(2);
    await page.getByRole('button', { name: 'Lưu sách', exact: true }).click();
    await page.reload();
    await expect
        .poll(() => page.evaluate(() => window.__interaction?.scene.interactions.length))
        .toBe(2);
    expect(calls).toBe(1);
    expect(errors).toEqual([]);
});
test('stale proposal is blocked when objects change while AI is running', async ({ page }) => {
    let held;
    await page.route('**/pages/*/interaction-proposals', (route) => {
        held = route;
    });
    await open(page);
    await page.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click();
    await expect.poll(() => Boolean(held)).toBe(true);
    await page.evaluate(() => {
        const state = window.__interaction;
        state.replaceScene({
            ...state.scene,
            objects: state.scene.objects.map((object) => ({
                ...object,
                name: `${object.name} mới`,
            })),
        });
    });
    await held.fulfill({ json: result(held.request().postDataJSON()) });
    await expect(
        page.getByText(
            'Trang hoặc tài nguyên đã thay đổi. Gửi yêu cầu tiếp để kiểm tra lại đề xuất.',
        ),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Thêm vào trang' })).toBeDisabled();
    expect(await page.evaluate(() => window.__interaction.scene.interactions.length)).toBe(1);
});
test('clarifications and API failure preserve the instruction, allow retry and never apply', async ({
    page,
}) => {
    let calls = 0;
    await page.route('**/pages/*/interaction-proposals', (route) => {
        calls++;
        return calls === 1
            ? route.fulfill({
                  status: 503,
                  json: {
                      error: {
                          code: 'AI_UNAVAILABLE',
                          message: 'Chưa cấu hình API key.',
                          requestId: 'test',
                      },
                  },
              })
            : route.fulfill({
                  json: result(route.request().postDataJSON(), {
                      status: 'needs_clarification',
                      rule: undefined,
                      message: 'Bạn muốn dùng thẻ nào?',
                  }),
              });
    });
    await open(page);
    await page.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click();
    await expect(page.getByText('Chưa cấu hình API key.')).toBeVisible();
    await expect(page.getByLabel('Yêu cầu cho trợ lý')).toHaveValue(
        'Chạm Khủng long thì hiện Thông tin',
    );
    await page.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click();
    await expect(page.getByText('Bạn muốn dùng thẻ nào?')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Thêm vào trang' })).toHaveCount(0);
    expect(calls).toBe(2);
});
test('closing cancels the request and a late result cannot reopen or mutate the editor', async ({
    page,
}) => {
    let held;
    await page.route('**/pages/*/interaction-proposals', (route) => {
        held = route;
    });
    await open(page);
    await page.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click();
    await expect.poll(() => Boolean(held)).toBe(true);
    await page.getByRole('button', { name: 'Thu gọn trợ lý AI', exact: true }).click();
    await held.fulfill({ json: result(held.request().postDataJSON()) }).catch(() => {});
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.evaluate(() => window.__interaction.scene.interactions.length)).toBe(1);
    await page.getByRole('button', { name: 'Trợ lý Boki', exact: true }).click();
    await expect(page.getByLabel('Yêu cầu cho trợ lý')).toHaveValue(
        'Chạm Khủng long thì hiện Thông tin',
    );
    await expect(page.getByRole('region', { name: 'Đề xuất tương tác' })).toHaveCount(0);
});
test('AI dialog fits a narrow viewport and supports keyboard dismissal', async ({ page }) => {
    await open(page);
    await page.setViewportSize({ width: 390, height: 844 });
    const dialog = page.getByRole('dialog', { name: 'Trợ lý Boki' });
    await expect(dialog).toBeVisible();
    const bounds = await dialog.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    await dialog.getByRole('button', { name: 'Chọn đối tượng hoặc âm thanh' }).click();
    await expectPickerAboveComposer(page);
    const picker = page.getByRole('dialog', { name: 'Tham chiếu trên trang' });
    await picker.getByRole('option', { name: /Thông tin/ }).click();
    const composer = dialog.getByLabel('Yêu cầu cho trợ lý');
    await expect(composer).toHaveValue(/@Thông tin/);
    await expect(composer).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
});

test('object-only AI edits keep loop resets and toolbar Undo in sync without changing chat scope', async ({
    page,
}) => {
    let calls = 0;
    await page.route('**/pages/*/interaction-proposals', (route) =>
        route.fulfill({
            json: result(
                route.request().postDataJSON(),
                ++calls === 1
                    ? {
                          status: 'edit_plan',
                          rule: undefined,
                          plan: {
                              rules: [],
                              variables: [],
                              objectEdits: [
                                  { objectId: 'target', transform: { position: [0.2, 0, 0] } },
                              ],
                          },
                      }
                    : {},
            ),
        }),
    );
    await open(page);
    const seeded = await page.evaluate(() => {
        const { scene } = window.__interaction;
        return {
            ...scene,
            interactions: [
                {
                    id: 'loop',
                    name: 'Chuyển động lặp',
                    enabled: true,
                    onRetrigger: 'ignore',
                    trigger: { type: 'onPageEnter' },
                    actions: [
                        {
                            type: 'transformTo',
                            objectId: 'target',
                            position: [0.5, 0, 0],
                            durationMs: 500,
                            delayMsSchema: 0,
                            easing: 'linear',
                        },
                    ],
                    editorLayout: [
                        { id: 'start', x: 40, y: 80 },
                        { id: 'out', x: 340, y: 80 },
                    ],
                    workflow: {
                        version: 1,
                        edges: [{ source: 'start', target: 'out', port: 'next' }],
                    },
                    movementLoop: {
                        startId: 'out',
                        endId: 'out',
                        pauseMs: 0,
                        initial: scene.objects.find(({ id }) => id === 'target').transform,
                    },
                },
            ],
        };
    });
    const original = SceneSchema.parse(seeded);
    await page.evaluate((scene) => window.__interaction.replaceScene(scene), original);
    const snapshot = () => page.evaluate(() => window.__interaction.scene);
    await page.getByLabel('Yêu cầu cho trợ lý').fill('Đưa Thông tin sang vị trí X bằng 0,2');
    await page.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click();
    const card = page.getByRole('region', { name: 'Đề xuất chỉnh sửa' });
    await card.getByRole('button', { name: 'Áp dụng thay đổi' }).click();
    await expect
        .poll(
            async () =>
                (await snapshot()).objects.find(({ id }) => id === 'target').transform.position,
        )
        .toEqual([0.2, 0, 0]);
    const applied = await snapshot();
    expect(applied.interactions[0].movementLoop.initial.position).toEqual([0.2, 0, 0]);
    await expect(page.getByRole('combobox', { name: 'Phạm vi trao đổi' })).toContainText(
        'Trang hiện tại',
    );
    await page.getByTestId('scene-history-undo').click();
    await expect.poll(snapshot).toEqual(original);
    await expect(card.getByText('Đã hoàn tác', { exact: true })).toBeVisible();
    await page.getByTestId('scene-history-redo').click();
    await expect.poll(snapshot).toEqual(applied);
    await expect(card.getByText('Đã áp dụng vào bản nháp', { exact: true })).toBeVisible();
    await page
        .getByLabel('Yêu cầu cho trợ lý')
        .fill('Thêm luồng mới: chạm Khủng long thì hiện Thông tin');
    await page.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click();
    await page.getByRole('button', { name: 'Thêm vào trang', exact: true }).click();
    await expect.poll(async () => (await snapshot()).interactions.length).toBe(2);
    expect((await snapshot()).interactions.find(({ id }) => id === 'loop')).toEqual(
        applied.interactions[0],
    );
});

test('guidance keeps a pending proposal usable and its status follows toolbar Undo and Redo', async ({
    page,
}) => {
    let calls = 0;
    await page.route('**/pages/*/interaction-proposals', (route) => {
        const body = route.request().postDataJSON();
        calls++;
        return route.fulfill({
            json: result(
                body,
                calls === 1
                    ? {
                          status: 'edit_plan',
                          rule: undefined,
                          plan: { rules: [{ rule }], variables: [] },
                      }
                    : {
                          status: 'answer',
                          rule: undefined,
                          message:
                              'Bấm Xem thử để kiểm tra đề xuất. Sau khi áp dụng, dùng Undo trên thanh công cụ để lùi thay đổi gần nhất.',
                      },
            ),
        });
    });
    await open(page);
    const original = await page.evaluate(() => structuredClone(window.__interaction.scene));
    const input = page.getByLabel('Yêu cầu cho trợ lý');
    const send = page.getByRole('button', { name: 'Gửi tin nhắn', exact: true });
    const card = page.getByRole('region', { name: 'Đề xuất tương tác' });
    await send.click();
    await expect(card.getByRole('button', { name: 'Thêm vào trang' })).toBeEnabled();
    await input.fill('Giải thích đề xuất này và cách hoàn tác');
    await send.click();
    await expect(page.getByText(/^Bấm Xem thử để kiểm tra đề xuất\./)).toBeVisible();
    expect(await page.evaluate(() => window.__interaction.scene)).toEqual(original);
    await expect(card.getByRole('button', { name: 'Chạy thử', exact: true })).toBeEnabled();
    await card.getByRole('button', { name: 'Thêm vào trang' }).click();
    await expect(card.getByText('Đã áp dụng vào bản nháp', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hoàn tác lần áp dụng' })).toHaveCount(0);
    await expect(card.getByRole('button', { name: 'Thêm vào trang' })).toHaveCount(0);
    await page.getByTestId('scene-history-undo').click();
    await expect(card.getByText('Đã hoàn tác', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => window.__interaction.scene)).toEqual(original);
    await page.getByTestId('scene-history-redo').click();
    await expect(card.getByText('Đã áp dụng vào bản nháp', { exact: true })).toBeVisible();
    expect(calls).toBe(2);
});

test('chat retains clarification context, edits the applied rule and safely undoes an update', async ({
    page,
}) => {
    const requests = [];
    await page.route('**/pages/*/interaction-proposals', (route) => {
        const body = route.request().postDataJSON();
        requests.push(body);
        return route.fulfill({
            json: result(
                body,
                requests.length === 1
                    ? {
                          status: 'needs_clarification',
                          rule: undefined,
                          message: 'Bạn muốn dùng thẻ nào?',
                          choices: ['Thông tin', 'Thẻ khác'],
                      }
                    : {
                          rule:
                              requests.length === 2
                                  ? rule
                                  : {
                                        ...rule,
                                        id: 'ai-update',
                                        actions: [
                                            ...rule.actions,
                                            { type: 'wait', ms: 5000, delayMsSchema: 0 },
                                        ],
                                    },
                      },
            ),
        });
    });
    await open(page);
    await page.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click();
    await page.getByRole('button', { name: 'Thông tin', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Thêm vào trang' })).toBeEnabled();
    expect(requests[1].history).toHaveLength(2);
    expect(requests[1].history[1].content).toBe('Bạn muốn dùng thẻ nào?');
    await page.getByRole('button', { name: 'Thêm vào trang' }).click();
    await expect(page.getByText('Đã áp dụng vào bản nháp')).toBeVisible();
    await page.getByRole('button', { name: 'Thu gọn chat' }).click();
    await page.getByRole('button', { name: 'Trợ lý Boki' }).click();
    await expect(page.getByText('Đã áp dụng vào bản nháp')).toBeVisible();
    await page.getByLabel('Yêu cầu cho trợ lý').fill('Thêm chờ 5 giây');
    await page.getByRole('button', { name: 'Gửi tin nhắn' }).click();
    await page.getByRole('button', { name: 'Cập nhật luồng' }).click();
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.__interaction.scene.interactions.find((entry) => entry.id === 'ai-rule')
                        ?.actions.length,
            ),
        )
        .toBe(2);
    expect(requests[2].currentProposal.actions).toEqual(rule.actions);
    expect(await page.evaluate(() => window.__interaction.scene.interactions.length)).toBe(2);
    await page.getByTestId('scene-history-undo').click();
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    window.__interaction.scene.interactions.find((entry) => entry.id === 'ai-rule')
                        ?.actions.length,
            ),
        )
        .toBe(1);
    expect(await page.evaluate(() => window.__interaction.scene.interactions.length)).toBe(2);
});

test('editor plans follow the applied rule after a manual edit and default to testing that rule', async ({
    page,
}) => {
    const requests = [];
    await page.route('**/pages/*/interaction-proposals', (route) => {
        const body = route.request().postDataJSON();
        requests.push(body);
        const target = body.scene.interactions.find(({ id }) => id === body.editor.selectedRuleId);
        return route.fulfill({
            json: result(body, {
                status: 'edit_plan',
                rule: undefined,
                plan: {
                    variables: [],
                    rules: [
                        target
                            ? {
                                  replaceId: target.id,
                                  rule: {
                                      ...target,
                                      workflow: undefined,
                                      editorLayout: undefined,
                                      actions: [...target.actions, { type: 'wait', ms: 5000 }],
                                  },
                              }
                            : { rule },
                    ],
                },
            }),
        });
    });
    await open(page);
    const send = page.getByRole('button', { name: 'Gửi tin nhắn', exact: true });
    const scope = page.getByRole('combobox', { name: 'Phạm vi trao đổi' });
    await send.click();
    await page.getByRole('button', { name: 'Thêm vào trang', exact: true }).click();
    await expect(scope).toContainText(rule.name);
    await page.evaluate(() => {
        const scene = window.__interaction.scene;
        window.__interaction.replaceScene({
            ...scene,
            interactions: scene.interactions.map((item) =>
                item.id === 'ai-rule' ? { ...item, name: 'Tên sửa tay' } : item,
            ),
        });
    });
    await expect(scope).toContainText('Tên sửa tay');
    await page.getByLabel('Yêu cầu cho trợ lý').fill('Thêm bước chờ 5 giây');
    await send.click();
    const card = page.getByRole('region', { name: 'Đề xuất tương tác' });
    await expect(card).toContainText('Thay đổi · Các bước');
    expect(requests[1].editor.selectedRuleId).toBe('ai-rule');
    const current = () =>
        page.evaluate(() =>
            window.__interaction.scene.interactions.map(({ id, name, actions }) => ({
                id,
                name,
                steps: actions.length,
            })),
        );
    const before = await current();
    await card.getByRole('button', { name: 'Chạy thử', exact: true }).click();
    const preview = page.getByRole('dialog', { name: 'Chạy thử đề xuất' });
    await expect(
        preview.getByRole('button', { name: 'Thử riêng luồng', pressed: true }),
    ).toBeVisible();
    await preview.getByRole('button', { name: 'Thử cả trang', exact: true }).click();
    await expect(
        preview.getByRole('button', { name: 'Thử cả trang', pressed: true }),
    ).toBeVisible();
    await expect(preview.getByRole('combobox', { name: 'Đối tượng chạm khi thử' })).toBeVisible();
    expect(await current()).toEqual(before);
    await preview.getByRole('button', { name: 'Đóng', exact: true }).click();
    await card.getByRole('button', { name: 'Cập nhật luồng', exact: true }).click();
    await expect
        .poll(current)
        .toEqual(before.map((item) => (item.id === 'ai-rule' ? { ...item, steps: 2 } : item)));
    await page.getByTestId('scene-history-undo').click();
    await expect.poll(current).toEqual(before);
});

test('mentions insert at the caret and send only the IDs still referenced in the message', async ({
    page,
}) => {
    let body;
    await page.route('**/pages/*/interaction-proposals', (route) => {
        body = route.request().postDataJSON();
        return route.fulfill({ json: result(body) });
    });
    await open(page);
    const composer = page.getByLabel('Yêu cầu cho trợ lý');
    await composer.fill('Hiện  khi chạm');
    await composer.evaluate((input) => input.setSelectionRange(5, 5));
    await composer.press('@');
    const search = page.getByRole('combobox', { name: 'Tìm đối tượng hoặc âm thanh' });
    await search.fill('thong tin');
    await search.press('Enter');
    await expect(composer).toBeFocused();
    await expect(composer).toHaveValue('Hiện @Thông tin khi chạm');
    expect(await composer.evaluate((input) => input.selectionStart)).toBe(
        'Hiện @Thông tin '.length,
    );
    await composer.press('End');
    await page.getByRole('button', { name: 'Chọn đối tượng hoặc âm thanh' }).click();
    await search.fill('khung long');
    await search.press('Enter');
    await expect(composer).toBeFocused();
    await expect(composer).toHaveValue('Hiện @Thông tin khi chạm @Khủng long ');
    await composer.fill('Hiện @Thông tin khi chạm');
    await composer.press('Enter');
    await expect(page.getByRole('region', { name: 'Đề xuất tương tác' })).toBeVisible();
    expect(body.instruction).toContain('"id":"target"');
    expect(body.instruction).not.toContain('"id":"source"');
    await expect(
        page.getByLabel('Lịch sử trao đổi').getByText('Hiện @Thông tin khi chạm'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Cuộc trao đổi mới' }).click();
    await expect(page.getByRole('region', { name: 'Đề xuất tương tác' })).toHaveCount(0);
    await expect(page.getByLabel('Yêu cầu cho trợ lý')).toHaveValue('');
});

test('starter prompts remain editable and closing chat returns keyboard focus', async ({
    page,
}) => {
    let calls = 0;
    await page.route('**/pages/*/interaction-proposals', (route) => {
        calls++;
        return route.fulfill({ json: result(route.request().postDataJSON()) });
    });
    await page.goto('/tests/browser/interaction.html');
    const launcher = page.getByRole('button', { name: 'Trợ lý Boki', exact: true });
    const canvas = await page.getByRole('application').boundingBox();
    await launcher.click();
    const panel = page.getByRole('complementary', { name: 'Trợ lý Boki' });
    const compact = await panel.boundingBox();
    const toggle = page.getByRole('button', { name: 'Thu gọn trợ lý AI', exact: true });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const toggleBounds = await toggle.boundingBox();
    expect(compact.y + compact.height).toBeLessThanOrEqual(toggleBounds.y - 8);
    expect(compact.x + compact.width).toBe(toggleBounds.x + toggleBounds.width);
    expect((await page.getByRole('application').boundingBox()).width).toBeGreaterThanOrEqual(
        canvas.width,
    );
    await page.getByRole('button', { name: 'Mở rộng chat' }).click();
    await expect.poll(async () => (await panel.boundingBox()).width).toBeGreaterThan(compact.width);
    await page.getByRole('button', { name: 'Thu nhỏ chat' }).click();
    await expect.poll(async () => (await panel.boundingBox()).width).toBe(compact.width);
    await page.getByRole('button', { name: 'Tạo câu hỏi có điểm', exact: true }).click();
    const composer = page.getByLabel('Yêu cầu cho trợ lý');
    await expect(composer).toBeFocused();
    await expect(composer).toHaveValue(/cộng 1 điểm/);
    await composer.press('End');
    await composer.press('Shift+Enter');
    await expect(composer).toHaveValue(/\n/);
    expect(calls).toBe(0);
    await composer.press('Escape');
    await expect(launcher).toBeFocused();
});

test('reference search supports arrow keys, empty results and clearing the search', async ({
    page,
}) => {
    await open(page);
    await page.getByRole('button', { name: 'Chọn đối tượng hoặc âm thanh' }).click();
    const picker = page.getByRole('dialog', { name: 'Tham chiếu trên trang' });
    const search = picker.getByRole('combobox', { name: 'Tìm đối tượng hoặc âm thanh' });
    await expect(search).toBeFocused();
    await expect(picker.getByRole('option', { name: /Khủng long/ })).toHaveAttribute(
        'aria-selected',
        'true',
    );
    await search.press('ArrowDown');
    await expect(picker.getByRole('option', { name: /Thông tin/ })).toHaveAttribute(
        'aria-selected',
        'true',
    );
    await search.press('Enter');
    const composer = page.getByLabel('Yêu cầu cho trợ lý');
    await expect(composer).toBeFocused();
    await expect(composer).toHaveValue(/@Thông tin/);
    await page.getByRole('button', { name: 'Chọn đối tượng hoặc âm thanh' }).click();
    await search.fill('khongco123');
    await expect(picker.getByRole('status')).toContainText('Không tìm thấy kết quả');
    await search.press('Enter');
    await expect(picker).toBeVisible();
    await picker.getByRole('button', { name: 'Xóa tìm kiếm' }).click();
    await expect(search).toBeFocused();
    await expect(picker.getByRole('option')).toHaveCount(2);
    await picker.getByRole('button', { name: 'Đóng chọn tham chiếu' }).click();
    await expect(composer).toBeFocused();
});

test('clicking an inline highlight replaces the reference at that position', async ({ page }) => {
    let body;
    await page.route('**/pages/*/interaction-proposals', (route) => {
        body = route.request().postDataJSON();
        return route.fulfill({ json: result(body) });
    });
    await open(page);
    const composer = page.getByLabel('Yêu cầu cho trợ lý');
    await composer.fill('Chạm @');
    const picker = page.getByRole('dialog', { name: 'Tham chiếu trên trang' });
    await expectPickerAboveComposer(page);
    await picker.getByRole('option', { name: /Thông tin/ }).click();
    await expect(composer).toBeFocused();
    await composer.pressSequentially('để mở thẻ');
    const highlight = page.locator('mark').filter({ hasText: '@Thông tin' });
    await expect(highlight).toBeVisible();
    const bounds = await highlight.boundingBox();
    await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await expect(picker).toBeVisible();
    await expect(picker.getByRole('heading', { name: 'Đổi tham chiếu' })).toBeVisible();
    await expect(picker.getByRole('option', { name: /Thông tin/ })).toContainText('Đang chọn');
    await expectPickerAboveComposer(page);
    await picker.getByRole('option', { name: /Khủng long/ }).click();
    await expect(composer).toHaveValue('Chạm @Khủng long để mở thẻ');
    await expect(composer).toBeFocused();
    await composer.press('Enter');
    await expect(page.getByRole('region', { name: 'Đề xuất tương tác' })).toBeVisible();
    expect(body.instruction).toContain('"id":"source"');
    expect(body.instruction).not.toContain('"id":"target"');
});

test('a grouped AI plan previews quiz branches and applies or undoes rules and score together', async ({
    page,
}) => {
    const actions = [
        {
            type: 'askQuestion',
            question: {
                questionId: 'ai-quiz',
                title: 'Rùa biển sống ở đâu?',
                choices: [
                    { id: 'yes', text: 'Biển' },
                    { id: 'no', text: 'Mặt Trăng' },
                ],
                correctChoiceId: 'yes',
            },
        },
        { type: 'condition', test: { type: 'answer', questionId: 'ai-quiz', result: 'correct' } },
        { type: 'setState', key: 'ai_score', operation: 'increment', value: 1 },
        { type: 'navigate', navigation: { target: 'end' } },
        { type: 'setVisible', objectId: 'target', value: true },
    ];
    const quiz = {
        ...rule,
        id: 'ai-quiz-rule',
        name: 'Câu hỏi Rùa',
        trigger: { type: 'onPageEnter' },
        actions,
        editorLayout: ['start', 'q', 'check', 'score', 'next', 'hint'].map((id, index) => ({
            id,
            x: index * 300,
            y: 80,
        })),
        workflow: {
            version: 1,
            edges: [
                { source: 'start', target: 'q' },
                { source: 'q', target: 'check' },
                { source: 'check', target: 'score', port: 'true' },
                { source: 'score', target: 'next' },
                { source: 'check', target: 'hint', port: 'false' },
            ],
        },
    };
    await page.route('**/pages/*/interaction-proposals', (route) => {
        const body = route.request().postDataJSON();
        expect(body.editor.variables).toBeDefined();
        return route.fulfill({
            json: result(body, {
                status: 'edit_plan',
                rule: undefined,
                plan: {
                    rules: [{ rule: quiz }, { rule }],
                    variables: [
                        { key: 'ai_score', name: 'Điểm thử', type: 'number', initialValue: 0 },
                    ],
                },
            }),
        });
    });
    await open(page);
    await page.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click();
    const card = page.getByRole('region', { name: 'Đề xuất tương tác' });
    await expect(card.getByText('2 luồng', { exact: true })).toBeVisible();
    await expect(card.getByText('Đúng → bước 3 · Sai → bước 5')).toBeVisible();
    await card.getByRole('button', { name: 'Chạy thử', exact: true }).click();
    const question = page.getByRole('dialog', { name: 'Câu hỏi tương tác', exact: true });
    await question.getByRole('button', { name: 'Biển', exact: true }).click();
    await expect(question.getByRole('status')).toContainText('Bạn đã trả lời đúng.');
    await question.getByRole('button', { name: 'Đóng', exact: true }).click();
    const preview = page.getByRole('dialog', { name: 'Chạy thử đề xuất' });
    await expect(preview.getByText(/Đích của nhánh: kết thúc trải nghiệm/)).toBeVisible();
    await preview.getByRole('button', { name: 'Chi tiết chạy thử' }).click();
    const memory = page.getByRole('region', { name: 'Thông tin ghi nhớ' });
    const closeDetails = page.getByRole('button', { name: 'Đóng chi tiết chạy thử' });
    await expect(memory.getByText('0 → 1')).toBeVisible();
    await closeDetails.click();
    await preview.getByRole('button', { name: 'Đóng', exact: true }).click();
    await card.getByRole('button', { name: 'Chạy thử', exact: true }).click();
    await question.getByRole('button', { name: 'Mặt Trăng', exact: true }).click();
    await expect(question.getByRole('status')).toContainText('Bạn đã trả lời sai.');
    await question.getByRole('button', { name: 'Đóng', exact: true }).click();
    await preview.getByRole('button', { name: 'Chi tiết chạy thử' }).click();
    const trace = page.getByRole('list', { name: 'Nhật ký chạy thử' });
    await expect(trace.getByText(/đã xong · nhánh Sai/)).toBeVisible();
    await expect(trace.getByRole('listitem').filter({ hasText: 'đã xong' })).toHaveCount(3);
    await expect(memory.getByText('0 → 0')).toBeVisible();
    await expect(preview.getByText(/Đích của nhánh: kết thúc trải nghiệm/)).toHaveCount(0);
    expect(await page.evaluate(() => window.__interaction.scene.interactions.length)).toBe(1);
    await closeDetails.click();
    await preview.getByRole('button', { name: 'Đóng', exact: true }).click();
    await card.getByRole('button', { name: 'Áp dụng thay đổi' }).click();
    await expect
        .poll(() =>
            page.evaluate(() => ({
                count: window.__interaction.scene.interactions.length,
                score: window.__interaction.workflowVariables.find(
                    (item) => item.key === 'ai_score',
                )?.initialValue,
            })),
        )
        .toEqual({ count: 3, score: 0 });
    await page.getByTestId('scene-history-undo').click();
    await expect
        .poll(() =>
            page.evaluate(() => ({
                count: window.__interaction.scene.interactions.length,
                hasScore: window.__interaction.workflowVariables.some(
                    (item) => item.key === 'ai_score',
                ),
            })),
        )
        .toEqual({ count: 1, hasScore: false });
});

test('chat previews draft layout separately from runtime and applies or undoes both together', async ({
    page,
}) => {
    const requests = [];
    await page.route('**/pages/*/interaction-proposals', (route) => {
        const body = route.request().postDataJSON();
        requests.push(body);
        return route.fulfill({
            json: result(body, {
                status: 'edit_plan',
                rule: undefined,
                plan: {
                    variables: [],
                    rules: body.editor.selectedObjectId ? [] : [{ rule }],
                    objectEdits: [
                        {
                            objectId: 'target',
                            text: 'Môi trường sống',
                            style: { color: '#ff0000' },
                            transform: { scale: [0.8, 0.8, 0.8] },
                        },
                    ],
                },
            }),
        });
    });
    await open(page);
    const input = page.getByLabel('Yêu cầu cho trợ lý');
    const send = page.getByRole('button', { name: 'Gửi tin nhắn', exact: true });
    await page.getByRole('button', { name: 'Chỉnh bố cục', exact: true }).click();
    const picker = page.getByRole('dialog', { name: 'Tham chiếu trên trang' });
    await picker.getByRole('option', { name: /Thông tin/ }).click();
    await expect(input).toHaveValue('Thu nhỏ @Thông tin khoảng 20%, giữ nguyên vị trí.');
    await input.fill(
        'Đổi chữ của Thông tin thành màu đỏ, thu nhỏ 20% rồi cho hiện khi chạm Khủng long',
    );
    await send.click();
    const card = page.getByRole('region', { name: 'Đề xuất chỉnh sửa' });
    const state = () =>
        page.evaluate(() => {
            const { objects, interactions } = window.__interaction.scene;
            const target = objects.find((object) => object.id === 'target');
            return {
                text: target.text,
                style: target.style,
                transform: target.transform,
                count: interactions.length,
            };
        });
    const original = await state();
    await expect(card).toContainText('Thông tin thử nghiệm');
    await expect(card).toContainText('Môi trường sống');
    await expect(card).toContainText('#ff0000');
    await card.getByRole('button', { name: 'Xem thử' }).click();
    const preview = page.getByRole('dialog', { name: 'Xem thử đề xuất' });
    await expect(
        preview.getByRole('status', { name: 'Đang xem trạng thái ban đầu của trang.' }),
    ).toContainText('trạng thái ban đầu');
    await preview.getByRole('button', { name: 'Chạy tương tác' }).click();
    await expect(preview.getByRole('button', { name: 'Chạm thử' })).toBeEnabled();
    await preview.getByRole('button', { name: 'Chạm thử' }).click();
    await preview.getByRole('button', { name: 'Chi tiết chạy thử' }).click();
    await expect(
        page
            .getByRole('list', { name: 'Nhật ký chạy thử' })
            .getByText(/đã xong/)
            .first(),
    ).toBeVisible();
    expect(await state()).toEqual(original);
    await page.getByRole('button', { name: 'Đóng chi tiết chạy thử' }).click();
    await preview.getByRole('button', { name: 'Đóng', exact: true }).click();
    await card.getByRole('button', { name: 'Áp dụng thay đổi' }).click();
    const edited = {
        text: 'Môi trường sống',
        style: { ...original.style, color: '#ff0000' },
        transform: { ...original.transform, scale: [0.8, 0.8, 0.8] },
        count: original.count + 1,
    };
    await expect.poll(state).toEqual(edited);
    await page.getByTestId('scene-history-undo').click();
    await expect.poll(state).toEqual(original);

    await page.getByRole('combobox', { name: 'Phạm vi trao đổi' }).click();
    await page.getByRole('option', { name: 'Thông tin', exact: true }).click();
    await input.fill('Chỉnh chữ và kích thước đối tượng đã chọn');
    await send.click();
    await expect(card).toContainText('1 đối tượng');
    expect(requests[1].editor.selectedObjectId).toBe('target');
    await card.getByRole('button', { name: 'Áp dụng thay đổi' }).click();
    await expect.poll(state).toEqual({ ...edited, count: original.count });
});
