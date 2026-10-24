import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { LoadingState } from '@/shared/ui/LoadingState';
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from '@/shared/ui/primitives/empty';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { useAuth } from '../features/auth';
import { bookKeys, booksApi, readBookSearch } from '../features/books';
import { errorMessage } from '../shared/api/errors';
import { Feedback } from '../shared/ui/Feedback';
import { Pagination } from '../shared/ui/Pagination';

export function StatsBooksPage() {
    const { user } = useAuth();
    const [params, setParams] = useSearchParams();
    const query = readBookSearch(
        new URLSearchParams({ q: params.get('q') || '', page: params.get('page') || '1' }),
    );
    const list = useQuery({
        queryKey: bookKeys.list(user?.id || '', 'stats-picker', query),
        queryFn: ({ signal }) => booksApi.list(query, signal),
        enabled: Boolean(user),
    });
    const meta = list.data?.meta;
    const changePage = (page: number) =>
        setParams((current) => {
            const next = new URLSearchParams(current);
            next.set('page', String(page));
            return next;
        });
    useEffect(() => {
        if (list.isSuccess && !list.isFetching && meta && query.page > Math.max(1, meta.totalPages))
            setParams(
                (current) => {
                    const next = new URLSearchParams(current);
                    next.set('page', String(Math.max(1, meta.totalPages)));
                    return next;
                },
                { replace: true },
            );
    }, [list.isSuccess, list.isFetching, meta, query.page, setParams]);
    return (
        <>
            <div className="page-heading [&_h1]:wrap-anywhere mx-0 mt-0 mb-7 flex items-center justify-between gap-6 max-[760px]:mb-6 max-[700px]:flex-wrap max-[700px]:items-start max-[760px]:items-start max-[700px]:gap-3 max-[760px]:gap-4 max-[700px]:[&_>_.button]:max-w-full max-[700px]:[&_>_.button]:flex-[0_0_auto] [&_>_div]:min-w-0 max-[700px]:[&_>_div]:flex-[1_1_180px] [&_h1]:font-semibold [&_h1]:text-[length:28px] [&_h1]:tracking-[-0.025em] max-[700px]:[&_h1]:text-[length:25px] max-[760px]:[&_h1]:text-[length:var(--text-2xl)] [&_p]:mx-0 [&_p]:mt-2 [&_p]:mb-0 [&_p]:max-w-[64ch] [&_p]:text-[length:13px] [&_p]:text-muted-foreground max-[760px]:[&_p]:text-[length:var(--text-sm)] [.page-editor-screen[data-mode=content]_>_&]:hidden [.studio-editing_&]:mb-2 [.studio-editing_&_h1]:ml-4 [.studio-editing_&_h1]:inline [.studio-editing_&_h1]:text-[length:21px] max-[700px]:[.studio-editing_&_h1]:mx-0 max-[700px]:[.studio-editing_&_h1]:mt-[6px] max-[700px]:[.studio-editing_&_h1]:mb-0 max-[700px]:[.studio-editing_&_h1]:block [.studio-editing_&_p]:ml-[14px] [.studio-editing_&_p]:inline [.studio-editing_&_p]:text-[length:11px] max-[700px]:[.studio-editing_&_p]:mx-0 max-[700px]:[.studio-editing_&_p]:my-1 max-[700px]:[.studio-editing_&_p]:block [:where(.studio-main_>_&)]:mx-auto [:where(.studio-main_>_&)]:max-w-375">
                <div>
                    <h1>Thống kê sách</h1>
                    <p>Chọn sách để xem lượt mở, tương tác và thiết bị đọc.</p>
                </div>
            </div>
            <form
                className="insights-search mb-6 flex flex-wrap items-end gap-4 max-[640px]:flex-col max-[640px]:items-stretch [&_input]:w-full [&_label]:m-0 [&_label]:min-w-50 [&_label]:flex-[1] max-[640px]:[&_label]:min-w-0"
                key={query.q || ''}
                onSubmit={(event) => {
                    event.preventDefault();
                    const q = String(new FormData(event.currentTarget).get('q') || '').trim();
                    setParams(q ? { q } : {});
                }}
            >
                <FieldGroup className="contents">
                    <Field orientation="contents">
                        <FieldLabel htmlFor="stats-book-search">
                            Tìm sách của tôi
                            <Input
                                id="stats-book-search"
                                name="q"
                                type="search"
                                maxLength={100}
                                defaultValue={query.q || ''}
                            />
                        </FieldLabel>
                    </Field>
                    <Button type="submit">Tìm sách</Button>
                </FieldGroup>
            </form>
            {list.isPending && <LoadingState>Đang tải sách…</LoadingState>}
            {list.isError && (
                <div className="list-state px-0 py-12">
                    <Feedback error={errorMessage(list.error)} />
                    <Button type="button" onClick={() => void list.refetch()}>
                        Thử tải lại
                    </Button>
                </div>
            )}
            {list.isSuccess && (
                <>
                    <p
                        className="mx-0 mt-0 mb-3 flex list-summary justify-between gap-4 text-[length:12px] text-muted-foreground [:where(.studio-main_>_&)]:mx-auto [:where(.studio-main_>_&)]:max-w-375"
                        role="status"
                    >
                        {list.data.meta.total} cuốn sách
                    </p>
                    {list.data.data.length ? (
                        <ul className="insights-book-list [&_h2]:wrap-anywhere m-0 list-none p-0 [&_>_li]:flex [&_>_li]:items-center [&_>_li]:justify-between [&_>_li]:gap-5 [&_>_li]:border-b-[1px] [&_>_li]:border-b-border [&_>_li]:py-5 [&_>_li]:[border-bottom-style:solid] max-[640px]:[&_>_li]:flex-col max-[640px]:[&_>_li]:items-start max-[640px]:[&_>_li]:gap-3 [&_h2]:mx-0 [&_h2]:mt-0 [&_h2]:mb-2 [&_h2]:text-[length:var(--text-md)] [&_p]:m-0 [&_p]:text-[length:var(--text-sm)] [&_p]:text-muted-foreground">
                            {list.data.data.map((book) => (
                                <li key={book.id}>
                                    <div>
                                        <h2>
                                            <Link to={`/books/${book.id}/stats`}>{book.title}</Link>
                                        </h2>
                                        <p>{book.pageCount} trang</p>
                                    </div>
                                    <Button variant="secondary" asChild>
                                        <Link to={`/books/${book.id}/stats`}>
                                            Xem thống kê
                                            <span className="sr-only [.editor-page-strip_a.strip-add-page_>_span:not(&)]:[position:static] [.editor-page-strip_a_>_span:not(&)]:absolute [.editor-page-strip_a_>_span:not(&)]:right-[-1px] [.editor-page-strip_a_>_span:not(&)]:bottom-[-1px] [.editor-page-strip_a_>_span:not(&)]:rounded-[3px] [.editor-page-strip_a_>_span:not(&)]:bg-surface [.editor-page-strip_a_>_span:not(&)]:px-[5px] [.editor-page-strip_a_>_span:not(&)]:py-0 [.editor-page-strip_a_>_span:not(&)]:text-[length:10px] [.editor-page-strip_a_>_span:not(&)]:text-foreground">
                                                {' '}
                                                {book.title}
                                            </span>
                                        </Link>
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <Empty className="empty-state border-border border-t px-5 py-16 max-[760px]:px-3 max-[760px]:py-12">
                            <EmptyHeader>
                                <EmptyTitle>
                                    <h2>
                                        {query.q
                                            ? 'Không tìm thấy sách phù hợp'
                                            : 'Bạn chưa có sách'}
                                    </h2>
                                </EmptyTitle>
                            </EmptyHeader>
                            <EmptyContent>
                                <Link to={query.q ? '/stats' : '/books/new'}>
                                    {query.q ? 'Xóa tìm kiếm' : 'Tạo sách đầu tiên'}
                                </Link>
                            </EmptyContent>
                        </Empty>
                    )}
                    <Pagination
                        page={query.page}
                        totalPages={list.data.meta.totalPages}
                        onPage={changePage}
                        label="Phân trang chọn sách thống kê"
                    />
                </>
            )}
        </>
    );
}
