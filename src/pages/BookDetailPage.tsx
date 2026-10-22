import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
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
    if (detail.isPending) return <p role="status">Đang tải thông tin sách…</p>;
    if (detail.isError && !detail.data)
        return (
            <>
                <h1>Chưa mở được sách</h1>
                <Feedback error={errorMessage(detail.error)} />
                <div className="form-actions">
                    <button
                        type="button"
                        className="button compact"
                        onClick={() => {
                            void detail.refetch();
                        }}
                    >
                        Thử lại
                    </button>
                    <Link to="/books">Về sách của tôi</Link>
                </div>
            </>
        );
    const book = detail.data;
    if (!book) return null;
    return (
        <>
            <div className="page-heading">
                <div>
                    <Link className="back-link" to="/books">
                        Sách của tôi
                    </Link>
                    <h1>{book.title}</h1>
                    <p>
                        {bookStatusLabels[book.status]} · {book.pageCount} trang
                    </p>
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
