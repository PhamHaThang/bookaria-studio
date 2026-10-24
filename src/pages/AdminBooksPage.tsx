import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/shared/ui/primitives/empty';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { NativeSelect } from '@/shared/ui/primitives/native-select';
import {
    adminApi,
    adminDate,
    adminKeys,
    readAdminBooksSearch,
    readAdminQueueSearch,
    reportLabel,
    visibilityLabel,
} from '../features/admin';
import { AdminPager, AdminReload } from '../features/admin/ui';
import { useAuth } from '../features/auth';
import { errorMessage } from '../shared/api/errors';
import { Badge } from '../shared/ui/Badge';
import { Feedback } from '../shared/ui/Feedback';

export function AdminModerationPage() {
    const { user } = useAuth(),
        [params] = useSearchParams(),
        query = readAdminQueueSearch(params);
    const list = useQuery({
        queryKey: adminKeys.queue(user?.id || '', query),
        queryFn: ({ signal }) => adminApi.moderation(query, signal),
        retry: false,
    });
    return (
        <>
            <div className="page-heading insights-heading [&_h1]:wrap-anywhere mx-0 mt-0 mb-7 flex items-center justify-between gap-6 max-[760px]:mb-6 max-[640px]:flex-col max-[700px]:flex-wrap max-[640px]:items-start max-[700px]:items-start max-[760px]:items-start max-[700px]:gap-3 max-[760px]:gap-4 max-[700px]:[&_>_.button]:max-w-full max-[700px]:[&_>_.button]:flex-[0_0_auto] [&_>_div]:min-w-0 max-[640px]:[&_>_div]:w-full max-[700px]:[&_>_div]:flex-[1_1_180px] [&_h1]:font-semibold [&_h1]:text-[length:28px] [&_h1]:tracking-[-0.025em] max-[700px]:[&_h1]:text-[length:25px] max-[760px]:[&_h1]:text-[length:var(--text-2xl)] [&_p]:mx-0 [&_p]:mt-2 [&_p]:mb-0 [&_p]:max-w-[64ch] [&_p]:text-[length:13px] [&_p]:text-muted-foreground max-[760px]:[&_p]:text-[length:var(--text-sm)] [.page-editor-screen[data-mode=content]_>_&]:hidden [.studio-editing_&]:mb-2 [.studio-editing_&_h1]:ml-4 [.studio-editing_&_h1]:inline [.studio-editing_&_h1]:text-[length:21px] max-[700px]:[.studio-editing_&_h1]:mx-0 max-[700px]:[.studio-editing_&_h1]:mt-[6px] max-[700px]:[.studio-editing_&_h1]:mb-0 max-[700px]:[.studio-editing_&_h1]:block [.studio-editing_&_p]:ml-[14px] [.studio-editing_&_p]:inline [.studio-editing_&_p]:text-[length:11px] max-[700px]:[.studio-editing_&_p]:mx-0 max-[700px]:[.studio-editing_&_p]:my-1 max-[700px]:[.studio-editing_&_p]:block [:where(.studio-main_>_&)]:mx-auto [:where(.studio-main_>_&)]:max-w-375">
                <div>
                    <h1>Báo cáo chờ xử lý</h1>
                    <p>Nhóm các báo cáo đang mở theo sách.</p>
                </div>
                <AdminReload retry={() => void list.refetch()} busy={list.isFetching} />
            </div>
            {list.isPending && <p role="status">Đang tải báo cáo…</p>}
            {list.isError && <Feedback error={errorMessage(list.error)} />}
            {list.isSuccess && (
                <>
                    <p role="status">{list.data.meta.total} sách có báo cáo đang mở</p>
                    {list.data.data.length ? (
                        <ul className="admin-rows [&_>_li]:wrap-anywhere mx-0 my-4 list-none p-0 [&_>_li]:flex [&_>_li]:items-start [&_>_li]:justify-between [&_>_li]:gap-5 [&_>_li]:border-b-[1px] [&_>_li]:border-b-border [&_>_li]:py-5 [&_>_li]:[border-bottom-style:solid] max-[640px]:[&_>_li]:flex-col max-[640px]:[&_>_li]:gap-3 [&_h2]:mx-0 [&_h2]:mt-0 [&_h2]:mb-2 [&_h2]:text-[length:var(--text-md)] [&_h3]:mx-0 [&_h3]:mt-0 [&_h3]:mb-2 [&_h3]:text-[length:var(--text-md)] [&_p]:mx-0 [&_p]:my-2">
                            {list.data.data.map((item) => (
                                <li key={item.book.id}>
                                    <div>
                                        <h2>
                                            <Link to={`/admin/books/${item.book.id}`}>
                                                {item.book.title}
                                            </Link>
                                        </h2>
                                        <p>Tác giả: {item.book.author.displayName}</p>
                                        <p>
                                            {item.reasons
                                                .map((reason) => reportLabel[reason])
                                                .join(', ')}
                                        </p>
                                        <div className="admin-metadata flex flex-wrap items-center gap-3 text-[length:var(--text-sm)] text-muted-foreground">
                                            <Badge tone="warning">{item.reportCount} báo cáo</Badge>
                                            <span>Gần nhất: {adminDate(item.lastReportedAt)}</span>
                                        </div>
                                    </div>
                                    <Button variant="secondary" asChild>
                                        <Link to={`/admin/books/${item.book.id}`}>
                                            Xem và xử lý
                                            <span className="sr-only [.editor-page-strip_a.strip-add-page_>_span:not(&)]:[position:static] [.editor-page-strip_a_>_span:not(&)]:absolute [.editor-page-strip_a_>_span:not(&)]:right-[-1px] [.editor-page-strip_a_>_span:not(&)]:bottom-[-1px] [.editor-page-strip_a_>_span:not(&)]:rounded-[3px] [.editor-page-strip_a_>_span:not(&)]:bg-surface [.editor-page-strip_a_>_span:not(&)]:px-[5px] [.editor-page-strip_a_>_span:not(&)]:py-0 [.editor-page-strip_a_>_span:not(&)]:text-[length:10px] [.editor-page-strip_a_>_span:not(&)]:text-foreground">
                                                {' '}
                                                {item.book.title}
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
                                    <h2>Không có báo cáo đang chờ</h2>
                                </EmptyTitle>
                                <EmptyDescription>
                                    <p>Báo cáo mới từ người đọc sẽ xuất hiện ở đây.</p>
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    )}
                    <AdminPager page={query.page} meta={list.data.meta} />
                </>
            )}
        </>
    );
}
export function AdminBooksPage() {
    const { user } = useAuth(),
        [params, setParams] = useSearchParams(),
        query = readAdminBooksSearch(params);
    const list = useQuery({
        queryKey: adminKeys.books(user?.id || '', query),
        queryFn: ({ signal }) => adminApi.books(query, signal),
        retry: false,
    });
    return (
        <>
            <div className="page-heading insights-heading [&_h1]:wrap-anywhere mx-0 mt-0 mb-7 flex items-center justify-between gap-6 max-[760px]:mb-6 max-[640px]:flex-col max-[700px]:flex-wrap max-[640px]:items-start max-[700px]:items-start max-[760px]:items-start max-[700px]:gap-3 max-[760px]:gap-4 max-[700px]:[&_>_.button]:max-w-full max-[700px]:[&_>_.button]:flex-[0_0_auto] [&_>_div]:min-w-0 max-[640px]:[&_>_div]:w-full max-[700px]:[&_>_div]:flex-[1_1_180px] [&_h1]:font-semibold [&_h1]:text-[length:28px] [&_h1]:tracking-[-0.025em] max-[700px]:[&_h1]:text-[length:25px] max-[760px]:[&_h1]:text-[length:var(--text-2xl)] [&_p]:mx-0 [&_p]:mt-2 [&_p]:mb-0 [&_p]:max-w-[64ch] [&_p]:text-[length:13px] [&_p]:text-muted-foreground max-[760px]:[&_p]:text-[length:var(--text-sm)] [.page-editor-screen[data-mode=content]_>_&]:hidden [.studio-editing_&]:mb-2 [.studio-editing_&_h1]:ml-4 [.studio-editing_&_h1]:inline [.studio-editing_&_h1]:text-[length:21px] max-[700px]:[.studio-editing_&_h1]:mx-0 max-[700px]:[.studio-editing_&_h1]:mt-[6px] max-[700px]:[.studio-editing_&_h1]:mb-0 max-[700px]:[.studio-editing_&_h1]:block [.studio-editing_&_p]:ml-[14px] [.studio-editing_&_p]:inline [.studio-editing_&_p]:text-[length:11px] max-[700px]:[.studio-editing_&_p]:mx-0 max-[700px]:[.studio-editing_&_p]:my-1 max-[700px]:[.studio-editing_&_p]:block [:where(.studio-main_>_&)]:mx-auto [:where(.studio-main_>_&)]:max-w-375">
                <div>
                    <h1>Tra cứu sách</h1>
                    <p>Tìm sách theo quyền hiển thị để xem nội dung và lịch sử báo cáo.</p>
                </div>
                <AdminReload retry={() => void list.refetch()} busy={list.isFetching} />
            </div>
            <form
                className="admin-filters mb-5 flex flex-wrap items-end gap-4 max-[640px]:flex-col max-[640px]:items-stretch [&_input]:w-full [&_label]:m-0 [&_label]:flex-[1_1_150px] max-[640px]:[&_label]:w-full max-[640px]:[&_label]:flex-[auto] [&_select]:w-full"
                key={params.toString()}
                onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    const q = String(data.get('q') || '').trim(),
                        visibility = String(data.get('visibility') || 'PUBLIC');
                    setParams({ ...(q ? { q } : {}), visibility });
                }}
            >
                <FieldGroup className="contents">
                    <Field orientation="contents">
                        <FieldLabel htmlFor="admin-book-q">
                            Tên sách
                            <Input
                                id="admin-book-q"
                                name="q"
                                type="search"
                                defaultValue={query.q}
                                maxLength={100}
                            />
                        </FieldLabel>
                    </Field>
                    <Field orientation="contents">
                        <FieldLabel htmlFor="admin-book-visibility">
                            Quyền hiển thị
                            <NativeSelect
                                id="admin-book-visibility"
                                name="visibility"
                                defaultValue={query.visibility}
                            >
                                <option value="PUBLIC">Công khai</option>
                                <option value="UNLISTED">Qua liên kết</option>
                                <option value="PRIVATE">Riêng tư</option>
                            </NativeSelect>
                        </FieldLabel>
                    </Field>
                    <Button type="submit">Tìm sách</Button>
                </FieldGroup>
            </form>
            <p className="stats-note max-w-[75ch] text-[length:var(--text-sm)] text-muted-foreground [.admin-form_&]:mb-4">
                Sách bị gỡ được chuyển sang riêng tư. Chọn “Riêng tư” để tra cứu và khôi phục.
            </p>
            {list.isPending && <p role="status">Đang tải sách…</p>}
            {list.isError && <Feedback error={errorMessage(list.error)} />}
            {list.isSuccess && (
                <>
                    <p role="status">{list.data.meta.total} sách</p>
                    {list.data.data.length ? (
                        <ul className="admin-rows [&_>_li]:wrap-anywhere mx-0 my-4 list-none p-0 [&_>_li]:flex [&_>_li]:items-start [&_>_li]:justify-between [&_>_li]:gap-5 [&_>_li]:border-b-[1px] [&_>_li]:border-b-border [&_>_li]:py-5 [&_>_li]:[border-bottom-style:solid] max-[640px]:[&_>_li]:flex-col max-[640px]:[&_>_li]:gap-3 [&_h2]:mx-0 [&_h2]:mt-0 [&_h2]:mb-2 [&_h2]:text-[length:var(--text-md)] [&_h3]:mx-0 [&_h3]:mt-0 [&_h3]:mb-2 [&_h3]:text-[length:var(--text-md)] [&_p]:mx-0 [&_p]:my-2">
                            {list.data.data.map((book) => (
                                <li key={book.id}>
                                    <div>
                                        <h2>
                                            <Link to={`/admin/books/${book.id}`}>{book.title}</Link>
                                        </h2>
                                        <p>Tác giả: {book.author.displayName}</p>
                                        <div className="admin-metadata flex flex-wrap items-center gap-3 text-[length:var(--text-sm)] text-muted-foreground">
                                            <span>{visibilityLabel[book.visibility]}</span>
                                            <span>{book.pageCount} trang</span>
                                            {book.takenDown && (
                                                <Badge tone="danger">Đã bị gỡ</Badge>
                                            )}
                                            <span>{book.reportCount} báo cáo đang mở</span>
                                        </div>
                                    </div>
                                    <Button variant="secondary" asChild>
                                        <Link to={`/admin/books/${book.id}`}>
                                            Xem để kiểm duyệt
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
                                    <h2>Không có sách phù hợp</h2>
                                </EmptyTitle>
                                <EmptyDescription>
                                    <p>Thử từ khóa hoặc quyền hiển thị khác.</p>
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    )}
                    <AdminPager page={query.page} meta={list.data.meta} />
                </>
            )}
        </>
    );
}
