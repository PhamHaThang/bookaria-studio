/** Shared with PDF page imports so book covers use the same image quality budget. */
export const PAGE_IMAGE_BOUNDS = { width: 1600, height: 2400 } as const;
export const PAGE_IMAGE_JPEG_QUALITY = 0.94;

export async function canvasFile(canvas: HTMLCanvasElement, name: string) {
    const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
            (value) => (value ? resolve(value) : reject(new Error('Không tạo được ảnh trang.'))),
            'image/jpeg',
            PAGE_IMAGE_JPEG_QUALITY,
        ),
    );
    if (blob.size > 10 * 1024 * 1024)
        throw new Error('Ảnh trang sau chuyển đổi vượt 10 MB. Hãy giảm độ phức tạp của tài liệu.');
    return new File([blob], name, { type: 'image/jpeg' });
}

const covers = new WeakMap<File, File>();

/** Use the page image budget without cropping or enlarging; retain smaller original files. */
export async function optimizeBookCover(file: File, signal: AbortSignal): Promise<File> {
    signal.throwIfAborted();
    const cached = covers.get(file);
    if (cached) return cached;
    let image: ImageBitmap;
    try {
        image = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
        signal.throwIfAborted();
        throw new Error(`Không đọc được ảnh “${file.name}”. Hãy kiểm tra hoặc chọn ảnh khác.`);
    }
    const canvas = document.createElement('canvas');
    try {
        signal.throwIfAborted();
        if (image.width * image.height > 40_000_000)
            throw new Error('Ảnh bìa quá lớn (tối đa 40 megapixel).');
        const scale = Math.min(
            1,
            PAGE_IMAGE_BOUNDS.width / image.width,
            PAGE_IMAGE_BOUNDS.height / image.height,
        );
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Chưa xử lý được ảnh bìa trên trình duyệt này.');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const name = `${file.name.replace(/\.[^.]+$/, '')}.jpg`;
        const optimized = await canvasFile(canvas, name);
        signal.throwIfAborted();
        const result = optimized.size < file.size ? optimized : file;
        covers.set(file, result);
        return result;
    } finally {
        image.close();
        canvas.width = canvas.height = 0;
    }
}
