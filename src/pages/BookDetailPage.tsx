import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ImageUploadEditor } from '../features/assets';
import { auth, useAuth } from '../features/auth';
import { BookForm, bookKeys, bookStatusLabels, booksApi, updateBookForm } from '../features/books';
import { profileKey } from '../features/profile';
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
    if (detail.isError)
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
            <ImageUploadEditor
                key={`cover-${book.id}`}
                kind="cover"
                currentUrl={book.coverUrl}
                disabled={mutation.isPending}
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
                busy={mutation.isPending || coverBusy}
                error={error}
                success={success}
                onSubmit={(form) => {
                    void save(form);
                }}
            />
            <section className="pages-overview">
                <h2>Trang sách</h2>
                {book.pages.length ? (
                    <ol>
                        {book.pages.map((page) => (
                            <li key={page.id}>
                                {page.title || `Trang ${page.orderIndex + 1}`} · {page.objectCount}{' '}
                                đối tượng
                            </li>
                        ))}
                    </ol>
                ) : (
                    <p>
                        Sách chưa có trang. Bạn có thể hoàn thiện thông tin sách trước khi thêm nội
                        dung.
                    </p>
                )}
            </section>
        </>
    );
}

export function BookDetailPage() {
    const { bookId = '' } = useParams();
    return <BookDetailContent key={bookId} bookId={bookId} />;
}
