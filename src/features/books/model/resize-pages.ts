import type { z } from 'zod';
import type {
    PageImageReplacement,
    UpdateBookBody,
} from '../../../shared/contracts/api/books.schema';
import type { BookPageLayoutsSchema } from '../../../shared/contracts/api/pages.schema';
import type { BookDetail } from '../../../shared/contracts/dto.schema';
import type { MindCheckpoint } from '../../pages/model/marker-upload';

export type BookResizeState = Record<string, { mind: MindCheckpoint | null }>;
export function requestedPageAspect(
    book: Pick<BookDetail, 'pageFormat' | 'pageAspect'>,
    body: UpdateBookBody,
): number {
    const format = body.pageFormat ?? book.pageFormat;
    if (format === 'CUSTOM') return body.pageAspect ?? book.pageAspect;
    if (format === book.pageFormat) return book.pageAspect;
    // These are the fixed-format values stored by the backend, including its four-place precision.
    // biome-ignore lint/suspicious/noApproximativeNumericConstant: must match the stored A4 API ratio.
    return { A4: 1.4142, A5: 1.4189, SQUARE: 1 }[format];
}

/** No image upload: only recognition data changes before one atomic geometry save. */
export async function prepareBookResize({
    book,
    body,
    state,
    layouts,
    prepareMind,
    signal,
    onStage,
}: {
    book: BookDetail;
    body: UpdateBookBody;
    state: BookResizeState;
    layouts: (
        bookId: string,
        aspect: number,
        signal: AbortSignal,
    ) => Promise<z.infer<typeof BookPageLayoutsSchema>>;
    prepareMind: (url: string, state: BookResizeState[string]) => Promise<string>;
    signal: AbortSignal;
    onStage: (text: string) => void;
}): Promise<Pick<UpdateBookBody, 'expectedPageAspect' | 'pageImages'>> {
    const aspect = requestedPageAspect(book, body);
    if (Math.abs(aspect - book.pageAspect) < 0.000001 || !book.pages.length) return {};
    signal.throwIfAborted();
    onStage('Đang cập nhật khổ trang…');
    const plan = await layouts(book.id, aspect, signal);
    signal.throwIfAborted();
    if (Math.abs(plan.pageAspect - book.pageAspect) > 0.000001)
        throw new Error('Khổ sách đã được sửa ở nơi khác. Hãy mở lại thông tin sách.');
    const pageImages: PageImageReplacement[] = [];
    for (const [index, page] of plan.pages.entries()) {
        signal.throwIfAborted();
        onStage(`Đang cập nhật trang ${index + 1}/${plan.pages.length}…`);
        const key = `${page.pageId}:${page.expectedImageAssetId}:${page.layout.url}`;
        const pending = state[key] ?? { mind: null };
        state[key] = pending;
        const markerMindPublicId =
            page.markerMode === 'CUSTOM_MARKER'
                ? await prepareMind(page.layout.url, pending)
                : undefined;
        signal.throwIfAborted();
        pageImages.push({
            pageId: page.pageId,
            expectedImageAssetId: page.expectedImageAssetId,
            expectedMarkerMode: page.markerMode,
            ...(markerMindPublicId ? { markerMindPublicId } : {}),
        });
    }
    return { expectedPageAspect: plan.pageAspect, ...(pageImages.length ? { pageImages } : {}) };
}
