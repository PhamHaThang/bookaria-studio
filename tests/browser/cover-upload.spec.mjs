import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.route('**/cover-image-check', (route) =>
        route.fulfill({
            contentType: 'text/html',
            body: '<!doctype html><html><head><meta charset="UTF-8"></head><body></body></html>',
        }),
    );
    await page.goto('/cover-image-check');
});

for (const [width, height, expectedWidth, expectedHeight] of [
    [2480, 2480, 1600, 1600],
    [2400, 3200, 1600, 2133],
    [2560, 1440, 1600, 900],
]) {
    test(`optimizes ${width}×${height} covers using the PDF page JPEG budget`, async ({ page }) => {
        const result = await page.evaluate(
            async ({ width, height }) => {
                const { optimizeBookCover } = await import('/src/shared/lib/image-file.ts');
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const context = canvas.getContext('2d');
                const pixels = context.createImageData(width, height);
                let seed = 2026;
                for (let y = 0; y < height; y++)
                    for (let x = 0; x < width; x++) {
                        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                        const i = (y * width + x) * 4,
                            noise = seed >>> 27;
                        pixels.data.set(
                            [50 + (x % 100) + noise, 60 + (y % 100) + noise, 80 + noise, 255],
                            i,
                        );
                    }
                context.putImageData(pixels, 0, 0);
                const source = new File(
                    [await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))],
                    'bìa.png',
                    { type: 'image/png' },
                );
                const signal = new AbortController().signal;
                const optimized = await optimizeBookCover(source, signal);
                const cached = await optimizeBookCover(source, signal);
                const bitmap = await createImageBitmap(optimized);
                const result = {
                    type: optimized.type,
                    name: optimized.name,
                    originalBytes: source.size,
                    bytes: optimized.size,
                    width: bitmap.width,
                    height: bitmap.height,
                    cached: cached === optimized,
                };
                bitmap.close();
                canvas.width = canvas.height = 0;
                return result;
            },
            { width, height },
        );
        expect(result.type).toBe('image/jpeg');
        expect(result.name).toBe('bìa.jpg');
        expect(result.width).toBe(expectedWidth);
        expect(result.height).toBe(expectedHeight);
        expect(result.bytes).toBeLessThan(result.originalBytes);
        expect(result.cached).toBe(true);
        console.log(`${width}×${height}: ${result.originalBytes} → ${result.bytes} bytes`);
    });
}

test('keeps an already small JPEG without enlarging it or increasing its size', async ({
    page,
}) => {
    const result = await page.evaluate(async () => {
        const { optimizeBookCover } = await import('/src/shared/lib/image-file.ts');
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 600;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#208080';
        ctx.fillRect(0, 0, 400, 600);
        const file = new File(
            [await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.5))],
            'small.jpg',
            { type: 'image/jpeg' },
        );
        const optimized = await optimizeBookCover(file, new AbortController().signal);
        const bitmap = await createImageBitmap(optimized);
        const result = { same: file === optimized, width: bitmap.width, height: bitmap.height };
        bitmap.close();
        return result;
    });
    expect(result).toEqual({ same: true, width: 400, height: 600 });
});

test('does not upload an unreadable or canceled cover', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const { optimizeBookCover } = await import('/src/shared/lib/image-file.ts');
        const file = new File(['not an image'], 'bad.png', { type: 'image/png' });
        let invalid = false,
            aborted = false;
        try {
            await optimizeBookCover(file, new AbortController().signal);
        } catch (error) {
            invalid = error.message.includes('Không đọc được ảnh');
        }
        const abort = new AbortController();
        abort.abort();
        try {
            await optimizeBookCover(file, abort.signal);
        } catch (error) {
            aborted = error.name === 'AbortError';
        }
        return { invalid, aborted };
    });
    expect(result).toEqual({ invalid: true, aborted: true });
});

test('flattens transparent covers on white when creating the JPEG', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const { optimizeBookCover } = await import('/src/shared/lib/image-file.ts');
        const canvas = document.createElement('canvas');
        canvas.width = 1000;
        canvas.height = 1000;
        const context = canvas.getContext('2d');
        const pixels = context.createImageData(1000, 1000);
        let seed = 42;
        for (let y = 80; y < 1000; y++)
            for (let x = 0; x < 1000; x++) {
                seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
                const noise = seed >>> 27;
                pixels.data.set([70 + noise, 110 + noise, 150 + noise, 255], (y * 1000 + x) * 4);
            }
        context.putImageData(pixels, 0, 0);
        const file = new File(
            [await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))],
            'transparent.png',
            { type: 'image/png' },
        );
        const optimized = await optimizeBookCover(file, new AbortController().signal);
        const bitmap = await createImageBitmap(optimized);
        context.drawImage(bitmap, 0, 0);
        const color = Array.from(context.getImageData(20, 20, 1, 1).data);
        bitmap.close();
        return { type: optimized.type, color };
    });
    expect(result.type).toBe('image/jpeg');
    expect(result.color).toEqual([255, 255, 255, 255]);
});
