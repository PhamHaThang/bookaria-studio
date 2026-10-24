import { GlobalWorkerOptions, getDocument, version } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { canvasFile, type ImportSource, MAX_IMPORT_PAGES, pageFit } from './import-source';

GlobalWorkerOptions.workerSrc = workerUrl;

export async function preparePdf(file: File, signal: AbortSignal): Promise<ImportSource> {
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
        // Validate page geometry without retaining full rendered images in memory.
        for (let index = 1; index <= document.numPages; index++) {
            signal.throwIfAborted();
            const page = await document.getPage(index);
            const view = page.getViewport({ scale: 1 });
            if (!Number.isFinite(view.width + view.height) || view.width <= 0 || view.height <= 0)
                throw new Error(`Trang ${index} có kích thước không hợp lệ.`);
            page.cleanup();
        }
        async function renderCanvas(index: number, aspect?: number) {
            const page = await document.getPage(index + 1);
            const raw = page.getViewport({ scale: 1 });
            const fit = pageFit(
                raw.width,
                raw.height,
                aspect ?? Math.max(0.2, Math.min(5, raw.height / raw.width)),
            );
            const scale = aspect === undefined ? 240 / fit.width : 1;
            const canvas = window.document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(fit.width * scale));
            canvas.height = Math.max(1, Math.round(fit.height * scale));
            try {
                await page.render({
                    canvas,
                    viewport: page.getViewport({ scale: fit.scale * scale }),
                    transform: [1, 0, 0, 1, fit.x * scale, fit.y * scale],
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
        return {
            kind: 'pdf',
            name: file.name,
            count: document.numPages,
            preview,
            labels: Array.from({ length: document.numPages }, (_, i) => `Trang PDF ${i + 1}`),
            dispose: () => {
                void task.destroy();
            },
            async render(index, aspect) {
                const canvas = await renderCanvas(index, aspect);
                try {
                    return await canvasFile(canvas, `trang-pdf-${index + 1}.jpg`);
                } finally {
                    canvas.width = canvas.height = 0;
                }
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
