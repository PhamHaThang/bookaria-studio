import { expect, test } from '@playwright/test';

function skinnedModel() {
    const positions = new Float32Array([-0.2, 0, 0, 0.2, 0, 0, 0, 0.5, 0]);
    const joints = new Uint16Array(12);
    const weights = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);
    const inverse = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    const data = Buffer.concat(
        [positions, joints, weights, inverse].map((array) => Buffer.from(array.buffer)),
    );
    return {
        asset: { version: '2.0' },
        scene: 0,
        scenes: [{ nodes: [0] }],
        nodes: [{ children: [1, 2] }, { mesh: 0, skin: 0 }, { name: 'Bone' }],
        skins: [{ joints: [2], inverseBindMatrices: 3 }],
        meshes: [
            {
                primitives: [
                    { attributes: { POSITION: 0, JOINTS_0: 1, WEIGHTS_0: 2 }, material: 0 },
                ],
            },
        ],
        materials: [
            { doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [0.2, 0.6, 0.9, 1] } },
        ],
        buffers: [
            {
                uri: `data:application/octet-stream;base64,${data.toString('base64')}`,
                byteLength: data.length,
            },
        ],
        bufferViews: [
            { buffer: 0, byteOffset: 0, byteLength: 36 },
            { buffer: 0, byteOffset: 36, byteLength: 24 },
            { buffer: 0, byteOffset: 60, byteLength: 48 },
            { buffer: 0, byteOffset: 108, byteLength: 64 },
        ],
        accessors: [
            {
                bufferView: 0,
                componentType: 5126,
                count: 3,
                type: 'VEC3',
                min: [-0.2, 0, 0],
                max: [0.2, 0.5, 0],
            },
            { bufferView: 1, componentType: 5123, count: 3, type: 'VEC4' },
            { bufferView: 2, componentType: 5126, count: 3, type: 'VEC4' },
            { bufferView: 3, componentType: 5126, count: 1, type: 'MAT4' },
        ],
    };
}

for (const theme of ['light', 'dark']) {
    test(`skinned model ${theme}: intermediate transform inputs do not crash the editor and valid edits still save`, async ({
        page,
    }) => {
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.addInitScript((value) => localStorage.setItem('bookaria.theme', value), theme);
        await page.route('**/skinned-transform.gltf', (route) =>
            route.fulfill({ json: skinnedModel() }),
        );
        await page.goto('/tests/browser/editor-pages.html?pages=1&transform=1');
        await expect(page.locator('.scene-editor')).toBeVisible();
        await page.getByRole('button', { name: /^Đối tượng \(/ }).click();
        await page.getByRole('button', { name: 'Chọn Mô hình có xương', exact: true }).click();
        const scale = page.locator('#object-skinned-scale-X');
        if (!(await scale.isVisible()))
            await page.getByRole('button', { name: 'Biến đổi', exact: true }).click();
        await expect(scale).toBeEnabled();
        const position = page.locator('#object-skinned-position-X');
        const rotation = page.locator('#object-skinned-rotation-Y');
        for (const [field, invalid, valid] of [
            [scale, '0', '0.1'],
            [scale, '-1', '0.2'],
            [scale, '', '0.3'],
            [position, '-', '25'],
            [rotation, '1e', '45'],
        ]) {
            await field.fill(invalid);
            await expect(field).toHaveAttribute('aria-invalid', 'true');
            await expect(
                page.getByRole('button', { name: 'Lưu sách', exact: true }),
            ).toBeDisabled();
            await page.evaluate(
                () =>
                    new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
            );
            await expect(page.locator('.scene-editor')).toBeVisible();
            await field.fill(valid);
            await expect(field).toHaveAttribute('aria-invalid', 'false');
        }
        const save = page.getByRole('button', { name: 'Lưu sách', exact: true });
        if (await save.isEnabled()) await save.click();
        await expect(
            page.getByRole('button', { name: 'Trạng thái lưu sách: Đã lưu sách', exact: true }),
        ).toBeVisible();
        const transform = await page.evaluate(() => {
            const store = window.__editorPages.store;
            return store.getPage(store.getSnapshot().working.pages[0].id).scene.objects[0]
                .transform;
        });
        expect(transform.scale[0]).toBe(0.3);
        expect(transform.position[0]).toBeCloseTo(25 / 210);
        expect(transform.rotation[1]).toBe(45);
        expect(errors).toEqual([]);
    });
}
