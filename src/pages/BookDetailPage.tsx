import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { LoadingState } from '@/shared/ui/LoadingState';
import { ImageUploadEditor } from '../features/assets';
import { auth, useAuth } from '../features/auth';
import { BookForm, bookKeys, bookStatusLabels, booksApi, updateBookForm } from '../features/books';
import { BookPages } from '../features/pages';
import { profileKey } from '../features/profile';
import { PublicationPanel } from '../features/publication/ui/PublicationPanel';
import { errorMessage } from '../shared/api/errors';
import { IdSchema } from '../shared/contracts/common.schema';
import type { BookDetail } from '../shared/contracts/dto.schema';
import { Feedback } from '../shared/ui/Feedback';

function BookDetailContent({ bookId }: { bookId: string }) {
    const { user } = useAuth();
    const location = useLocation();
    const cache = useQueryClient();
    const valid = IdSchema.safeParse(bookId).success;
    const [error, setError] = useState<string | null>(null);
    const [coverBusy, setCoverBusy] = useState(false);
    const [pagesBusy, setPagesBusy] = useState(false);
    const [publicationBusy, setPublicationBusy] = useState(false);
    const [metadataDirty, setMetadataDirty] = useState(false);
    const [success, setSuccess] = useState<string | null>(
        location.state?.created ? 'Đã tạo sách trống thành công.' : null,
    );
    const detail = useQuery({
        queryKey: bookKeys.detail(user?.id || '', bookId),
        queryFn: ({ signal }) => booksApi.detail(bookId, signal),
        enabled: valid && Boolean(user),
        refetchOnWindowFocus: false,
    });
    const mutation = useMutation({
        mutationFn: (form: FormData) => booksApi.update(bookId, updateBookForm(form)),
    });
    async function save(form: FormData) {
        setError(null);
        setSuccess(null);
        try {
            await mutation.mutateAsync(form);
            if (auth.store.getState().user?.id !== user?.id) return;
            setMetadataDirty(false);
            await cache.invalidateQueries({ queryKey: bookKeys.all });
            setSuccess('Đã lưu thông tin sách.');
        } catch (cause) {
            setError(errorMessage(cause));
        }
    }
    if (!valid)
        return (
            <>
                <h1>Không tìm thấy sách</h1>
                <p>Đường dẫn sách không hợp lệ.</p>
                <Link to="/books">Về sách của tôi</Link>
            </>
        );
    if (detail.isPending) return <LoadingState>Đang tải thông tin sách…</LoadingState>;
    if (detail.isError && !detail.data)
        return (
            <>
                <h1>Chưa mở được sách</h1>
                <Feedback error={errorMessage(detail.error)} />
                <div className="form-actions mt-3 flex flex-wrap items-center gap-5 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-4 max-[760px]:[&_>_a]:text-center [.confirm-dialog_&]:mt-6 [.confirm-dialog_&]:justify-end max-[760px]:[.confirm-dialog_&]:flex-row max-[760px]:[.confirm-dialog_&]:flex-wrap [.image-editor_&:empty]:hidden [.scene-object-asset_&]:gap-2">
                    <Button
                        type="button"
                        onClick={() => {
                            void detail.refetch();
                        }}
                    >
                        Thử lại
                    </Button>
                    <Link to="/books">Về sách của tôi</Link>
                </div>
            </>
        );
    const book = detail.data;
    if (!book) return null;
    return (
        <>
            <div className="page-heading [&_h1]:wrap-anywhere mx-0 mt-0 mb-7 flex items-center justify-between gap-6 max-[760px]:mb-6 max-[700px]:flex-wrap max-[700px]:items-start max-[760px]:items-start max-[700px]:gap-3 max-[760px]:gap-4 max-[700px]:[&_>_.button]:max-w-full max-[700px]:[&_>_.button]:flex-[0_0_auto] [&_>_div]:min-w-0 max-[700px]:[&_>_div]:flex-[1_1_180px] [&_h1]:font-semibold [&_h1]:text-[length:28px] [&_h1]:tracking-[-0.025em] max-[700px]:[&_h1]:text-[length:25px] max-[760px]:[&_h1]:text-[length:var(--text-2xl)] [&_p]:mx-0 [&_p]:mt-2 [&_p]:mb-0 [&_p]:max-w-[64ch] [&_p]:text-[length:13px] [&_p]:text-muted-foreground max-[760px]:[&_p]:text-[length:var(--text-sm)] [.page-editor-screen[data-mode=content]_>_&]:hidden [.studio-editing_&]:mb-2 [.studio-editing_&_h1]:ml-4 [.studio-editing_&_h1]:inline [.studio-editing_&_h1]:text-[length:21px] max-[700px]:[.studio-editing_&_h1]:mx-0 max-[700px]:[.studio-editing_&_h1]:mt-[6px] max-[700px]:[.studio-editing_&_h1]:mb-0 max-[700px]:[.studio-editing_&_h1]:block [.studio-editing_&_p]:ml-[14px] [.studio-editing_&_p]:inline [.studio-editing_&_p]:text-[length:11px] max-[700px]:[.studio-editing_&_p]:mx-0 max-[700px]:[.studio-editing_&_p]:my-1 max-[700px]:[.studio-editing_&_p]:block [:where(.studio-main_>_&)]:mx-auto [:where(.studio-main_>_&)]:max-w-375">
                <div>
                    <Link
                        className="back-link mb-4 inline-block text-[length:var(--text-sm)] [.studio-editing_&]:inline [.studio-editing_&]:text-[length:12px]"
                        to="/books"
                    >
                        Sách của tôi
                    </Link>
                    <h1>{book.title}</h1>
                    <p>
                        {bookStatusLabels[book.status]} · {book.pageCount} trang
                    </p>
                    <Link to={`/books/${book.id}/stats`}>Xem thống kê sách</Link>
                </div>
            </div>
            {book.takenDown && (
                <Feedback error="Sách đang bị gỡ. Một số thao tác có thể bị hạn chế." />
            )}
            {detail.isError && (
                <Feedback
                    error={`Chưa cập nhật được trạng thái sách. ${errorMessage(detail.error)}`}
                />
            )}
            <ImageUploadEditor
                key={`cover-${book.id}`}
                kind="cover"
                currentUrl={book.coverUrl}
                disabled={mutation.isPending || pagesBusy || publicationBusy}
                onBusyChange={setCoverBusy}
                onUploaded={() => {
                    void cache.invalidateQueries({ queryKey: profileKey(user?.id || '') });
                }}
                onSave={async (coverAssetId) => {
                    await cache.cancelQueries({ queryKey: bookKeys.all });
                    const saved = await booksApi.update(bookId, { coverAssetId });
                    if (auth.store.getState().user?.id !== user?.id) return;
                    cache.setQueryData<BookDetail>(
                        bookKeys.detail(user?.id || '', bookId),
                        (current) =>
                            current
                                ? {
                                      ...current,
                                      coverUrl: saved.coverUrl,
                                      updatedAt: saved.updatedAt,
                                  }
                                : current,
                    );
                    void cache.invalidateQueries({ queryKey: bookKeys.all });
                }}
            />
            <BookForm
                key={book.id}
                book={book}
                busy={mutation.isPending || coverBusy || pagesBusy || publicationBusy}
                onDirtyChange={setMetadataDirty}
                error={error}
                success={success}
                onSubmit={(form) => {
                    void save(form);
                }}
            />
            <BookPages
                bookId={bookId}
                disabled={mutation.isPending || coverBusy || publicationBusy}
                onBusyChange={setPagesBusy}
            />
            <PublicationPanel
                key={`${user?.id}:${bookId}`}
                book={book}
                disabled={mutation.isPending || coverBusy || pagesBusy || detail.isError}
                unsaved={metadataDirty}
                onBusyChange={setPublicationBusy}
            />
        </>
    );
}

export function BookDetailPage() {
    const { bookId = '' } = useParams();
    return <BookDetailContent key={bookId} bookId={bookId} />;
}
