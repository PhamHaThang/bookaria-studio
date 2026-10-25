import { useQuery } from '@tanstack/react-query';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../features/auth';
import { bookKeys, booksApi } from '../features/books';
import { errorMessage } from '../shared/api/errors';
import { IdSchema } from '../shared/contracts/common.schema';
import { Button } from '../shared/ui/Button';
import { Feedback } from '../shared/ui/Feedback';
import { LoadingState } from '../shared/ui/LoadingState';

/** Resolve the current first page on demand; opening an editor never creates a page. */
export function BookEditorPage() {
    const { bookId = '' } = useParams();
    const { user } = useAuth();
    const valid = IdSchema.safeParse(bookId).success;
    const book = useQuery({
        queryKey: bookKeys.detail(user?.id || '', bookId),
        queryFn: ({ signal }) => booksApi.detail(bookId, signal),
        enabled: valid && Boolean(user),
        retry: false,
        refetchOnMount: 'always',
        refetchOnWindowFocus: false,
    });

    if (!valid || book.isError)
        return (
            <div className="flex max-w-160 flex-col items-start gap-4">
                <h1>Chưa mở được editor</h1>
                <Feedback
                    error={valid ? errorMessage(book.error) : 'Đường dẫn sách không hợp lệ.'}
                />
                <div className="flex flex-wrap gap-3">
                    {valid && <Button onClick={() => void book.refetch()}>Thử lại</Button>}
                    <Button variant="secondary" asChild>
                        <Link to="/books">Về sách của tôi</Link>
                    </Button>
                </div>
            </div>
        );
    if (book.isPending || book.isFetching) return <LoadingState>Đang mở editor…</LoadingState>;

    const firstPage = book.data.pages.reduce<(typeof book.data.pages)[number] | undefined>(
        (first, page) => (!first || page.orderIndex < first.orderIndex ? page : first),
        undefined,
    );
    return (
        <Navigate
            to={firstPage ? `/books/${bookId}/pages/${firstPage.id}` : `/books/${bookId}`}
            replace
        />
    );
}
