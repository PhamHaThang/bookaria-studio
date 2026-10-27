import { loadTextImage } from '@/shared/scene/text-renderer';

/** One decoded image per modal; returned copies belong to their individual visuals. */
export function createTextPreviewImageCache() {
    let current:
        | {
              url: string;
              controller: AbortController;
              image?: HTMLCanvasElement;
              pending: Promise<HTMLCanvasElement>;
          }
        | undefined;
    let disposed = false;
    const release = () => {
        current?.controller.abort();
        if (current?.image) {
            current.image.width = 1;
            current.image.height = 1;
        }
        current = undefined;
    };
    return {
        async load(url: string, signal?: AbortSignal) {
            signal?.throwIfAborted();
            if (disposed) throw new DOMException('Preview closed', 'AbortError');
            if (current?.url !== url) {
                release();
                const controller = new AbortController();
                const entry = {
                    url,
                    controller,
                    image: undefined as HTMLCanvasElement | undefined,
                    pending: loadTextImage(url, controller.signal),
                };
                current = entry;
                entry.pending = entry.pending
                    .then((image) => {
                        if (disposed || current !== entry) {
                            image.width = 1;
                            image.height = 1;
                            throw new DOMException('Image replaced', 'AbortError');
                        }
                        entry.image = image;
                        return image;
                    })
                    .catch((error: unknown) => {
                        if (current === entry) release();
                        throw error;
                    });
            }
            const image = await current.pending;
            signal?.throwIfAborted();
            const copy = document.createElement('canvas');
            copy.width = image.width;
            copy.height = image.height;
            const context = copy.getContext('2d');
            if (!context) throw new Error('Không tạo được ảnh xem trước.');
            context.drawImage(image, 0, 0);
            return copy;
        },
        dispose() {
            disposed = true;
            release();
        },
    };
}
