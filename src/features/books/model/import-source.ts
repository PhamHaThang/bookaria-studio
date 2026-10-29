import type { PageSizeMm } from './page-size';

export const MAX_IMPORT_PAGES = 100;
export interface ImportSource {
    kind: 'pdf' | 'images';
    name: string;
    count: number;
    preview: string;
    labels: string[];
    /** Displayed page dimensions in PDF order, including rotation and crop box. */
    pageSizesMm?: PageSizeMm[];
    /** Original decoded dimensions; image pixels do not imply a physical print size. */
    imageSizesPx?: { width: number; height: number }[];
    thumbnail: (index: number, signal: AbortSignal) => Promise<string>;
    /** A single bounded, high-resolution page for the image preview dialog. */
    previewPage?: (index: number, signal: AbortSignal) => Promise<File>;
    render: (index: number) => Promise<File>;
    dispose: () => void;
}
export type ImportProgress = (current: number, total: number) => void;

/** Keep previous selections, ignore the same file selected again, then validate the combined batch. */
export function mergeImageFiles(existing: File[], incoming: File[]) {
    const files = new Map<string, File>();
    for (const file of [...existing, ...incoming]) {
        const key = JSON.stringify([file.name, file.size, file.lastModified, file.type]);
        if (!files.has(key)) files.set(key, file);
    }
    const result = validateImportFiles([...files.values()]);
    if (result.kind !== 'images')
        throw new Error('Chọn ảnh JPG/PNG. Dùng Đổi tài liệu để chọn PDF.');
    return result.files;
}

export function selectedPages(value: string, count: number): number[] {
    if (!Number.isInteger(count) || count < 1 || count > MAX_IMPORT_PAGES)
        throw new Error(`Chọn tài liệu có từ 1 đến ${MAX_IMPORT_PAGES} trang.`);
    if (!value.trim()) return Array.from({ length: count }, (_, index) => index);
    const pages = new Set<number>();
    for (const part of value.split(',')) {
        const match = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(part);
        if (!match) throw new Error('Nhập số trang như 1-3, 5. Để trống để nhập tất cả.');
        const start = Number(match[1]),
            end = Number(match[2] || match[1]);
        if (start < 1 || end < start || end > count)
            throw new Error(`Số trang phải nằm trong khoảng 1–${count}, theo thứ tự tăng dần.`);
        for (let page = start; page <= end; page++) pages.add(page - 1);
    }
    return [...pages].sort((a, b) => a - b);
}

export function validateImportFiles(input: File[]) {
    if (!input.length) throw new Error('Chọn một PDF hoặc các ảnh JPG/PNG.');
    const pdf = input.filter((file) => /\.pdf$/i.test(file.name));
    if (pdf.length) {
        if (input.length !== 1) throw new Error('Mỗi lần nhập một PDF. Không chọn kèm ảnh.');
        if (pdf[0].size > 50 * 1024 * 1024) throw new Error('PDF tối đa 50 MB.');
        if (!pdf[0].size) throw new Error('File đang trống. Chọn tài liệu khác.');
        return { kind: 'pdf' as const, files: pdf };
    }
    if (input.length > MAX_IMPORT_PAGES)
        throw new Error(`Mỗi lần nhập tối đa ${MAX_IMPORT_PAGES} ảnh.`);
    for (const file of input) {
        if (!/\.(jpe?g|png)$/i.test(file.name)) throw new Error('Hiện hỗ trợ PDF, JPG và PNG.');
        if (!file.size || file.size > 10 * 1024 * 1024)
            throw new Error(`Ảnh “${file.name}” phải có dung lượng từ 1 byte đến 10 MB.`);
    }
    if (input.reduce((sum, file) => sum + file.size, 0) > 100 * 1024 * 1024)
        throw new Error('Tổng ảnh tối đa 100 MB. Hãy chia thành các lần nhập nhỏ hơn.');
    return {
        kind: 'images' as const,
        files: [...input].sort((a, b) => a.name.localeCompare(b.name, 'vi', { numeric: true })),
    };
}

export function pageFit(width: number, height: number, aspect: number) {
    if (
        ![width, height, aspect].every(Number.isFinite) ||
        width <= 0 ||
        height <= 0 ||
        aspect < 0.2 ||
        aspect > 5
    )
        throw new Error('Kích thước trang không hợp lệ.');
    const targetWidth = Math.round(Math.min(1600, 2400 / aspect));
    const targetHeight = Math.round(targetWidth * aspect);
    const scale = Math.min(targetWidth / width, targetHeight / height);
    return {
        width: targetWidth,
        height: targetHeight,
        drawWidth: width * scale,
        drawHeight: height * scale,
        x: (targetWidth - width * scale) / 2,
        y: (targetHeight - height * scale) / 2,
        scale,
    };
}

export async function canvasFile(canvas: HTMLCanvasElement, name: string) {
    const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
            (value) => (value ? resolve(value) : reject(new Error('Không tạo được ảnh trang.'))),
            'image/jpeg',
            0.94,
        ),
    );
    if (blob.size > 10 * 1024 * 1024)
        throw new Error('Ảnh trang sau chuyển đổi vượt 10 MB. Hãy giảm độ phức tạp của tài liệu.');
    return new File([blob], name, { type: 'image/jpeg' });
}

async function readImage(file: File) {
    try {
        return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
        throw new Error(`Không đọc được ảnh “${file.name}”. Hãy kiểm tra hoặc chọn ảnh khác.`);
    }
}

export async function prepareImport(
    input: File[],
    signal: AbortSignal,
    onProgress?: ImportProgress,
): Promise<ImportSource> {
    const { kind, files } = validateImportFiles(input);
    signal.throwIfAborted();
    if (kind === 'pdf') {
        const { preparePdf } = await import('./pdf-import');
        signal.throwIfAborted();
        return preparePdf(files[0], signal, onProgress);
    }
    // Decode one image at a time; validate every source before creating a book.
    const previews: string[] = [];
    const imageSizesPx: { width: number; height: number }[] = [];
    onProgress?.(0, files.length);
    for (const [index, file] of files.entries()) {
        const image = await readImage(file);
        try {
            signal.throwIfAborted();
            if (image.width * image.height > 40_000_000)
                throw new Error(`Ảnh “${file.name}” quá lớn (tối đa 40 megapixel).`);
            imageSizesPx.push({ width: image.width, height: image.height });
            {
                const canvas = document.createElement('canvas');
                const scale = Math.min(240 / image.width, 320 / image.height);
                canvas.width = Math.max(1, Math.round(image.width * scale));
                canvas.height = Math.max(1, Math.round(image.height * scale));
                canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
                previews.push(canvas.toDataURL('image/jpeg', 0.8));
                canvas.width = canvas.height = 0;
            }
        } finally {
            image.close();
        }
        onProgress?.(index + 1, files.length);
    }
    return {
        kind,
        name: `${files.length} ảnh`,
        count: files.length,
        preview: previews[0],
        imageSizesPx,
        labels: files.map((file) => file.name),
        async thumbnail(index, signal) {
            signal.throwIfAborted();
            if (!previews[index]) throw new Error('Không tìm thấy ảnh xem trước.');
            return previews[index];
        },
        dispose: () => undefined,
        render: async (index) => files[index],
    };
}
