import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../features/auth';
import { bookKeys, booksApi } from '../features/books';
import { EmptyBookEditor } from '../features/scene/ui/EmptyBookEditor';
import { errorMessage } from '../shared/api/errors';
import { IdSchema } from '../shared/contracts/common.schema';
import { Button } from '../shared/ui/Button';
import { Feedback } from '../shared/ui/Feedback';
import { LoadingScreen } from '../shared/ui/LoadingScreen';

/** Resolve the current first page on demand; opening an editor never creates a page. */
function BookEditorContent({ bookId }: { bookId: string }) {
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

    const [entry, setEntry] = useState<'empty' | 'pages' | null>(null);
    useEffect(() => {
        if (!entry && book.isSuccess && !book.isFetching)
            setEntry(book.data.pages.length ? 'pages' : 'empty');
    }, [entry, book.isSuccess, book.isFetching, book.data]);
    if (!valid || (book.isError && (entry !== 'empty' || !book.data)))
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
    if (book.isPending || !entry || !book.data)
        return <LoadingScreen fullScreen message="Đang mở editor…" />;
    if (entry === 'empty') return <EmptyBookEditor book={book.data} />;

    const firstPage = book.data.pages.reduce<(typeof book.data.pages)[number] | undefined>(
        (first, page) => (!first || page.orderIndex < first.orderIndex ? page : first),
        undefined,
    );
    return firstPage ? (
        <Navigate to={`/books/${bookId}/pages/${firstPage.id}`} replace />
    ) : (
        <EmptyBookEditor book={book.data} />
    );
}

export function BookEditorPage() {
    const { bookId = '' } = useParams();
    return <BookEditorContent key={bookId} bookId={bookId} />;
}
