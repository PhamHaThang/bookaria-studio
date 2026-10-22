import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
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
            <div className="page-heading insights-heading">
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
                        <ul className="admin-rows">
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
                                        <div className="admin-metadata">
                                            <Badge tone="warning">{item.reportCount} báo cáo</Badge>
                                            <span>Gần nhất: {adminDate(item.lastReportedAt)}</span>
                                        </div>
                                    </div>
                                    <Link
                                        className="button secondary compact"
                                        to={`/admin/books/${item.book.id}`}
                                    >
                                        Xem và xử lý
                                        <span className="sr-only"> {item.book.title}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <section className="empty-state">
                            <h2>Không có báo cáo đang chờ</h2>
                            <p>Báo cáo mới từ người đọc sẽ xuất hiện ở đây.</p>
                        </section>
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
            <div className="page-heading insights-heading">
                <div>
                    <h1>Tra cứu sách</h1>
                    <p>Tìm sách theo quyền hiển thị để xem nội dung và lịch sử báo cáo.</p>
                </div>
                <AdminReload retry={() => void list.refetch()} busy={list.isFetching} />
            </div>
            <form
                className="admin-filters"
                key={params.toString()}
                onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    const q = String(data.get('q') || '').trim(),
                        visibility = String(data.get('visibility') || 'PUBLIC');
                    setParams({ ...(q ? { q } : {}), visibility });
                }}
            >
                <label htmlFor="admin-book-q">
                    Tên sách
                    <input
                        id="admin-book-q"
                        name="q"
                        type="search"
                        defaultValue={query.q}
                        maxLength={100}
                    />
                </label>
                <label htmlFor="admin-book-visibility">
                    Quyền hiển thị
                    <select
                        id="admin-book-visibility"
                        name="visibility"
                        defaultValue={query.visibility}
                    >
                        <option value="PUBLIC">Công khai</option>
                        <option value="UNLISTED">Qua liên kết</option>
                        <option value="PRIVATE">Riêng tư</option>
                    </select>
                </label>
                <button className="button compact" type="submit">
                    Tìm sách
                </button>
            </form>
            <p className="stats-note">
                Sách bị gỡ được chuyển sang riêng tư. Chọn “Riêng tư” để tra cứu và khôi phục.
            </p>
            {list.isPending && <p role="status">Đang tải sách…</p>}
            {list.isError && <Feedback error={errorMessage(list.error)} />}
            {list.isSuccess && (
                <>
                    <p role="status">{list.data.meta.total} sách</p>
                    {list.data.data.length ? (
                        <ul className="admin-rows">
                            {list.data.data.map((book) => (
                                <li key={book.id}>
                                    <div>
                                        <h2>
                                            <Link to={`/admin/books/${book.id}`}>{book.title}</Link>
                                        </h2>
                                        <p>Tác giả: {book.author.displayName}</p>
                                        <div className="admin-metadata">
                                            <span>{visibilityLabel[book.visibility]}</span>
                                            <span>{book.pageCount} trang</span>
                                            {book.takenDown && (
                                                <Badge tone="danger">Đã bị gỡ</Badge>
                                            )}
                                            <span>{book.reportCount} báo cáo đang mở</span>
                                        </div>
                                    </div>
                                    <Link
                                        className="button secondary compact"
                                        to={`/admin/books/${book.id}`}
                                    >
                                        Xem để kiểm duyệt
                                        <span className="sr-only"> {book.title}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <section className="empty-state">
                            <h2>Không có sách phù hợp</h2>
                            <p>Thử từ khóa hoặc quyền hiển thị khác.</p>
                        </section>
                    )}
                    <AdminPager page={query.page} meta={list.data.meta} />
                </>
            )}
        </>
    );
}
