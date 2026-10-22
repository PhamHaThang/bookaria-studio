/** A disposable frame owns MindAR and its worker, so cancel also releases GPU/worker resources. */
export function compileMarker(
    url: string,
    signal: AbortSignal,
    onProgress: (percent: number) => void,
): Promise<File> {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
        const id = crypto.randomUUID();
        const frame = document.createElement('iframe');
        frame.hidden = true;
        frame.title = 'Chuẩn bị nhận diện ảnh';
        const base = new URL(import.meta.env.BASE_URL, document.baseURI);
        frame.src = new URL(`marker-compiler/index.html#${id}`, base).href;
        const finish = (error?: Error, file?: File) => {
            clearTimeout(timeout);
            window.removeEventListener('message', receive);
            signal.removeEventListener('abort', abort);
            frame.remove();
            if (error) reject(error);
            else if (file) resolve(file);
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
                frame.contentWindow?.postMessage({ type: 'compile', id, url }, location.origin);
            else if (event.data.type === 'progress' && Number.isFinite(event.data.percent))
                onProgress(Math.max(0, Math.min(100, Math.round(event.data.percent))));
            else if (event.data.type === 'error')
                finish(
                    new Error(
                        'Chưa tạo được dữ liệu nhận diện từ ảnh. Hãy thử ảnh khác hoặc thử lại.',
                    ),
                );
            else if (event.data.type === 'done' && event.data.bytes instanceof ArrayBuffer) {
                finish(
                    undefined,
                    new File([event.data.bytes], 'page.mind', { type: 'application/octet-stream' }),
                );
            }
        };
        signal.addEventListener('abort', abort, { once: true });
        window.addEventListener('message', receive);
        document.body.append(frame);
    });
}
