import type { z } from 'zod';
import type { AddPageBody, AddPageResultSchema } from '../../../shared/contracts/api/pages.schema';
import type { UploadCheckpoint } from '../../assets/model/upload';
import { uncertainWrite } from './operations';

type AddPageResult = z.infer<typeof AddPageResultSchema>;
export interface PageImportCheckpoint {
    uncertain?: boolean;
    pages: {
        file?: File;
        upload?: UploadCheckpoint;
        imageAssetId?: string;
        result?: AddPageResult;
    }[];
}
/** One checkpoint belongs to one immutable batch, kept only in the current tab. */
export async function importPages({
    bookId,
    aspect,
    indices,
    checkpoint,
    render,
    upload,
    add,
    checkSession,
    onStage,
    onCheckpoint,
}: {
    bookId: string;
    aspect: number;
    indices: number[];
    checkpoint: PageImportCheckpoint;
    render: (index: number, aspect: number) => Promise<File>;
    upload: (
        file: File,
        checkpoint: UploadCheckpoint | undefined,
        save: (value: UploadCheckpoint) => void,
    ) => Promise<string>;
    add: (id: string, body: AddPageBody) => Promise<AddPageResult>;
    checkSession: () => void;
    onStage: (stage: string) => void;
    onCheckpoint: (value: PageImportCheckpoint) => void;
}) {
    let current = checkpoint;
    const save = (value: PageImportCheckpoint) => {
        current = value;
        onCheckpoint(value);
    };
    if (current.uncertain)
        throw new Error(
            'Chưa xác nhận được trang vừa thêm. Kiểm tra danh sách trang trước khi nhập tiếp.',
        );
    if (!indices.length) throw new Error('Chọn ít nhất một trang.');
    if (!Number.isFinite(aspect) || aspect < 0.2 || aspect > 5)
        throw new Error('Khổ sách không hợp lệ. Hãy kiểm tra thông tin sách.');
    for (const [position, index] of indices.entries()) {
        checkSession();
        if (current.pages[position]?.result) continue;
        onStage(`Đang nhập trang ${position + 1}/${indices.length}…`);
        const savePage = (patch: Partial<PageImportCheckpoint['pages'][number]>) => {
            const pages = [...current.pages];
            pages[position] = { ...pages[position], ...patch };
            save({ ...current, pages });
        };
        if (!current.pages[position]?.imageAssetId) {
            if (!current.pages[position]?.file) savePage({ file: await render(index, aspect) });
            checkSession();
            const page = current.pages[position];
            const id = await upload(page.file as File, page.upload, (upload) =>
                savePage({ upload }),
            );
            savePage({ imageAssetId: id, file: undefined, upload: undefined });
        }
        checkSession();
        try {
            const result = await add(bookId, {
                imageAssetId: current.pages[position].imageAssetId as string,
            });
            savePage({ result });
        } catch (error) {
            if (uncertainWrite(error)) save({ ...current, uncertain: true });
            throw error;
        }
    }
    return { pageId: current.pages[0].result?.page.id as string };
}
