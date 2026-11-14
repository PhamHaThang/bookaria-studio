import { useQueries, useQuery } from '@tanstack/react-query';
import {
    ArrowRight,
    ArrowUpRight,
    Bell,
    BookOpen,
    Box,
    CircleAlert,
    CircleCheck,
    Eye,
    HardDrive,
    Library,
    Pencil,
    Plus,
    Upload,
} from 'lucide-react';
import { Suspense } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { assetKeys, assetsApi } from '@/features/assets';
import { useAuth } from '@/features/auth';
import { bookKeys, bookStatusLabels, booksApi } from '@/features/books';
import { BookStatusBadge } from '@/features/books/ui/BookStatusBadge';
import { notificationKeys, notificationsApi } from '@/features/notifications';
import { notificationTarget } from '@/features/notifications/api';
import { profileApi, profileKey } from '@/features/profile/model/profile';
import { statsApi } from '@/features/stats';
import { BookOpensChart } from '@/features/stats/BookOpensChart';
import { cn } from '@/shared/lib/cn';
import { formatBytes, formatDate } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { BookCoverImage } from '@/shared/ui/BookCoverImage';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/primitives/card';
import { Progress } from '@/shared/ui/primitives/progress';
import { Skeleton } from '@/shared/ui/primitives/skeleton';

const countQuery = { page: 1, limit: 1 } as const;
const assetCountQuery = { ...countQuery, scope: 'mine' } as const;
const modelCountQuery = { ...assetCountQuery, type: 'MODEL' } as const;
const bookStatuses = ['DRAFT', 'PUBLISHED', 'CHANGED'] as const;
const metricLink =
    'flex h-full min-w-0 flex-col rounded-[inherit] p-4 text-foreground no-underline hover:bg-hover focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-3px] motion-safe:transition-colors';
const panelClass = 'min-w-0 gap-0 p-4 sm:p-5';
const panelHeaderClass = 'mb-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1';
const percentFormat = new Intl.NumberFormat('vi-VN', {
    style: 'percent',
    maximumFractionDigits: 1,
});
const summaryTiles = [
    { label: 'Lượt mở 7 ngày', icon: Eye, to: '/stats' },
    { label: 'Sách đang làm', icon: Library, to: '/books' },
    { label: 'Tài nguyên', icon: Box, to: '/assets' },
    { label: 'Dung lượng', icon: HardDrive, to: '/assets' },
] as const;
const recentBooks = { page: 1, limit: 4, sort: '-updatedAt' } as const;
const recentActivity = { page: 1, limit: 4 } as const;
const numberFormat = new Intl.NumberFormat('vi-VN');
const activityDateFormat = new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
});

function PanelLoading({ label }: { label: string }) {
    return (
        <div className="grid gap-2" role="status">
            <span className="sr-only">{label}</span>
            {['a', 'b', 'c', 'd'].map((row) => (
                <Skeleton key={row} className="h-[4.5rem] rounded-xl" />
            ))}
        </div>
    );
}

function PanelError({ message, onRetry }: { message: string; onRetry: () => void }) {
    return (
        <div className="grid justify-items-start gap-3 px-3 py-8">
            <p className="m-0 text-muted-foreground text-sm" role="alert">
                {message}
            </p>
            <Button variant="outline" size="sm" onClick={onRetry}>
                Thử lại
            </Button>
        </div>
    );
}

export function StudioOverviewPage() {
    const { user } = useAuth();
    const userId = user?.id ?? '';
    const books = useQuery({
        queryKey: bookKeys.list(userId, 'list', recentBooks),
        queryFn: ({ signal }) => booksApi.list(recentBooks, signal),
        enabled: Boolean(userId),
    });
    const totals = useQueries({
        queries: bookStatuses.map((status) => {
            const query = { ...countQuery, status };
            return {
                queryKey: bookKeys.list(userId, 'list', query),
                queryFn: ({ signal }: { signal: AbortSignal }) =>
                    booksApi.list(query, signal).then(({ meta }) => meta.total),
                enabled: Boolean(userId),
            };
        }),
    });
    const activity = useQuery({
        queryKey: notificationKeys.list(userId, recentActivity),
        queryFn: ({ signal }) => notificationsApi.list(recentActivity, signal),
        enabled: Boolean(userId),
        refetchInterval: 30000,
    });

    const [assets, models] = useQueries({
        queries: [assetCountQuery, modelCountQuery].map((query) => ({
            queryKey: assetKeys.list(userId, query),
            queryFn: ({ signal }: { signal: AbortSignal }) =>
                assetsApi.list(query, signal).then(({ meta }) => meta.total),
            enabled: Boolean(userId),
        })),
    });
    const profile = useQuery({
        queryKey: profileKey(userId),
        queryFn: ({ signal }) => profileApi.get(signal),
        enabled: Boolean(userId),
        staleTime: 60000,
        refetchOnWindowFocus: false,
    });
    const reading = useQuery({
        queryKey: ['stats', userId, 'studio-reading'],
        queryFn: ({ signal }) => statsApi.studioReading(signal),
        enabled: Boolean(userId),
    });
    const [drafts, published, changed] = totals.map(({ data }) => data);
    const inProgress = drafts === undefined || changed === undefined ? undefined : drafts + changed;
    const released =
        published === undefined || changed === undefined ? undefined : published + changed;
    const storage = profile.data?.storage;
    const storageRatio = storage?.quotaBytes ? storage.usedBytes / storage.quotaBytes : undefined;
    const trend =
        reading.data && reading.data.opensPrevious7Days > 0
            ? (reading.data.opensLast7Days - reading.data.opensPrevious7Days) /
              reading.data.opensPrevious7Days
            : undefined;
    const steps = [
        {
            title: 'Tạo cuốn sách đầu tiên',
            done: (books.data?.meta.total ?? 0) > 0,
            to: '/studio/new-book',
        },
        { title: 'Tải mô hình 3D', done: (models.data ?? 0) > 0, to: '/studio/upload?type=MODEL' },
        { title: 'Xuất bản một cuốn sách', done: (released ?? 0) > 0, to: '/books' },
    ];
    const guideReady =
        books.data !== undefined && models.data !== undefined && released !== undefined;
    const guideFailed =
        !guideReady && (books.isError || models.isError || totals[1].isError || totals[2].isError);
    const completeSteps = steps.filter(({ done }) => done).length;
    const values = [
        {
            value: reading.data?.opensLast7Days,
            pending: reading.isPending,
            detail:
                trend === undefined
                    ? 'Theo ngày UTC'
                    : trend === 0
                      ? 'Bằng 7 ngày trước'
                      : `${trend > 0 ? 'Tăng' : 'Giảm'} ${percentFormat.format(Math.abs(trend))} so với 7 ngày trước`,
        },
        {
            value: inProgress,
            pending: totals[0].isPending || totals[2].isPending,
            detail:
                released === undefined
                    ? 'Bản nháp và sách có thay đổi'
                    : `${numberFormat.format(released)} sách đã xuất bản`,
        },
        { value: assets.data, pending: assets.isPending, detail: 'Trong thư viện của bạn' },
        {
            value: storageRatio === undefined ? undefined : percentFormat.format(storageRatio),
            pending: !storage && profile.isPending,
            detail: storage
                ? `${formatBytes(storage.usedBytes)} / ${formatBytes(storage.quotaBytes)}`
                : 'Dung lượng tài khoản',
        },
    ];
    const failedOverviewQueries = [...totals, assets, models, ...(storage ? [] : [profile])].filter(
        (query) => query.isError && query.data === undefined,
    );

    return (
        <>
            <header className="mb-7 flex flex-wrap items-center justify-between gap-4 sm:mb-9">
                <div>
                    <h1 className="m-0 font-semibold text-3xl sm:text-4xl">Tổng quan</h1>
                    <p className="m-0 mt-2 text-muted-foreground text-sm">
                        Tiếp tục dự án, quản lý công việc và nắm bắt những hoạt động mới nhất trong
                        Studio
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" asChild>
                        <Link to="/studio/upload" aria-haspopup="dialog">
                            <Upload data-icon="inline-start" aria-hidden="true" />
                            Tải tài nguyên
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link to="/studio/new-book" aria-haspopup="dialog">
                            <Plus data-icon="inline-start" aria-hidden="true" />
                            Tạo sách
                        </Link>
                    </Button>
                </div>
            </header>

            <section className="mb-6" aria-label="Số liệu Studio">
                <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 lg:grid-cols-4">
                    {summaryTiles.map(({ label, icon: Icon, to }, index) => {
                        const { value, pending, detail } = values[index];
                        return (
                            <Card key={label} asChild size="sm" className="gap-0 py-0">
                                <li>
                                    <Link to={to} className={metricLink}>
                                        <span className="mb-3 flex items-center justify-between gap-2">
                                            <Badge
                                                className="size-9 justify-center rounded-xl p-0 [&>svg]:size-4"
                                                aria-hidden="true"
                                            >
                                                <Icon />
                                            </Badge>
                                            <ArrowUpRight
                                                className="size-4 text-muted-foreground"
                                                aria-hidden="true"
                                            />
                                        </span>
                                        <span className="text-muted-foreground text-xs">
                                            {label}
                                        </span>
                                        <span className="my-1 flex min-h-8 items-center font-semibold text-xl tabular-nums sm:text-2xl">
                                            {pending ? (
                                                <span role="status">
                                                    <span className="sr-only">
                                                        Đang tải số liệu
                                                    </span>
                                                    <Skeleton className="h-6 w-12" />
                                                </span>
                                            ) : value === undefined ? (
                                                <>
                                                    <span aria-hidden="true">—</span>
                                                    <span className="sr-only">
                                                        Chưa tải được số liệu
                                                    </span>
                                                </>
                                            ) : typeof value === 'number' ? (
                                                numberFormat.format(value)
                                            ) : (
                                                value
                                            )}
                                        </span>
                                        <span className="mt-auto text-muted-foreground text-xs">
                                            {detail}
                                        </span>
                                    </Link>
                                </li>
                            </Card>
                        );
                    })}
                </ul>
                {failedOverviewQueries.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-muted-foreground text-sm">
                        <span role="status">Chưa tải được một số dữ liệu tổng quan.</span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                for (const query of failedOverviewQueries) void query.refetch();
                            }}
                        >
                            Thử lại
                        </Button>
                    </div>
                )}
            </section>

            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
                <div className="grid min-w-0 gap-4">
                    <Card asChild className={panelClass}>
                        <section aria-labelledby="studio-recent-books">
                            <div className={panelHeaderClass}>
                                <h2 id="studio-recent-books" className="m-0 font-semibold text-lg">
                                    Tiếp tục chỉnh sửa
                                </h2>
                                <Button variant="ghost" size="sm" asChild>
                                    <Link to="/books">
                                        Xem tất cả sách
                                        <ArrowRight data-icon="inline-end" aria-hidden="true" />
                                    </Link>
                                </Button>
                            </div>
                            {books.data && books.data.meta.total > 0 && (
                                <nav
                                    className="mb-3 flex flex-wrap gap-2"
                                    aria-label="Trạng thái sách"
                                >
                                    {bookStatuses.map((status, index) => (
                                        <Button
                                            key={status}
                                            variant="outline"
                                            size="sm"
                                            className="h-8 rounded-full"
                                            asChild
                                        >
                                            <Link to={`/books?status=${status}`}>
                                                {bookStatusLabels[status]}
                                                {totals[index].data !== undefined && (
                                                    <span className="text-muted-foreground tabular-nums">
                                                        {numberFormat.format(totals[index].data)}
                                                    </span>
                                                )}
                                            </Link>
                                        </Button>
                                    ))}
                                </nav>
                            )}
                            {books.isPending ? (
                                <PanelLoading label="Đang tải sách gần đây" />
                            ) : !books.data ? (
                                <PanelError
                                    message="Chưa tải được sách gần đây."
                                    onRetry={() => void books.refetch()}
                                />
                            ) : books.data.data.length === 0 ? (
                                <div className="flex min-h-60 flex-col items-center justify-center gap-3 rounded-xl bg-muted p-5 text-center">
                                    <BookOpen
                                        className="size-8 text-muted-foreground"
                                        aria-hidden="true"
                                    />
                                    <h3 className="m-0 font-semibold text-base">
                                        Bạn chưa có sách
                                    </h3>
                                    <p className="m-0 max-w-72 text-muted-foreground text-sm">
                                        Bắt đầu từ trang trắng hoặc nhập PDF và ảnh có sẵn.
                                    </p>
                                    <Button asChild variant="outline" size="sm">
                                        <Link to="/studio/new-book" aria-haspopup="dialog">
                                            <Plus data-icon="inline-start" aria-hidden="true" />
                                            Tạo cuốn sách đầu tiên
                                        </Link>
                                    </Button>
                                </div>
                            ) : (
                                <ul className="m-0 grid list-none gap-2 p-0">
                                    {books.data.data.map((book) => (
                                        <li key={book.id} className="min-w-0">
                                            <Link
                                                to={`/books/${book.id}/edit`}
                                                aria-label={`Mở editor cho ${book.title}`}
                                                className="group flex min-h-[4.5rem] items-center gap-3 rounded-xl bg-muted/55 p-2 pr-3 text-foreground no-underline hover:bg-hover focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px] motion-safe:transition-colors"
                                            >
                                                <div className="grid h-14 w-12 shrink-0 place-items-center rounded-lg bg-muted p-1">
                                                    <BookCoverImage
                                                        url={book.coverUrl}
                                                        className="rounded-sm bg-transparent"
                                                    />
                                                </div>
                                                <div className="grid min-w-0 flex-1 gap-1">
                                                    <h3
                                                        className="m-0 truncate font-semibold text-sm"
                                                        title={book.title}
                                                    >
                                                        {book.title}
                                                    </h3>
                                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                        <span className="text-muted-foreground text-xs">
                                                            {book.pageCount} trang ·{' '}
                                                            {formatDate(book.updatedAt)}
                                                        </span>
                                                        <BookStatusBadge status={book.status} />
                                                        {book.takenDown && (
                                                            <Badge tone="danger">Đã bị gỡ</Badge>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground text-xs group-hover:text-foreground">
                                                    <Pencil className="size-4" aria-hidden="true" />
                                                    <span className="hidden xl:inline">
                                                        Mở editor
                                                    </span>
                                                </span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    </Card>

                    <Card asChild className={panelClass}>
                        <section aria-labelledby="studio-reading">
                            <div className={panelHeaderClass}>
                                <h2 id="studio-reading" className="m-0 font-semibold text-lg">
                                    Lượt mở 14 ngày qua
                                </h2>
                                <Button variant="ghost" size="sm" asChild>
                                    <Link to="/stats">
                                        Thống kê chi tiết{' '}
                                        <ArrowRight data-icon="inline-end" aria-hidden="true" />
                                    </Link>
                                </Button>
                            </div>
                            {reading.isPending ? (
                                <Skeleton className="h-52 rounded-xl" />
                            ) : !reading.data ? (
                                <PanelError
                                    message="Chưa tải được thống kê lượt mở."
                                    onRetry={() => void reading.refetch()}
                                />
                            ) : reading.data.opensByDay.some((day) => day.opens > 0) ? (
                                <BookOpensChart days={reading.data.opensByDay} className="h-52" />
                            ) : (
                                <p className="m-0 grid min-h-32 place-content-center rounded-xl bg-muted p-4 text-center text-muted-foreground text-sm">
                                    Chưa ghi nhận lượt mở trong 14 ngày qua.
                                </p>
                            )}
                        </section>
                    </Card>
                    {reading.data && reading.data.topBooks.length > 0 && (
                        <Card asChild className={panelClass}>
                            <section aria-labelledby="studio-top-books">
                                <div className={panelHeaderClass}>
                                    <h2 id="studio-top-books" className="m-0 font-semibold text-lg">
                                        Sách nổi bật
                                    </h2>
                                    <span className="text-muted-foreground text-xs">
                                        Theo lượt mở trong 14 ngày
                                    </span>
                                </div>
                                <ol className="m-0 grid list-none gap-2 p-0 sm:grid-cols-3">
                                    {reading.data.topBooks.map((book, index) => (
                                        <li key={book.id} className="min-w-0">
                                            <Link
                                                to={`/books/${book.id}/stats`}
                                                className="flex min-w-0 items-center gap-2 rounded-xl bg-muted/55 p-2 text-foreground no-underline hover:bg-hover focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px] motion-safe:transition-colors"
                                            >
                                                <span className="relative h-12 w-9 shrink-0 rounded bg-muted">
                                                    <BookCoverImage
                                                        url={book.coverUrl}
                                                        className="rounded bg-transparent"
                                                    />
                                                    <span className="absolute -top-1 -left-1 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground text-xs">
                                                        {index + 1}
                                                    </span>
                                                </span>
                                                <span className="grid min-w-0 gap-1">
                                                    <span
                                                        className="truncate font-medium text-sm"
                                                        title={book.title}
                                                    >
                                                        {book.title}
                                                    </span>
                                                    <span className="text-muted-foreground text-xs">
                                                        {numberFormat.format(book.opens)} lượt mở
                                                    </span>
                                                </span>
                                            </Link>
                                        </li>
                                    ))}
                                </ol>
                            </section>
                        </Card>
                    )}
                </div>
                <div className="grid min-w-0 gap-4">
                    <Card asChild className={panelClass}>
                        <section aria-labelledby="studio-checklist">
                            <div className={panelHeaderClass}>
                                <h2 id="studio-checklist" className="m-0 font-semibold text-lg">
                                    Bắt đầu với Studio
                                </h2>
                                {guideReady && (
                                    <Badge
                                        tone={
                                            completeSteps === steps.length ? 'success' : 'neutral'
                                        }
                                    >
                                        {completeSteps}/{steps.length}
                                    </Badge>
                                )}
                            </div>
                            {guideReady ? (
                                <Progress
                                    value={completeSteps}
                                    max={steps.length}
                                    className="mb-3 h-1.5"
                                    aria-label="Tiến độ bắt đầu với Studio"
                                    aria-valuetext={`${completeSteps} trên ${steps.length} bước`}
                                />
                            ) : guideFailed ? (
                                <p className="m-0 mb-3 text-muted-foreground text-xs">
                                    Chưa tải đủ tiến độ.
                                </p>
                            ) : (
                                <Skeleton className="mb-3 h-1.5 w-full" />
                            )}
                            <ul className="m-0 grid list-none gap-1 p-0">
                                {steps.map(({ title, done, to }) => (
                                    <li key={title}>
                                        {done ? (
                                            <span className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-muted-foreground text-sm">
                                                <CircleCheck
                                                    className="size-4 shrink-0 text-success-foreground"
                                                    aria-hidden="true"
                                                />
                                                <span className="sr-only">Đã hoàn thành: </span>
                                                {title}
                                            </span>
                                        ) : (
                                            <Link
                                                to={to}
                                                className="group flex items-center gap-2.5 rounded-lg px-2 py-2 text-foreground text-sm no-underline hover:bg-hover focus-visible:outline-2 focus-visible:outline-ring"
                                            >
                                                <span
                                                    className="size-4 shrink-0 rounded-full border border-input"
                                                    aria-hidden="true"
                                                />
                                                <span className="flex-1">{title}</span>
                                                <ArrowRight
                                                    className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground"
                                                    aria-hidden="true"
                                                />
                                            </Link>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    </Card>

                    <Card asChild className={panelClass}>
                        <section aria-labelledby="studio-recent-activity">
                            <div className={panelHeaderClass}>
                                <h2
                                    id="studio-recent-activity"
                                    className="m-0 font-semibold text-lg"
                                >
                                    Hoạt động gần đây
                                </h2>
                                <Button variant="ghost" size="sm" asChild>
                                    <Link to="/studio?notifications=open" aria-haspopup="dialog">
                                        Thông báo
                                        <ArrowRight data-icon="inline-end" aria-hidden="true" />
                                    </Link>
                                </Button>
                            </div>
                            {activity.isPending ? (
                                <PanelLoading label="Đang tải hoạt động gần đây" />
                            ) : !activity.data ? (
                                <PanelError
                                    message="Chưa tải được hoạt động gần đây."
                                    onRetry={() => void activity.refetch()}
                                />
                            ) : activity.data.data.length === 0 ? (
                                <div className="flex min-h-60 flex-col items-center justify-center gap-3 rounded-xl bg-muted p-5 text-center">
                                    <Bell
                                        className="size-7 text-muted-foreground"
                                        aria-hidden="true"
                                    />
                                    <h3 className="m-0 font-semibold text-sm">Chưa có hoạt động</h3>
                                    <p className="m-0 max-w-60 text-muted-foreground text-sm">
                                        Kết quả xuất bản và xuất PDF sẽ hiện ở đây.
                                    </p>
                                </div>
                            ) : (
                                <ul className="m-0 grid list-none gap-1 p-0">
                                    {activity.data.data.map((item) => {
                                        const to = notificationTarget(item.link);
                                        const failed =
                                            item.type === 'JOB_FAILED' ||
                                            item.type === 'BOOK_TAKEN_DOWN';
                                        const Icon = failed
                                            ? CircleAlert
                                            : item.type === 'JOB_SUCCEEDED'
                                              ? CircleCheck
                                              : Bell;
                                        const rowClass =
                                            'flex min-h-[4.5rem] items-start gap-3 rounded-xl px-2 py-2.5';
                                        const details = (
                                            <>
                                                <Badge
                                                    tone={
                                                        failed
                                                            ? 'danger'
                                                            : item.type === 'JOB_SUCCEEDED'
                                                              ? 'success'
                                                              : 'neutral'
                                                    }
                                                    className="mt-0.5 size-8 justify-center rounded-lg p-0 [&>svg]:size-4"
                                                    aria-hidden="true"
                                                >
                                                    <Icon />
                                                </Badge>
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="wrap-break-word m-0 font-semibold text-sm">
                                                        {item.title}
                                                    </h3>
                                                    {item.body && (
                                                        <p className="wrap-break-word m-0 mt-1 line-clamp-2 text-muted-foreground text-xs">
                                                            {item.body}
                                                        </p>
                                                    )}
                                                    <time
                                                        className="mt-1 block text-muted-foreground text-xs"
                                                        dateTime={item.createdAt}
                                                    >
                                                        {activityDateFormat.format(
                                                            new Date(item.createdAt),
                                                        )}
                                                    </time>
                                                </div>
                                            </>
                                        );
                                        return (
                                            <li
                                                key={item.id}
                                                className="relative min-w-0 [&:not(:last-child)]:after:pointer-events-none [&:not(:last-child)]:after:absolute [&:not(:last-child)]:after:top-12 [&:not(:last-child)]:after:bottom-[-0.7rem] [&:not(:last-child)]:after:left-6 [&:not(:last-child)]:after:w-px [&:not(:last-child)]:after:bg-border"
                                            >
                                                {to ? (
                                                    <Link
                                                        to={to}
                                                        className={cn(
                                                            rowClass,
                                                            'group text-foreground no-underline hover:bg-hover focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px] motion-safe:transition-colors',
                                                        )}
                                                    >
                                                        {details}
                                                        <ArrowUpRight
                                                            className="mt-1 size-4 shrink-0 text-muted-foreground group-hover:text-foreground"
                                                            aria-hidden="true"
                                                        />
                                                    </Link>
                                                ) : (
                                                    <div className={rowClass}>{details}</div>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </section>
                    </Card>
                </div>
            </div>
            <Suspense fallback={null}>
                <Outlet />
            </Suspense>
        </>
    );
}
