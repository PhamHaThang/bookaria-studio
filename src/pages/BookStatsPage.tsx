import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../features/auth';
import { bookKeys, booksApi } from '../features/books';
import { rangeLabels, readStatsRange, statsApi, statsKey } from '../features/stats';
import { StatsContent } from '../features/stats/StatsContent';
import { errorMessage } from '../shared/api/errors';
import { IdSchema } from '../shared/contracts/common.schema';
import { Feedback } from '../shared/ui/Feedback';

export function BookStatsPage() {
    const { user } = useAuth();
    const { bookId = '' } = useParams();
    const [params, setParams] = useSearchParams();
    const range = readStatsRange(params),
        valid = IdSchema.safeParse(bookId).success;
    const detail = useQuery({
        queryKey: bookKeys.detail(user?.id || '', bookId),
        queryFn: ({ signal }) => booksApi.detail(bookId, signal),
        enabled: valid && Boolean(user),
        refetchOnWindowFocus: false,
    });
    const stats = useQuery({
        queryKey: statsKey(user?.id || '', bookId, range),
        queryFn: ({ signal }) => statsApi.book(bookId, { range }, signal),
        enabled: valid && Boolean(user),
        staleTime: 0,
    });
    if (!valid)
        return (
            <>
                <h1>Không tìm thấy sách</h1>
                <Link to="/stats">Chọn sách khác</Link>
            </>
        );
    const pending = detail.isPending || stats.isPending;
    const failed = detail.isError || stats.isError;
    return (
        <>
            <Link className="back-link" to={`/books/${bookId}`}>
                Về chi tiết sách
            </Link>
            <div className="page-heading insights-heading">
                <div>
                    <h1>Thống kê sách</h1>
                    {detail.isSuccess && <p className="stats-book-title">{detail.data.title}</p>}
                </div>
                <Link to="/stats">Chọn sách khác</Link>
            </div>
            <div className="stats-toolbar">
                <label htmlFor="stats-range">
                    Khoảng thời gian
                    <select
                        id="stats-range"
                        value={range}
                        onChange={(event) =>
                            setParams((current) => {
                                const next = new URLSearchParams(current);
                                next.set('range', event.target.value);
                                return next;
                            })
                        }
                    >
                        {Object.entries(rangeLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </label>
                <button
                    type="button"
                    className="button secondary compact"
                    disabled={stats.isFetching || detail.isFetching}
                    onClick={() => {
                        void stats.refetch();
                        void detail.refetch();
                    }}
                >
                    Cập nhật số liệu
                </button>
            </div>
            {pending && <p role="status">Đang tải thống kê…</p>}
            {failed && (
                <div className="list-state">
                    <Feedback error={errorMessage(detail.error || stats.error)} />
                    <p>
                        <Link to="/stats">Chọn sách khác</Link>
                    </p>
                </div>
            )}
            {!pending && !failed && stats.data && <StatsContent stats={stats.data} />}
        </>
    );
}
