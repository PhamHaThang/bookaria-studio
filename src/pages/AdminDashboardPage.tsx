import { useQuery } from '@tanstack/react-query';
import {
    Activity,
    AlertTriangle,
    ArrowRight,
    ArrowUpRight,
    BookOpen,
    Flag,
    HardDrive,
    LibraryBig,
    ListTodo,
    ScanLine,
    ScrollText,
    Table as TableIcon,
    Tags,
    UsersRound,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { errorMessage } from '@/shared/api/errors';
import { Badge, type BadgeTone } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Feedback } from '@/shared/ui/Feedback';
import { LoadingState } from '@/shared/ui/LoadingState';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/shared/ui/primitives/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/shared/ui/primitives/chart';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/shared/ui/primitives/table';
import { adminApi, adminKeys, auditLabel, bytesLabel } from '../features/admin';
import { AdminReload } from '../features/admin/ui';
import { useAuth } from '../features/auth';

export function AdminDashboardPage() {
    const { user } = useAuth();
    const [showTableView, setShowTableView] = useState(false);

    const query = useQuery({
        queryKey: adminKeys.dashboard(user?.id || ''),
        queryFn: ({ signal }) => adminApi.dashboard(signal),
        staleTime: 10000,
        retry: false,
    });

    const data = query.data;

    // Tính toán dữ liệu thống kê cho biểu đồ xuất bản 7 ngày
    const daysData = useMemo(() => {
        if (!data?.publishedPerDay) return [];
        return data.publishedPerDay.map((item) => {
            const [, month, day] = item.date.split('-');
            return {
                ...item,
                shortDate: `${day}/${month}`,
            };
        });
    }, [data?.publishedPerDay]);

    const totalPublished7Days = useMemo(() => {
        return data?.publishedPerDay?.reduce((sum, item) => sum + item.count, 0) ?? 0;
    }, [data?.publishedPerDay]);

    const peakPublishDay = useMemo(() => {
        if (!data?.publishedPerDay?.length) return null;
        return data.publishedPerDay.reduce(
            (max, item) => (item.count > max.count ? item : max),
            data.publishedPerDay[0],
        );
    }, [data?.publishedPerDay]);

    // Tổng số thao tác quản trị hôm nay
    const totalAuditToday = useMemo(() => {
        return data?.auditActionsToday?.reduce((sum, item) => sum + item.count, 0) ?? 0;
    }, [data?.auditActionsToday]);

    if (query.isPending) {
        return (
            <div className="mx-auto max-w-6xl p-6">
                <LoadingState layout="rows">Đang tải số liệu tổng quan hệ thống…</LoadingState>
            </div>
        );
    }

    if (query.isError) {
        return (
            <div className="mx-auto max-w-6xl p-6">
                <Feedback error={errorMessage(query.error)} />
                <div className="mt-4">
                    <Button variant="secondary" onClick={() => void query.refetch()}>
                        Thử lại
                    </Button>
                </div>
            </div>
        );
    }

    if (!data) return null;

    // Danh sách các thẻ lối tắt nhanh (Quick Access)
    const quickAccessItems = [
        {
            to: '/admin/users',
            title: 'Quản lý người dùng',
            description:
                'Tìm kiếm, cấp quyền Admin/Tác giả, khóa tài khoản và điều chỉnh hạn mức lưu trữ.',
            icon: UsersRound,
            badge: `${data.users} tài khoản`,
            badgeTone: 'neutral' as BadgeTone,
            color: 'text-blue-600 bg-blue-500/10 dark:text-blue-400',
        },
        {
            to: '/admin/moderation',
            title: 'Hàng chờ kiểm duyệt',
            description: 'Tiếp nhận và xử lý các báo cáo vi phạm nội dung sách từ độc giả.',
            icon: Flag,
            badge: data.openReports > 0 ? `${data.openReports} báo cáo chờ` : 'Không có báo cáo',
            badgeTone: (data.openReports > 0 ? 'warning' : 'success') as BadgeTone,
            color: 'text-amber-600 bg-amber-500/10 dark:text-amber-400',
        },
        {
            to: '/admin/books',
            title: 'Tra cứu & Duyệt sách',
            description: 'Rà soát các đầu sách công khai, gỡ sách vi phạm hoặc khôi phục hiển thị.',
            icon: BookOpen,
            badge: `${data.publishedBooks} đã xuất bản`,
            badgeTone: 'neutral' as BadgeTone,
            color: 'text-emerald-600 bg-emerald-500/10 dark:text-emerald-400',
        },
        {
            to: '/admin/library',
            title: 'Thư viện dùng chung',
            description: 'Kho tài nguyên 3D, sticker và âm thanh dùng chung cho toàn bộ tác giả.',
            icon: LibraryBig,
            badge: bytesLabel(data.storageUsedBytes),
            badgeTone: 'neutral' as BadgeTone,
            color: 'text-purple-600 bg-purple-500/10 dark:text-purple-400',
        },
        {
            to: '/admin/categories',
            title: 'Danh mục tài nguyên',
            description: 'Cấu trúc cây danh mục và phân loại tài nguyên trong thư viện.',
            icon: Tags,
            badge: 'Cấu trúc phân loại',
            badgeTone: 'neutral' as BadgeTone,
            color: 'text-indigo-600 bg-indigo-500/10 dark:text-indigo-400',
        },
        {
            to: '/admin/markers',
            title: 'Bộ Marker Bookaria',
            description:
                'Quản lý 20 marker nhận diện AR, thử nghiệm độ nhận diện và tải lên file nhận diện mới.',
            icon: ScanLine,
            badge: '20 marker AR',
            badgeTone: 'neutral' as BadgeTone,
            color: 'text-teal-600 bg-teal-500/10 dark:text-teal-400',
        },
        {
            to: '/admin/jobs',
            title: 'Hàng đợi tác vụ Worker',
            description: 'Giám sát tiến trình nén 3D, xuất file PDF in ấn và chạy lại các job lỗi.',
            icon: ListTodo,
            badge: data.failedJobs24h > 0 ? `${data.failedJobs24h} lỗi 24h` : 'Hoạt động ổn định',
            badgeTone: (data.failedJobs24h > 0 ? 'danger' : 'success') as BadgeTone,
            color: 'text-rose-600 bg-rose-500/10 dark:text-rose-400',
        },
        {
            to: '/admin/audit-logs',
            title: 'Nhật ký kiểm toán',
            description: 'Lưu vết lịch sử mọi thay đổi dữ liệu, cấp quyền và thao tác quản trị.',
            icon: ScrollText,
            badge: `${totalAuditToday} thao tác hôm nay`,
            badgeTone: 'neutral' as BadgeTone,
            color: 'text-slate-600 bg-slate-500/10 dark:text-slate-400',
        },
    ];

    return (
        <div className="mx-auto max-w-6xl space-y-8 p-6">
            {/* Header: Tiêu đề & Làm mới */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="font-semibold text-2xl text-foreground tracking-tight">
                        Tổng quan quản trị
                    </h1>
                    <p className="mt-1 text-muted-foreground text-sm">
                        Bảng điều khiển theo dõi hiệu suất vận hành, cảnh báo an toàn và lối tắt
                        phân hệ.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <AdminReload retry={() => void query.refetch()} busy={query.isFetching} />
                </div>
            </div>

            {/* KPI Cards: 5 chỉ số đo lường chính */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {/* 1. Người dùng */}
                <Link
                    to="/admin/users"
                    className="group rounded-[var(--radius-lg)] border border-border bg-surface p-4 transition-all hover:border-primary/40 hover:bg-muted/30 hover:shadow-xs"
                >
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="font-medium text-xs">Người dùng</span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            <UsersRound className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between">
                        <span className="font-bold text-2xl text-foreground tracking-tight">
                            {data.users.toLocaleString('vi-VN')}
                        </span>
                        <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <p className="mt-1 text-muted-foreground text-xs">Tài khoản trong hệ thống</p>
                </Link>

                {/* 2. Sách xuất bản */}
                <Link
                    to="/admin/books"
                    className="group rounded-[var(--radius-lg)] border border-border bg-surface p-4 transition-all hover:border-primary/40 hover:bg-muted/30 hover:shadow-xs"
                >
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="font-medium text-xs">Sách xuất bản</span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            <BookOpen className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between">
                        <span className="font-bold text-2xl text-foreground tracking-tight">
                            {data.publishedBooks.toLocaleString('vi-VN')}
                        </span>
                        <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <p className="mt-1 text-muted-foreground text-xs">Đang lưu hành công khai</p>
                </Link>

                {/* 3. Dung lượng lưu trữ */}
                <Link
                    to="/admin/library"
                    className="group rounded-[var(--radius-lg)] border border-border bg-surface p-4 transition-all hover:border-primary/40 hover:bg-muted/30 hover:shadow-xs"
                >
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="font-medium text-xs">Lưu trữ đã dùng</span>
                        <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] bg-purple-500/10 text-purple-600 dark:text-purple-400">
                            <HardDrive className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between">
                        <span className="font-bold text-2xl text-foreground tracking-tight">
                            {bytesLabel(data.storageUsedBytes)}
                        </span>
                        <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <p className="mt-1 text-muted-foreground text-xs">Tài nguyên & bản in</p>
                </Link>

                {/* 4. Báo cáo chờ xử lý */}
                <Link
                    to="/admin/moderation"
                    className={`group rounded-[var(--radius-lg)] border p-4 transition-all hover:shadow-xs ${
                        data.openReports > 0
                            ? 'border-amber-500/40 bg-amber-500/5 hover:border-amber-500/60'
                            : 'border-border bg-surface hover:border-primary/40 hover:bg-muted/30'
                    }`}
                >
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="font-medium text-xs">Báo cáo chờ</span>
                        <div
                            className={`flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] ${
                                data.openReports > 0
                                    ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                    : 'bg-muted text-muted-foreground'
                            }`}
                        >
                            <Flag className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between">
                        <span
                            className={`font-bold text-2xl tracking-tight ${
                                data.openReports > 0
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-foreground'
                            }`}
                        >
                            {data.openReports}
                        </span>
                        <Badge tone={data.openReports > 0 ? 'warning' : 'success'}>
                            {data.openReports > 0 ? 'Cần duyệt' : 'Sạch'}
                        </Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground text-xs">Phản hồi từ độc giả</p>
                </Link>

                {/* 5. Tác vụ lỗi 24h */}
                <Link
                    to="/admin/jobs"
                    className={`group rounded-[var(--radius-lg)] border p-4 transition-all hover:shadow-xs ${
                        data.failedJobs24h > 0
                            ? 'border-rose-500/40 bg-rose-500/5 hover:border-rose-500/60'
                            : 'border-border bg-surface hover:border-primary/40 hover:bg-muted/30'
                    }`}
                >
                    <div className="flex items-center justify-between text-muted-foreground">
                        <span className="font-medium text-xs">Tác vụ lỗi 24h</span>
                        <div
                            className={`flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] ${
                                data.failedJobs24h > 0
                                    ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400'
                                    : 'bg-muted text-muted-foreground'
                            }`}
                        >
                            <AlertTriangle className="h-4 w-4" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between">
                        <span
                            className={`font-bold text-2xl tracking-tight ${
                                data.failedJobs24h > 0
                                    ? 'text-rose-600 dark:text-rose-400'
                                    : 'text-foreground'
                            }`}
                        >
                            {data.failedJobs24h}
                        </span>
                        <Badge tone={data.failedJobs24h > 0 ? 'danger' : 'success'}>
                            {data.failedJobs24h > 0 ? 'Kiểm tra' : 'Tốt'}
                        </Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground text-xs">Worker background jobs</p>
                </Link>
            </div>

            {/* Visual Analytics: Biểu đồ 7 ngày & Hoạt động quản trị hôm nay */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Biểu đồ Sách xuất bản 7 ngày qua (Chiếm 2 cột) */}
                <Card className="lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                        <div>
                            <CardTitle className="font-semibold text-base">
                                Xu hướng xuất bản 7 ngày qua
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Thống kê số lượng sách được phát hành lần đầu (theo giờ Việt Nam).
                            </CardDescription>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowTableView(!showTableView)}
                            className="text-xs"
                        >
                            <TableIcon className="h-3.5 w-3.5" data-icon="inline-start" />
                            {showTableView ? 'Xem biểu đồ' : 'Xem dạng bảng'}
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {/* Tóm tắt nhanh trên đầu biểu đồ */}
                        <div className="mb-4 flex flex-wrap items-center gap-6 border-border border-b pb-4 text-xs">
                            <div>
                                <span className="text-muted-foreground">
                                    Tổng xuất bản trong tuần:{' '}
                                </span>
                                <span className="font-semibold text-foreground">
                                    {totalPublished7Days} cuốn
                                </span>
                            </div>
                            {peakPublishDay && peakPublishDay.count > 0 && (
                                <div>
                                    <span className="text-muted-foreground">Ngày cao điểm: </span>
                                    <span className="font-semibold text-foreground">
                                        {peakPublishDay.date} ({peakPublishDay.count} cuốn)
                                    </span>
                                </div>
                            )}
                        </div>

                        {showTableView ? (
                            <div className="rounded-[var(--radius-md)] border border-border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Ngày phát hành</TableHead>
                                            <TableHead className="text-right">
                                                Số lượng sách
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {daysData.map((row) => (
                                            <TableRow key={row.date}>
                                                <TableCell className="font-medium text-foreground">
                                                    {row.date}
                                                </TableCell>
                                                <TableCell className="text-right font-mono font-semibold">
                                                    {row.count}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                            <ChartContainer
                                config={{
                                    count: {
                                        label: 'Sách xuất bản',
                                        color: 'var(--action-primary)',
                                    },
                                }}
                                className="h-56 w-full"
                            >
                                <BarChart
                                    accessibilityLayer
                                    data={daysData}
                                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                                >
                                    <CartesianGrid
                                        strokeDasharray="3 3"
                                        vertical={false}
                                        stroke="var(--border-line)"
                                    />
                                    <XAxis
                                        dataKey="shortDate"
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                        className="text-muted-foreground text-xs"
                                    />
                                    <YAxis
                                        allowDecimals={false}
                                        tickLine={false}
                                        axisLine={false}
                                        tickMargin={8}
                                        className="text-muted-foreground text-xs"
                                    />
                                    <ChartTooltip
                                        content={
                                            <ChartTooltipContent
                                                labelFormatter={(_, payload) => {
                                                    const item = payload?.[0]?.payload;
                                                    return item?.date ? `Ngày ${item.date}` : '';
                                                }}
                                            />
                                        }
                                    />
                                    <Bar
                                        dataKey="count"
                                        fill="var(--color-count)"
                                        radius={[4, 4, 0, 0]}
                                        maxBarSize={44}
                                        isAnimationActive={false}
                                    />
                                </BarChart>
                            </ChartContainer>
                        )}
                    </CardContent>
                </Card>

                {/* Hoạt động quản trị hôm nay (1 Cột) */}
                <Card className="flex flex-col">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                        <div>
                            <CardTitle className="font-semibold text-base">
                                Thao tác quản trị hôm nay
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Phân bố các hành động của Admin trong ngày.
                            </CardDescription>
                        </div>
                        <Badge tone="info">{totalAuditToday} thao tác</Badge>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col justify-between">
                        {data.auditActionsToday.length > 0 ? (
                            <div className="space-y-3.5">
                                {data.auditActionsToday.map((row) => {
                                    const percentage = totalAuditToday
                                        ? Math.round((row.count / totalAuditToday) * 100)
                                        : 0;
                                    return (
                                        <div key={row.action} className="space-y-1">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="font-medium text-foreground">
                                                    {auditLabel[row.action] || row.action}
                                                </span>
                                                <span className="font-mono text-muted-foreground">
                                                    {row.count} ({percentage}%)
                                                </span>
                                            </div>
                                            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                                <div
                                                    className="h-full rounded-full bg-primary transition-all duration-300"
                                                    style={{ width: `${percentage}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-1 flex-col items-center justify-center py-8 text-center text-muted-foreground">
                                <Activity className="mb-2 h-8 w-8 stroke-1 text-muted-foreground/60" />
                                <p className="text-sm">Chưa có thao tác quản trị nào hôm nay.</p>
                            </div>
                        )}

                        <div className="mt-6 border-border border-t pt-4">
                            <Button
                                asChild
                                variant="ghost"
                                size="sm"
                                className="w-full justify-between text-xs"
                            >
                                <Link to="/admin/audit-logs">
                                    <span>Xem chi tiết nhật ký kiểm toán</span>
                                    <ArrowRight className="h-3.5 w-3.5" />
                                </Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Quick Access Section: Lối tắt tới các phân hệ quản lý */}
            <div>
                <div className="mb-4">
                    <h2 className="font-semibold text-foreground text-lg tracking-tight">
                        Lối tắt phân hệ quản trị
                    </h2>
                    <p className="text-muted-foreground text-xs">
                        Truy cập nhanh và trực tiếp đến các tính năng cốt lõi của ban quản trị
                        Bookaria.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {quickAccessItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.to}
                                to={item.to}
                                className="group relative flex flex-col justify-between rounded-[var(--radius-lg)] border border-border bg-surface p-5 transition-all hover:border-primary/50 hover:bg-muted/20 hover:shadow-xs"
                            >
                                <div>
                                    <div className="flex items-center justify-between">
                                        <div
                                            className={`flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] ${item.color}`}
                                        >
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <Badge tone={item.badgeTone}>{item.badge}</Badge>
                                    </div>
                                    <h3 className="mt-3.5 flex items-center gap-1 font-medium text-foreground text-sm group-hover:text-primary">
                                        <span>{item.title}</span>
                                        <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                                    </h3>
                                    <p className="mt-1 line-clamp-2 text-muted-foreground text-xs leading-relaxed">
                                        {item.description}
                                    </p>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
