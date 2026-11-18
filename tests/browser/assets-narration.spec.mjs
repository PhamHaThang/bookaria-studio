import { expect, test } from '@playwright/test';

async function open(page, query = '', theme = 'light') {
    await page.addInitScript((value) => localStorage.setItem('bookaria.theme', value), theme);
    await page.goto(`/tests/browser/assets-narration.html?${query}`);
    await expect(
        page.getByRole('heading', { name: 'Tài nguyên của tôi', exact: true }),
    ).toBeVisible();
}
const dialogFor = (page) =>
    page.getByRole('dialog', { name: 'Tạo âm thanh từ văn bản', exact: true });
const writes = (page, path) =>
    page.evaluate(
        (value) => window.__narration.writes.filter((call) => call.url.endsWith(value)).length,
        path,
    );

for (const [width, height] of [
    [1366, 768],
    [390, 844],
]) {
    test(`speech settings ${width}: sent, invalidate the preview and reset on close`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height });
        await open(page);
        await page.getByRole('button', { name: 'Tạo âm thanh', exact: true }).click();
        const dialog = dialogFor(page);
        await expect(dialog.getByLabel('Giọng đọc', { exact: true })).toHaveText('Mai Chi');
        const choose = async (label, option) => {
            if (label === 'Tốc độ đọc' || label === 'Khoảng nghỉ') {
                const slider = dialog.getByRole('slider', { name: label, exact: true });
                await slider.press(option === 'Dài' ? 'End' : 'Home');
                const steps = option === '1× · Bình thường' ? 2 : option === 'Vừa' ? 1 : 0;
                for (let step = 0; step < steps; step++) await slider.press('ArrowRight');
            } else {
                await dialog
                    .getByRole('radiogroup', { name: label, exact: true })
                    .getByRole('radio', { name: option, exact: true })
                    .click();
            }
        };
        await dialog.getByLabel('Nội dung lời đọc').fill('Xin chào.\nChào mừng đến với Bookaria.');
        if (width > 640) {
            const speed = dialog.getByRole('slider', { name: 'Tốc độ đọc', exact: true });
            const thumb = await speed.boundingBox();
            const track = await dialog
                .locator('[data-slot="slider"]')
                .filter({ has: page.getByRole('slider', { name: 'Tốc độ đọc', exact: true }) })
                .boundingBox();
            await page.mouse.move(thumb.x + thumb.width / 2, thumb.y + thumb.height / 2);
            await page.mouse.down();
            await page.mouse.move(track.x + track.width - 2, thumb.y + thumb.height / 2, {
                steps: 8,
            });
            await page.mouse.up();
            await expect(speed).toHaveAttribute('aria-valuenow', '1.2');
        }
        await choose('Tốc độ đọc', '0,8× · Chậm');
        await choose('Khoảng nghỉ', 'Dài');
        const advanced = dialog.getByRole('region', { name: 'Tùy chỉnh nâng cao', exact: true });
        await expect(
            advanced.getByRole('heading', { name: 'Tùy chỉnh nâng cao', exact: true }),
        ).toBeVisible();
        await expect(
            dialog.getByRole('button', { name: 'Tùy chỉnh nâng cao', exact: true }),
        ).toHaveCount(0);
        await expect(
            dialog
                .getByRole('region', { name: 'Bản nghe thử', exact: true })
                .getByRole('radiogroup'),
        ).toHaveCount(0);
        await choose('Mức biến thiên', 'Ít');
        await choose('Độ bám giọng', 'Tăng nhẹ');
        await dialog.getByLabel('Độ bám giọng', { exact: true }).scrollIntoViewIfNeeded();
        await expect(
            dialog.getByRole('button', { name: 'Tạo lời đọc', exact: true }),
        ).toBeInViewport();
        expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
        if (width > 640) {
            expect(
                await dialog
                    .locator(':scope > .grid')
                    .evaluate((node) => node.scrollHeight <= node.clientHeight + 1),
            ).toBe(true);
            await expect(dialog.getByLabel('Nội dung lời đọc')).toBeInViewport();
            await expect(
                dialog.getByText('Bám sát giọng mẫu hơn. Tăng mức này có thể tạo lâu hơn.', {
                    exact: true,
                }),
            ).toBeInViewport();
        }
        await page.screenshot({ path: info.outputPath('audio-settings.png') });
        await dialog.getByRole('button', { name: 'Tạo lời đọc', exact: true }).click();
        const save = dialog.getByRole('button', { name: 'Lưu vào tài nguyên', exact: true });
        await expect(save).toBeEnabled();
        expect(
            await page.evaluate(
                () => window.__narration.writes.find((call) => call.url.endsWith('/generate')).body,
            ),
        ).toEqual({
            text: 'Xin chào.\nChào mừng đến với Bookaria.',
            voice: 'maichi',
            speed: 0.8,
            pause: 'long',
            temperature: 0.6,
            voiceStrength: 1.2,
        });
        for (const [label, changed, original] of [
            ['Tốc độ đọc', '1× · Bình thường', '0,8× · Chậm'],
            ['Khoảng nghỉ', 'Vừa', 'Dài'],
            ['Mức biến thiên', 'Mặc định', 'Ít'],
            ['Độ bám giọng', 'Mặc định', 'Tăng nhẹ'],
        ]) {
            await choose(label, changed);
            await expect(save).toBeDisabled();
            await choose(label, original);
            await expect(save).toBeEnabled();
        }
        expect(await writes(page, '/upload-signature')).toBe(0);
        await dialog
            .locator('[data-slot="dialog-footer"]')
            .getByRole('button', { name: 'Đóng', exact: true })
            .click();
        await page.getByRole('button', { name: 'Tạo âm thanh', exact: true }).click();
        await expect(
            dialog.getByRole('slider', { name: 'Tốc độ đọc', exact: true }),
        ).toHaveAttribute('aria-valuenow', '1');
        await expect(
            dialog.getByRole('slider', { name: 'Khoảng nghỉ', exact: true }),
        ).toHaveAttribute('aria-valuenow', '1');
        await expect(advanced).toBeVisible();
        await expect(
            dialog
                .getByRole('radiogroup', { name: 'Mức biến thiên', exact: true })
                .getByRole('radio', { name: 'Mặc định', exact: true }),
        ).toBeChecked();
        await expect(
            dialog
                .getByRole('radiogroup', { name: 'Độ bám giọng', exact: true })
                .getByRole('radio', { name: 'Mặc định', exact: true }),
        ).toBeChecked();
        await expect(dialog.getByLabel('Nội dung lời đọc')).toHaveValue('');
    });
}

test('editor personal audio library can generate, save and choose audio without closing the library', async ({
    page,
}) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
        if (message.text().includes('one blocker')) errors.push(message.text());
    });
    await page.route('https://api.cloudinary.com/**', (route) =>
        route.fulfill({ status: 200, body: '{}' }),
    );
    await page.goto('/tests/browser/assets-narration.html?picker');
    const library = page.getByRole('dialog', { name: 'Thư viện âm thanh', exact: true });
    await expect(library).toBeVisible();
    await expect(library.getByRole('button', { name: 'Tạo âm thanh', exact: true })).toHaveCount(0);
    await library.getByRole('tab', { name: 'Tài nguyên của tôi', exact: true }).click();
    await expect(library.getByRole('button', { name: 'Tải lên', exact: true })).toBeVisible();
    await library.getByRole('button', { name: 'Tạo âm thanh', exact: true }).click();
    const generator = dialogFor(page);
    await expect(generator).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(generator).toBeHidden();
    await expect(library).toBeVisible();
    await library.getByRole('button', { name: 'Tạo âm thanh', exact: true }).click();
    await expect(generator.getByLabel('Giọng đọc', { exact: true })).toHaveText('Mai Chi');
    await generator.getByLabel('Nội dung lời đọc').fill('Âm thanh tạo ngay trong editor.');
    await generator.getByRole('button', { name: 'Tạo lời đọc', exact: true }).click();
    await expect(generator.getByLabel('Nghe thử âm thanh đã tạo')).toHaveAttribute('src', /^blob:/);
    await generator.getByLabel('Tên âm thanh', { exact: true }).fill('Lời đọc từ editor');
    await generator.getByRole('button', { name: 'Lưu vào tài nguyên', exact: true }).click();
    await expect(generator).toBeHidden();
    await expect(library).toBeVisible();
    await library.getByRole('button', { name: 'Xem Lời đọc từ editor', exact: true }).click();
    const preview = page.getByRole('dialog', { name: 'Lời đọc từ editor', exact: true });
    await preview.getByRole('button', { name: 'Thêm vào trang', exact: true }).click();
    await expect(preview).toBeHidden();
    expect(await page.evaluate(() => window.__narration.chosen)).toBe(
        '55555555-5555-4555-8555-555555555555',
    );
    expect(errors).toEqual([]);
});

for (const [theme, width, height] of [
    ['light', 1366, 900],
    ['dark', 390, 844],
]) {
    test(`audio creation ${theme}: stable layout, visible actions and readable generation state`, async ({
        page,
    }, info) => {
        await page.setViewportSize({ width, height });
        await open(page, 'delay', theme);
        await page.getByRole('button', { name: 'Tạo âm thanh', exact: true }).click();
        const dialog = dialogFor(page);
        await expect(dialog.getByLabel('Giọng đọc', { exact: true })).toHaveText('Mai Chi');
        const text = dialog.getByLabel('Nội dung lời đọc');
        await text.fill('Xin chào! Chào mừng bạn đến với Bookaria.');
        await dialog.evaluate((node) =>
            Promise.all(
                node.getAnimations().map((animation) => animation.finished.catch(() => {})),
            ),
        );
        const before = await dialog.boundingBox();
        await page.screenshot({ path: info.outputPath('audio-create-empty.png') });
        await dialog.getByRole('button', { name: 'Tạo lời đọc', exact: true }).click();
        await expect(dialog.getByRole('button', { name: 'Hủy tạo', exact: true })).toBeInViewport();
        await expect(text).toHaveAttribute('readonly', '');
        await expect(text).toBeEnabled();
        await expect(dialog.getByText('Đang tạo bản nghe thử', { exact: true })).toBeVisible();
        await page.screenshot({ path: info.outputPath('audio-create-generating.png') });
        await expect(dialog.getByLabel('Nghe thử âm thanh đã tạo')).toHaveAttribute(
            'src',
            /^blob:/,
        );
        const after = await dialog.boundingBox();
        expect(after.width).toBeCloseTo(before.width, 0);
        expect(after.height).toBeCloseTo(before.height, 0);
        expect(after.y).toBeCloseTo(before.y, 0);
        const save = dialog.getByRole('button', { name: 'Lưu vào tài nguyên', exact: true });
        await expect(
            dialog.getByRole('heading', { name: 'Bản nghe thử', exact: true }),
        ).toHaveCount(0);
        await expect(
            dialog
                .locator('[data-slot="dialog-footer"]')
                .getByRole('button', { name: 'Tạo lại', exact: true }),
        ).toBeInViewport();
        await expect(save).toBeInViewport();
        await expect(dialog.getByLabel('Nghe thử âm thanh đã tạo')).toBeInViewport();
        await dialog.getByLabel('Nghe thử âm thanh đã tạo').scrollIntoViewIfNeeded();
        await page.screenshot({ path: info.outputPath('audio-create-ready.png') });
        await expect(save).toBeInViewport();
        expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
        expect(await writes(page, '/upload-signature')).toBe(0);
        const oldUrl = await dialog.getByLabel('Nghe thử âm thanh đã tạo').getAttribute('src');
        await dialog.getByRole('button', { name: 'Tạo lại', exact: true }).click();
        await dialog.getByRole('button', { name: 'Hủy tạo', exact: true }).click();
        await expect(save).toBeEnabled();
        await expect(dialog.getByLabel('Nghe thử âm thanh đã tạo')).toHaveAttribute('src', oldUrl);
    });
}

test('all eight voices play bundled samples before generating and stop the previous audio', async ({
    page,
}, info) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await open(page);
    await page.getByRole('button', { name: 'Tạo âm thanh', exact: true }).click();
    const dialog = dialogFor(page);
    const voices = [
        ['maichi', 'Mai Chi'],
        ['baotrang', 'Bảo Trang'],
        ['giahuy', 'Gia Huy'],
        ['hamy', 'Hà My'],
        ['huuduc', 'Hữu Đức'],
        ['kimoanh', 'Kim Oanh'],
        ['quangminh', 'Quang Minh'],
        ['tiendat', 'Tiến Đạt'],
    ];
    await dialog.getByLabel('Giọng đọc', { exact: true }).click();
    const picker = page.getByRole('dialog', { name: 'Chọn giọng đọc', exact: true });
    const sample = dialog.locator('audio[aria-label="Âm mẫu giọng đọc"]');
    const firstPlay = picker.getByRole('button', { name: 'Nghe mẫu giọng Mai Chi', exact: true });
    await expect(firstPlay.locator('.lucide-play').locator('..')).toHaveCSS('opacity', '0');
    await picker.getByRole('radio', { name: 'Mai Chi', exact: true }).hover();
    await expect(firstPlay.locator('.lucide-play').locator('..')).toHaveCSS('opacity', '0');
    for (const [id, name] of voices) {
        const play = picker.getByRole('button', { name: `Nghe mẫu giọng ${name}`, exact: true });
        await play.hover();
        const avatar = play.locator('img');
        await expect(avatar).toHaveAttribute('src', `/images/voice-avatars/${id}.jpg`);
        await expect
            .poll(() => avatar.evaluate((image) => image.complete && image.naturalWidth > 0))
            .toBe(true);
        await expect(play.locator('.lucide-play').locator('..')).toHaveCSS('opacity', '1');
        await expect(play.locator('.lucide-play')).toBeVisible();
        await play.click();
        await expect(
            picker.getByRole('button', { name: `Dừng mẫu giọng ${name}`, exact: true }),
        ).toHaveAttribute('aria-pressed', 'true');
        await expect(sample).toHaveAttribute(
            'src',
            new RegExp(`/audio/voice-samples/${id}\\.mp3$`),
        );
        await expect.poll(() => sample.evaluate((audio) => audio.paused)).toBe(false);
        expect(await sample.evaluate((audio) => audio.duration)).toBeGreaterThan(1);
        await expect(dialog.getByLabel('Giọng đọc', { exact: true })).toHaveText('Mai Chi');
    }
    expect(await writes(page, '/narration/generate')).toBe(0);
    expect(await writes(page, '/upload-signature')).toBe(0);
    await page.screenshot({ path: info.outputPath('voice-avatar-picker.png') });
    const failedAvatar = picker
        .getByRole('button', { name: 'Nghe mẫu giọng Mai Chi', exact: true })
        .locator('img');
    await failedAvatar.evaluate((image) => {
        image.src = 'data:image/jpeg;base64,broken';
    });
    await expect(failedAvatar).toBeHidden();
    await picker.getByRole('button', { name: 'Dừng mẫu giọng Tiến Đạt', exact: true }).click();
    await expect.poll(() => sample.evaluate((audio) => audio.paused)).toBe(true);
    await picker.getByRole('button', { name: 'Nghe mẫu giọng Tiến Đạt', exact: true }).click();
    await picker.getByRole('radio', { name: 'Tiến Đạt', exact: true }).click();
    await expect(picker).toBeHidden();
    await expect(dialog.getByLabel('Giọng đọc', { exact: true })).toHaveText('Tiến Đạt');
    await expect.poll(() => sample.evaluate((audio) => audio.paused)).toBe(true);
    await dialog.getByLabel('Giọng đọc', { exact: true }).click();
    await picker.getByRole('radio', { name: 'Mai Chi', exact: true }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(picker.getByRole('radio', { name: 'Gia Huy', exact: true })).toBeFocused();
    await expect(picker.getByRole('radio', { name: 'Gia Huy', exact: true })).toBeChecked();
    await picker.getByRole('button', { name: 'Nghe mẫu giọng Gia Huy', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(picker).toBeHidden();
    await expect(dialog).toBeVisible();
    await expect.poll(() => sample.evaluate((audio) => audio.paused)).toBe(true);
    await dialog.getByLabel('Nội dung lời đọc').fill('Nghe thử âm thanh vừa tạo.');
    await dialog.getByRole('button', { name: 'Tạo lời đọc', exact: true }).click();
    const generated = dialog.getByLabel('Nghe thử âm thanh đã tạo');
    await expect(generated).toBeVisible();
    await generated.evaluate((audio) => audio.play());
    await dialog.getByRole('button', { name: 'Đóng', exact: true }).first().click();
    await expect(dialog).toBeHidden();
});
async function generate(page) {
    await page.getByRole('button', { name: 'Tạo âm thanh', exact: true }).click();
    const dialog = dialogFor(page);
    await expect(dialog.getByLabel('Giọng đọc', { exact: true })).toHaveText('Mai Chi');
    await dialog.getByLabel('Nội dung lời đọc').fill('Rùa và Thỏ cùng khám phá khu rừng.');
    await dialog.getByRole('button', { name: 'Tạo lời đọc', exact: true }).click();
    await expect(dialog.getByLabel('Nghe thử âm thanh đã tạo')).toHaveAttribute('src', /^blob:/);
    return dialog;
}

test('personal audio library generates a preview and saves only after review', async ({
    page,
}, info) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    let uploads = 0;
    await page.route('https://api.cloudinary.com/**', (route) => {
        uploads++;
        return route.fulfill({ status: 200, body: '{}' });
    });
    await open(page, 'all');
    for (const type of ['Tất cả', 'Hình ảnh', 'Âm thanh', 'Video', 'Mô hình 3D']) {
        await page.getByRole('radio', { name: type, exact: true }).click();
        await expect(page.getByRole('button', { name: 'Tạo âm thanh', exact: true })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Tải tài nguyên', exact: true })).toBeVisible();
    }
    const dialog = await generate(page);
    await expect(dialog).toBeVisible();
    expect(uploads).toBe(0);
    expect(await writes(page, '/upload-signature')).toBe(0);
    expect(await writes(page, '/complete')).toBe(0);
    await dialog.getByLabel('Tên âm thanh', { exact: true }).fill('Rùa và Thỏ — lời kể');
    await dialog.evaluate((node) =>
        Promise.all(node.getAnimations().map((animation) => animation.finished.catch(() => {}))),
    );
    await page.screenshot({ path: info.outputPath('audio-library-preview.png') });
    await dialog.getByRole('button', { name: 'Đóng', exact: true }).first().click();
    await page.getByRole('radio', { name: 'Hình ảnh', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Tạo âm thanh', exact: true })).toBeVisible();
    await page.getByRole('radio', { name: 'Âm thanh', exact: true }).click();
    await page.getByRole('button', { name: 'Tạo âm thanh', exact: true }).click();
    await expect(dialog.getByLabel('Nội dung lời đọc')).toHaveValue('');
    await expect(dialog.getByLabel('Nghe thử âm thanh đã tạo')).toHaveCount(0);
    await expect(dialog.getByLabel('Giọng đọc', { exact: true })).toHaveText('Mai Chi');
    await dialog.getByLabel('Nội dung lời đọc').fill('Một bản âm thanh mới.');
    await dialog.getByRole('button', { name: 'Tạo lời đọc', exact: true }).click();
    await expect(dialog.getByLabel('Nghe thử âm thanh đã tạo')).toHaveAttribute('src', /^blob:/);
    await expect(dialog.getByLabel('Tên âm thanh', { exact: true })).toHaveValue(
        'Lời đọc từ văn bản',
    );
    await dialog.getByLabel('Tên âm thanh', { exact: true }).fill('Rùa và Thỏ — lời kể');
    const save = dialog.getByRole('button', { name: 'Lưu vào tài nguyên', exact: true });
    await dialog.getByLabel('Nội dung lời đọc').fill('Một nội dung khác.');
    await expect(save).toBeDisabled();
    await expect(
        dialog.getByText('Nội dung, giọng đọc hoặc tùy chỉnh đã đổi. Hãy tạo lại trước khi lưu.'),
    ).toBeVisible();
    await dialog.getByRole('button', { name: 'Tạo lại', exact: true }).click();
    await expect(save).toBeEnabled();
    await save.click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('radio', { name: 'Âm thanh', exact: true })).toBeChecked();
    await expect(
        page
            .getByRole('list', { name: 'Tài nguyên của tôi', exact: true })
            .getByText('Rùa và Thỏ — lời kể'),
    ).toBeVisible();
    expect(uploads).toBe(1);
    expect(await writes(page, '/complete')).toBe(1);
    expect(
        await page.evaluate(
            () =>
                window.__narration.writes.find((call) => call.url === '/assets/upload-signature')
                    .body,
        ),
    ).toMatchObject({ fileName: 'loi-thuyet-minh.mp3', mimeType: 'audio/mpeg' });
});

test('failed save retains preview and retries completion without uploading twice', async ({
    page,
}) => {
    let uploads = 0;
    await page.route('https://api.cloudinary.com/**', (route) => {
        uploads++;
        return route.fulfill({ status: 200, body: '{}' });
    });
    await open(page, 'failComplete');
    const dialog = await generate(page);
    await dialog.getByRole('button', { name: 'Lưu vào tài nguyên', exact: true }).click();
    await expect(dialog.getByRole('alert')).toHaveText('Chưa lưu được âm thanh. Hãy thử lại.');
    await expect(dialog.getByLabel('Nghe thử âm thanh đã tạo')).toBeVisible();
    expect(uploads).toBe(1);
    await dialog.getByRole('button', { name: 'Lưu vào tài nguyên', exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(uploads).toBe(1);
    expect(await writes(page, '/upload-signature')).toBe(1);
    expect(await writes(page, '/complete')).toBe(2);
});

test('closing during generation cancels without saving and resets the compact modal', async ({
    page,
}, info) => {
    await page.setViewportSize({ width: 768, height: 700 });
    await open(page, 'delay', 'dark');
    const trigger = page.getByRole('button', { name: 'Tạo âm thanh', exact: true });
    await trigger.click();
    const dialog = dialogFor(page);
    await dialog.getByLabel('Giọng đọc', { exact: true }).click();
    const picker = page.getByRole('dialog', { name: 'Chọn giọng đọc', exact: true });
    await expect(picker).toBeVisible();
    await picker.getByRole('button', { name: 'Nghe mẫu giọng Mai Chi', exact: true }).focus();
    await picker.evaluate((node) =>
        Promise.all(node.getAnimations().map((animation) => animation.finished.catch(() => {}))),
    );
    await page.screenshot({ path: info.outputPath('voice-avatar-picker-compact-dark.png') });
    const pickerBounds = await picker.boundingBox();
    expect(pickerBounds.x).toBeGreaterThanOrEqual(0);
    expect(pickerBounds.y).toBeGreaterThanOrEqual(0);
    expect(pickerBounds.x + pickerBounds.width).toBeLessThanOrEqual(768);
    expect(pickerBounds.y + pickerBounds.height).toBeLessThanOrEqual(700);
    await page.keyboard.press('Escape');
    await dialog.getByLabel('Nội dung lời đọc').fill('Bản nghe thử chưa lưu.');
    await dialog.getByRole('button', { name: 'Tạo lời đọc', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Hủy tạo', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeEnabled();
    await trigger.click();
    await expect(dialog.getByLabel('Nội dung lời đọc')).toHaveValue('');
    await expect(dialog.getByRole('button', { name: 'Tạo lời đọc', exact: true })).toBeDisabled();
    await expect(dialog.getByLabel('Nghe thử âm thanh đã tạo')).toHaveCount(0);
    expect(await writes(page, '/upload-signature')).toBe(0);
    await dialog.evaluate((node) =>
        Promise.all(node.getAnimations().map((animation) => animation.finished.catch(() => {}))),
    );
    await page.screenshot({ path: info.outputPath('audio-library-compact-dark.png') });
    const bounds = await dialog.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(16);
    expect(bounds.y).toBeGreaterThanOrEqual(16);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(684);
    await dialog.getByRole('button', { name: 'Đóng', exact: true }).first().click();
    await expect(trigger).toBeFocused();
});
