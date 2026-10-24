import type { z } from 'zod';
import type { AddPageBody, AddPageResultSchema } from '../../../shared/contracts/api/pages.schema';
import { uncertainWrite } from './operations';

export interface BlankPageCheckpoint {
    imageAssetId?: string;
    result?: z.infer<typeof AddPageResultSchema>;
    uncertain?: boolean;
}
export function blankPageDimensions(aspect: number) {
    if (!Number.isFinite(aspect) || aspect < 0.2 || aspect > 5)
        throw new Error('Tỉ lệ trang không hợp lệ. Hãy kiểm tra khổ sách.');
    return { width: 1200, height: Math.round(1200 * aspect) };
}
export async function blankPageImage(aspect: number) {
    const { width, height } = blankPageDimensions(aspect);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Chưa chuẩn bị được trang trắng trên trình duyệt này.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((value) => {
            if (value) resolve(value);
            else reject(new Error('Chưa tạo được ảnh trang trắng. Hãy thử lại.'));
        }, 'image/png');
    });
    return new File([blob], 'trang-trang.png', { type: 'image/png' });
}
/** Never replay a non-idempotent POST after its response becomes uncertain. */
export async function createBlankPage({
    bookId,
    afterPageId,
    checkpoint,
    upload,
    add,
    onCheckpoint,
}: {
    bookId: string;
    afterPageId?: string | null;
    checkpoint: BlankPageCheckpoint;
    upload: () => Promise<string>;
    add: (bookId: string, body: AddPageBody) => Promise<z.infer<typeof AddPageResultSchema>>;
    onCheckpoint: (checkpoint: BlankPageCheckpoint) => void;
}) {
    if (checkpoint.uncertain)
        throw new Error(
            'Chưa xác nhận được trang vừa tạo. Hãy tải lại danh sách trước khi tạo tiếp.',
        );
    if (checkpoint.result) return checkpoint.result;
    let current = checkpoint;
    if (!current.imageAssetId) {
        current = { imageAssetId: await upload() };
        onCheckpoint(current);
    }
    try {
        const result = await add(bookId, {
            imageAssetId: current.imageAssetId as string,
            afterPageId,
        });
        onCheckpoint({ ...current, result });
        return result;
    } catch (cause) {
        if (uncertainWrite(cause)) onCheckpoint({ ...current, uncertain: true });
        throw cause;
    }
}
