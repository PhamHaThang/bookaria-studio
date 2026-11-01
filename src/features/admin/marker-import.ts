import type { MarkerUploadResult } from '@/shared/contracts/api/admin.schema';
import type { BookariaMarker } from '@/shared/contracts/dto.schema';
import type { createAdminLibraryApi } from './library-api';

export type MarkerImportItem = {
    key: string;
    name: string;
    image: File;
    status: 'pending' | 'compiling' | 'uploading' | 'done' | 'error';
    progress: number;
    error?: string;
    result?: BookariaMarker;
    checkpoint?: MarkerCheckpoint;
};
export type MarkerCheckpoint = {
    mind: File;
    signature?: MarkerUploadResult;
    imageDone: boolean;
    mindDone: boolean;
};
export function markerFileFormat(file: File) {
    const ext = file.name.split('.').at(-1)?.toLowerCase() || '';
    return ext === 'jpeg' ? 'jpg' : ext;
}
export function mergeMarkerImages(current: MarkerImportItem[], files: File[]): MarkerImportItem[] {
    const entries = new Map(current.map((row) => [row.key, { ...row }]));
    for (const file of files) {
        const format = markerFileFormat(file);
        if (!['png', 'jpg', 'webp'].includes(format))
            throw new Error(`“${file.name}”: chọn ảnh PNG, JPG hoặc WebP.`);
        if (!file.size || file.size > 10 * 1024 * 1024)
            throw new Error(`“${file.name}”: ảnh rỗng hoặc vượt 10 MB.`);
        const name = file.name
                .replace(/\.[^.]+$/, '')
                .trim()
                .normalize('NFC'),
            key = name.toLocaleLowerCase('vi');
        if (!key) throw new Error('Ảnh cần có tên tệp.');
        const previous = entries.get(key);
        if (previous) {
            if (
                previous.image.name === file.name &&
                previous.image.size === file.size &&
                previous.image.lastModified === file.lastModified
            )
                continue;
            throw new Error(
                `Có nhiều ảnh cùng tên “${name}”. Đổi tên hoặc xóa ảnh cũ trước khi thêm.`,
            );
        }
        entries.set(key, { key, name, image: file, status: 'pending', progress: 0 });
        if (entries.size > 100) throw new Error('Mỗi lượt chọn tối đa 100 marker.');
    }
    return [...entries.values()].sort((a, b) =>
        a.name.localeCompare(b.name, 'vi', { numeric: true }),
    );
}
type Api = Pick<ReturnType<typeof createAdminLibraryApi>, 'prepareMarkerUpload' | 'importMarker'>;
type Transfer = (
    signature: MarkerUploadResult['image'],
    file: File,
    signal: AbortSignal,
    progress: (n: number) => void,
) => Promise<void>;
type Compile = (url: string, signal: AbortSignal, progress: (n: number) => void) => Promise<File>;
export async function validateMarkerImage(file: File) {
    let bitmap: ImageBitmap;
    try {
        bitmap = await createImageBitmap(file);
    } catch {
        throw new Error('Không đọc được ảnh. Chọn ảnh PNG, JPG hoặc WebP khác.');
    }
    try {
        if (
            bitmap.width !== bitmap.height ||
            bitmap.width < 128 ||
            bitmap.width * bitmap.height > 16_000_000
        )
            throw new Error('Ảnh marker cần vuông, từ 128 px và không quá 16 triệu điểm ảnh.');
    } finally {
        bitmap.close();
    }
}
export async function registerMarkerImage(
    item: MarkerImportItem,
    isActive: boolean,
    api: Api,
    transfer: Transfer,
    compile: Compile,
    signal: AbortSignal,
    onCheckpoint: (value: MarkerCheckpoint) => void,
    onProgress: (value: number) => void,
    onStage: (stage: 'compiling' | 'uploading') => void,
    validate: (file: File) => Promise<void> = validateMarkerImage,
) {
    signal.throwIfAborted();
    let state = item.checkpoint;
    if (!state) {
        await validate(item.image);
        signal.throwIfAborted();
        onStage('compiling');
        const url = URL.createObjectURL(item.image);
        try {
            const mind = await compile(url, signal, (p) => onProgress(p * 0.55));
            signal.throwIfAborted();
            if (!mind.size || mind.size > 5 * 1024 * 1024)
                throw new Error('Dữ liệu nhận diện vượt 5 MB. Thử ảnh đơn giản hơn.');
            state = { mind, imageDone: false, mindDone: false };
            onCheckpoint(state);
        } finally {
            URL.revokeObjectURL(url);
        }
    }
    signal.throwIfAborted();
    onStage('uploading');
    onProgress(55);
    let signature = state.signature;
    if (
        !signature ||
        (!(state.imageDone && state.mindDone) &&
            Date.parse(signature.image.expiresAt) <= Date.now())
    ) {
        signature = await api.prepareMarkerUpload(
            {
                imageFormat: markerFileFormat(item.image) as 'png' | 'jpg' | 'webp',
                imageBytes: item.image.size,
                mindBytes: state.mind.size,
            },
            signal,
        );
        state = { ...state, signature, imageDone: false, mindDone: false };
        onCheckpoint(state);
    }
    if (!state.imageDone) {
        await transfer(signature.image, item.image, signal, (p) => onProgress(55 + p * 0.2));
        state = { ...state, imageDone: true };
        onCheckpoint(state);
    }
    signal.throwIfAborted();
    if (!state.mindDone) {
        await transfer(signature.mind, state.mind, signal, (p) => onProgress(75 + p * 0.2));
        state = { ...state, mindDone: true };
        onCheckpoint(state);
    }
    signal.throwIfAborted();
    onProgress(95);
    const result = await api.importMarker(
        { imagePublicId: signature.imagePublicId, mindPublicId: signature.mindPublicId, isActive },
        signal,
    );
    onProgress(100);
    return result;
}
