import { GlobalWorkerOptions, getDocument, version } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
    canvasFile,
    type ImportProgress,
    type ImportSource,
    MAX_IMPORT_PAGES,
} from './import-source';
import { type PageSizeMm, pdfPageSizeMm } from './page-size';

GlobalWorkerOptions.workerSrc = workerUrl;

export async function preparePdf(
    file: File,
    signal: AbortSignal,
    onProgress?: ImportProgress,
): Promise<ImportSource> {
    const base = `${import.meta.env.BASE_URL}vendor/pdfjs/${version}/`;
    const task = getDocument({
        data: new Uint8Array(await file.arrayBuffer()),
        cMapUrl: `${base}cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${base}standard_fonts/`,
        wasmUrl: `${base}wasm/`,
        iccUrl: `${base}iccs/`,
        maxImageSize: 40_000_000,
    });
    const abort = () => {
        void task.destroy();
    };
    signal.addEventListener('abort', abort, { once: true });
    task.onPassword = () => {
        void task.destroy();
    };
    try {
        signal.throwIfAborted();
        const document = await task.promise;
        if (document.numPages > MAX_IMPORT_PAGES || document.numPages < 1)
            throw new Error(
                `PDF cần có từ 1 đến ${MAX_IMPORT_PAGES} trang. Hãy tách tài liệu lớn trước khi nhập.`,
            );
        onProgress?.(0, document.numPages);
        const pageSizesMm: PageSizeMm[] = [];
        // Validate page geometry without retaining full rendered images in memory.
        for (let index = 1; index <= document.numPages; index++) {
            signal.throwIfAborted();
            const page = await document.getPage(index);
            const view = page.getViewport({ scale: 1 });
            if (!Number.isFinite(view.width + view.height) || view.width <= 0 || view.height <= 0)
                throw new Error(`Trang ${index} có kích thước không hợp lệ.`);
            pageSizesMm.push(pdfPageSizeMm(view.width, view.height));
            page.cleanup();
            onProgress?.(index, document.numPages);
        }
        async function renderCanvas(index: number, maxWidth = 240, maxHeight = 2000) {
            const page = await document.getPage(index + 1);
            const raw = page.getViewport({ scale: 1 });
            const scale = Math.min(maxWidth / raw.width, maxHeight / raw.height);
            const canvas = window.document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(raw.width * scale));
            canvas.height = Math.max(1, Math.round(raw.height * scale));
            try {
                await page.render({
                    canvas,
                    viewport: page.getViewport({ scale }),
                    background: '#ffffff',
                }).promise;
                return canvas;
            } catch (error) {
                canvas.width = canvas.height = 0;
                throw error;
            } finally {
                page.cleanup();
            }
        }
        const first = await renderCanvas(0);
        const preview = first.toDataURL('image/jpeg', 0.8);
        first.width = first.height = 0;
        signal.throwIfAborted();
        signal.removeEventListener('abort', abort);
        const thumbnails = new Map<number, string>([[0, preview]]);
        // Render visible thumbnails one at a time, keeping memory bounded for large PDFs.
        let queue: Promise<unknown> = Promise.resolve();
        return {
            kind: 'pdf',
            name: file.name,
            count: document.numPages,
            preview,
            labels: Array.from({ length: document.numPages }, (_, i) => `Trang PDF ${i + 1}`),
            pageSizesMm,
            thumbnail(index, signal) {
                const result = queue.then(async () => {
                    signal.throwIfAborted();
                    const cached = thumbnails.get(index);
                    if (cached) return cached;
                    const canvas = await renderCanvas(index);
                    try {
                        signal.throwIfAborted();
                        const url = canvas.toDataURL('image/jpeg', 0.8);
                        thumbnails.set(index, url);
                        return url;
                    } finally {
                        canvas.width = canvas.height = 0;
                    }
                });
                queue = result.catch(() => undefined);
                return result;
            },
            previewPage(index, signal) {
                const result = queue.then(async () => {
                    signal.throwIfAborted();
                    const canvas = await renderCanvas(index, 1400);
                    try {
                        signal.throwIfAborted();
                        return await canvasFile(canvas, `trang-pdf-${index + 1}.jpg`);
                    } finally {
                        canvas.width = canvas.height = 0;
                    }
                });
                queue = result.catch(() => undefined);
                return result;
            },
            dispose: () => {
                void task.destroy();
            },
            render(index) {
                const result = queue.then(async () => {
                    const canvas = await renderCanvas(index, 1600, 2400);
                    try {
                        return await canvasFile(canvas, `trang-pdf-${index + 1}.jpg`);
                    } finally {
                        canvas.width = canvas.height = 0;
                    }
                });
                queue = result.catch(() => undefined);
                return result;
            },
        };
    } catch (error) {
        signal.removeEventListener('abort', abort);
        await task.destroy();
        if (signal.aborted) throw error;
        if (error instanceof Error && /password|worker was destroyed/i.test(error.message))
            throw new Error(
                'PDF được bảo vệ bằng mật khẩu. Hãy xuất bản PDF không có mật khẩu rồi chọn lại.',
            );
        throw new Error(
            error instanceof Error && /PDF cần|Trang \d+/.test(error.message)
                ? error.message
                : 'Không đọc được PDF. Hãy mở kiểm tra hoặc xuất lại file rồi thử lại.',
        );
    }
}
