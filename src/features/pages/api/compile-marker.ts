import {
    analyzeMindarLevel,
    type MarkerImagePreview,
    MarkerImagePreviewSchema,
} from '../../../shared/contracts/marker-analysis.schema';

/** A disposable frame owns MindAR and its worker, so cancel also releases GPU/worker resources. */
function runMarkerFrame<T>(
    url: string,
    signal: AbortSignal,
    onProgress: (percent: number) => void,
    mode: 'compile' | 'analyze',
    decode: (data: Record<string, unknown>) => T,
): Promise<T> {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
        const id = crypto.randomUUID();
        const frame = document.createElement('iframe');
        frame.hidden = true;
        frame.title = 'Chuẩn bị nhận diện ảnh';
        const base = new URL(import.meta.env.BASE_URL, document.baseURI);
        frame.src = new URL(`marker-compiler/index.html#${id}`, base).href;
        const finish = (error?: Error, value?: T) => {
            clearTimeout(timeout);
            window.removeEventListener('message', receive);
            signal.removeEventListener('abort', abort);
            frame.remove();
            if (error) reject(error);
            else if (value !== undefined) resolve(value);
        };
        const abort = () => finish(new DOMException('Đã dừng chuẩn bị nhận diện.', 'AbortError'));
        const timeout = setTimeout(
            () =>
                finish(new Error('Chuẩn bị nhận diện quá lâu. Hãy thử ảnh nhỏ hơn hoặc thử lại.')),
            180_000,
        );
        const receive = (event: MessageEvent) => {
            if (
                event.origin !== location.origin ||
                event.source !== frame.contentWindow ||
                event.data?.id !== id
            )
                return;
            if (event.data.type === 'ready')
                frame.contentWindow?.postMessage({ type: mode, id, url }, location.origin);
            else if (event.data.type === 'progress' && Number.isFinite(event.data.percent))
                onProgress(Math.max(0, Math.min(100, Math.round(event.data.percent))));
            else if (event.data.type === 'error')
                finish(
                    new Error(
                        'Chưa tạo được dữ liệu nhận diện từ ảnh. Hãy thử ảnh khác hoặc thử lại.',
                    ),
                );
            else if (event.data.type === 'done') {
                try {
                    finish(undefined, decode(event.data));
                } catch {
                    finish(new Error('Dữ liệu phân tích ảnh không hợp lệ. Hãy thử lại.'));
                }
            }
        };
        signal.addEventListener('abort', abort, { once: true });
        window.addEventListener('message', receive);
        document.body.append(frame);
    });
}

export function compileMarker(
    url: string,
    signal: AbortSignal,
    onProgress: (percent: number) => void,
): Promise<File> {
    return runMarkerFrame(url, signal, onProgress, 'compile', (data) => {
        if (!(data.bytes instanceof ArrayBuffer)) throw new Error('Missing compiled target');
        return new File([data.bytes], 'page.mind', { type: 'application/octet-stream' });
    });
}

export async function analyzeMarkerImage(
    file: File,
    signal: AbortSignal,
    onProgress: (percent: number) => void,
): Promise<MarkerImagePreview> {
    signal.throwIfAborted();
    const url = URL.createObjectURL(file);
    try {
        return await runMarkerFrame(url, signal, onProgress, 'analyze', (data) =>
            MarkerImagePreviewSchema.parse({
                ...analyzeMindarLevel(
                    data.level,
                    Number(data.sourceWidth),
                    Number(data.sourceHeight),
                    signal,
                ),
                image: data.image,
            }),
        );
    } finally {
        URL.revokeObjectURL(url);
    }
}
