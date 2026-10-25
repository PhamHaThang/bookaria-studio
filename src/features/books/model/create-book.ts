import type { z } from 'zod';
import type { CreateBookBody } from '../../../shared/contracts/api/books.schema';
import type { AddPageBody, AddPageResultSchema } from '../../../shared/contracts/api/pages.schema';
import type { UploadCheckpoint } from '../../assets/model/upload';
import { importPages, type PageImportCheckpoint } from '../../pages/model/import-pages';
import { uncertainWrite } from '../../pages/model/operations';

type AddPageResult = z.infer<typeof AddPageResultSchema>;

export interface CreationCheckpoint extends PageImportCheckpoint {
    bookId?: string;
    aspect?: number;
}
/** Checkpoints belong to one immutable form submission, in this tab only. */
export async function createBookWithPages({
    body,
    indices,
    checkpoint,
    create,
    detail,
    render,
    upload,
    add,
    checkSession,
    onStage,
    onCheckpoint,
}: {
    body: CreateBookBody;
    indices: number[];
    checkpoint: CreationCheckpoint;
    create: (body: CreateBookBody) => Promise<{ book: { id: string } }>;
    detail: (id: string) => Promise<{ pageAspect: number }>;
    render: (index: number, aspect: number) => Promise<File>;
    upload: (
        file: File,
        checkpoint: UploadCheckpoint | undefined,
        save: (value: UploadCheckpoint) => void,
    ) => Promise<string>;
    add: (id: string, body: AddPageBody) => Promise<AddPageResult>;
    checkSession: () => void;
    onStage: (stage: string) => void;
    onCheckpoint: (value: CreationCheckpoint) => void;
}) {
    let current = checkpoint;
    const save = (value: CreationCheckpoint) => {
        current = value;
        onCheckpoint(current);
    };
    if (current.uncertain)
        throw new Error('Chưa xác nhận được kết quả. Mở sách để kiểm tra trước khi nhập tiếp.');
    if (!indices.length) throw new Error('Chọn ít nhất một trang.');
    checkSession();
    if (!current.bookId) {
        onStage('Đang tạo sách…');
        try {
            const result = await create(body);
            save({ ...current, bookId: result.book.id });
        } catch (error) {
            if (uncertainWrite(error)) save({ ...current, uncertain: true });
            throw error;
        }
    }
    checkSession();
    if (current.aspect === undefined) {
        const book = await detail(current.bookId as string);
        save({ ...current, aspect: book.pageAspect });
    }
    await importPages({
        bookId: current.bookId as string,
        aspect: current.aspect as number,
        indices,
        checkpoint: current,
        render,
        upload,
        add,
        checkSession,
        onStage,
        onCheckpoint: (value) => save({ ...current, ...value }),
    });
    return { bookId: current.bookId as string, pageId: current.pages[0].result?.page.id as string };
}
