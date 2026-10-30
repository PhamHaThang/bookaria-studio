import { useQuery } from '@tanstack/react-query';
import { BookOpen, CircleAlert, Library, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../features/auth';
import { useBookDraft } from '../features/book-draft/ui/BookDraftProvider';
import { bookKeys, booksApi } from '../features/books';
import { EmptyBookEditor } from '../features/scene/ui/EmptyBookEditor';
import { errorMessage } from '../shared/api/errors';
import { IdSchema } from '../shared/contracts/common.schema';
import { BookariaLogo } from '../shared/ui/BookariaLogo';
import { Button } from '../shared/ui/Button';
import { LoadingScreen } from '../shared/ui/LoadingScreen';
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '../shared/ui/primitives/empty';
import { Spinner } from '../shared/ui/primitives/spinner';

/** Resolve the current first page on demand; opening an editor never creates a page. */
function BookEditorContent({ bookId }: { bookId: string }) {
    const { user } = useAuth();
    const { state } = useBookDraft();
    const draftPages = state.working?.pages || [];
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
            setEntry(draftPages.length ? 'pages' : 'empty');
    }, [entry, book.isSuccess, book.isFetching, draftPages.length]);
    if (!valid || (book.isError && (entry !== 'empty' || !book.data)))
        return (
            <section
                aria-labelledby="editor-error-heading"
                className="relative grid min-h-dvh w-full place-items-center bg-surface px-6 py-24"
            >
                <Link
                    to="/"
                    aria-label="Bookaria - Trang chủ"
                    className="absolute top-8 left-10 inline-flex"
                >
                    <BookariaLogo />
                </Link>
                <Empty className="max-w-xl gap-8 p-0">
                    <EmptyHeader className="gap-5">
                        <EmptyMedia className="relative mb-1" aria-hidden="true">
                            <BookOpen className="size-16" strokeWidth={1.25} />
                            <CircleAlert
                                className="absolute -right-2 -bottom-1 size-7 bg-surface text-destructive"
                                strokeWidth={1.5}
                            />
                        </EmptyMedia>
                        <EmptyTitle>
                            <h1 id="editor-error-heading">Chưa mở được editor</h1>
                        </EmptyTitle>
                        <EmptyDescription className="flex flex-col gap-2">
                            <p role="alert">
                                {valid ? errorMessage(book.error) : 'Đường dẫn sách không hợp lệ.'}
                            </p>
                            <p>Thử tải lại hoặc quay về danh sách sách để tiếp tục.</p>
                        </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent className="max-w-none">
                        <div className="flex flex-wrap justify-center gap-3">
                            {valid && (
                                <Button
                                    disabled={book.isFetching}
                                    aria-busy={book.isFetching}
                                    onClick={() => void book.refetch()}
                                    className="min-w-40"
                                >
                                    {book.isFetching ? (
                                        <Spinner data-icon="inline-start" />
                                    ) : (
                                        <RefreshCw data-icon="inline-start" aria-hidden="true" />
                                    )}
                                    {book.isFetching ? 'Đang tải lại…' : 'Thử lại'}
                                </Button>
                            )}
                            <Button variant="secondary" asChild>
                                <Link to="/books">
                                    <Library data-icon="inline-start" aria-hidden="true" />
                                    Về sách của tôi
                                </Link>
                            </Button>
                        </div>
                    </EmptyContent>
                </Empty>
            </section>
        );
    if (book.isPending || !entry || !book.data)
        return <LoadingScreen fullScreen message="Đang mở editor…" />;
    if (entry === 'empty')
        return (
            <EmptyBookEditor
                book={{
                    ...book.data,
                    pages: draftPages,
                    pageCount: draftPages.length,
                    ...state.base?.geometry,
                }}
            />
        );

    const firstPage = draftPages.reduce<(typeof book.data.pages)[number] | undefined>(
        (first, page) => (!first || page.orderIndex < first.orderIndex ? page : first),
        undefined,
    );
    return firstPage ? (
        <Navigate to={`/books/${bookId}/pages/${firstPage.id}`} replace />
    ) : (
        <EmptyBookEditor
            book={{
                ...book.data,
                pages: draftPages,
                pageCount: draftPages.length,
                ...state.base?.geometry,
            }}
        />
    );
}

export function BookEditorPage() {
    const { bookId = '' } = useParams();
    return <BookEditorContent key={bookId} bookId={bookId} />;
}
