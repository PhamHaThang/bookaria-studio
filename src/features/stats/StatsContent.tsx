import { BarChart3, BookOpen, MousePointer2, ScanLine, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Pie, PieChart, XAxis, YAxis } from 'recharts';
import { Disclosure } from '@/shared/ui/Disclosure';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/primitives/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/shared/ui/primitives/chart';
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/shared/ui/primitives/empty';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/shared/ui/primitives/table';
import type { BookStats } from '../../shared/contracts/api/books.schema';
import { BookOpensChart } from './BookOpensChart';

const number = new Intl.NumberFormat('vi-VN');
const percent = new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: 1 });
const fullDate = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeZone: 'UTC' });
const dayDate = (day: string) => new Date(`${day}T00:00:00Z`);
const blue = 'var(--editor-axis-z)';
const orange = 'var(--action-highlight)';
const deviceConfig = {
    mobile: { label: 'Điện thoại', color: blue },
    desktop: { label: 'Máy tính', color: orange },
    tablet: { label: 'Máy tính bảng', color: 'var(--status-success-text)' },
};
const metrics = [
    { key: 'opens', label: 'Lượt mở sách', icon: BookOpen },
    { key: 'sessions', label: 'Phiên đọc', icon: Users },
    { key: 'taps', label: 'Lượt chạm', icon: MousePointer2 },
    { key: 'scanTimeouts', label: 'Lần quét chưa nhận diện', icon: ScanLine },
] as const;
const pageConfig = {
    found: { label: 'Nhận diện AR', color: blue },
    taps: { label: 'Lượt chạm', color: orange },
};
const tableClass = '[&_td]:tabular-nums [&_thead_th]:text-muted-foreground [&_tr]:border-border';
const axisTick = { fill: 'var(--text-muted)' };
const countAxis = {
    allowDecimals: false,
    tick: axisTick,
    tickLine: false,
    axisLine: false,
    width: 'auto',
    tickFormatter: (value: number) => number.format(value),
} as const;

export function StatsContent({ stats }: { stats: BookStats }) {
    const days = [...stats.opensByDay].sort((a, b) => a.date.localeCompare(b.date));
    const first = days[0];
    const last = days.at(-1);
    const hasEvents = Object.values(stats.totals).some((value) => value > 0);
    const pages = stats.byPage.map((page) => ({ ...page, label: `Trang ${page.pageNumber}` }));
    const hasPageEvents = pages.some(({ found, taps }) => found > 0 || taps > 0);
    const devices = Object.entries(deviceConfig)
        .map(([type, { label, color }]) => ({
            type,
            label,
            fill: color,
            count: stats.byDevice.reduce(
                (total, row) => total + (row.type === type ? row.count : 0),
                0,
            ),
        }))
        .filter(({ count }) => count > 0);
    const deviceTotal = devices.reduce((total, { count }) => total + count, 0);

    return (
        <div className="@container flex flex-col gap-6">
            <dl
                className="m-0 grid grid-cols-2 gap-3 lg:grid-cols-4"
                aria-label="Tổng số trong khoảng đã chọn"
            >
                {metrics.map(({ key, label, icon: Icon }) => (
                    <Card key={key} asChild size="sm" className="gap-2 p-4">
                        <div>
                            <dt className="flex items-start gap-2 text-muted-foreground text-sm">
                                <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                                {label}
                            </dt>
                            <dd className="m-0 mt-auto font-semibold text-3xl tabular-nums tracking-tight">
                                {number.format(stats.totals[key])}
                            </dd>
                        </div>
                    </Card>
                ))}
            </dl>

            <Card asChild className="min-w-0 gap-4">
                <section aria-label="Lượt mở theo ngày">
                    <CardHeader className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <CardTitle asChild>
                            <h2 className="m-0">Lượt mở theo ngày</h2>
                        </CardTitle>
                        {first && last && (
                            <p className="m-0 text-muted-foreground text-xs tabular-nums">
                                {fullDate.format(dayDate(first.date))} –{' '}
                                {fullDate.format(dayDate(last.date))} (UTC)
                            </p>
                        )}
                    </CardHeader>
                    <CardContent className="min-w-0">
                        {days.some((day) => day.opens > 0) ? (
                            <BookOpensChart days={days} />
                        ) : (
                            <Empty className="px-3 py-8">
                                <EmptyHeader>
                                    <EmptyMedia>
                                        <BarChart3 className="size-6" aria-hidden="true" />
                                    </EmptyMedia>
                                    <EmptyTitle className="text-base">
                                        <h3>
                                            {hasEvents
                                                ? 'Chưa ghi nhận lượt mở'
                                                : 'Chưa có dữ liệu đọc trong khoảng này'}
                                        </h3>
                                    </EmptyTitle>
                                    <EmptyDescription>
                                        Chọn khoảng thời gian dài hơn hoặc chia sẻ sách đã xuất bản
                                        để nhận số liệu.
                                    </EmptyDescription>
                                </EmptyHeader>
                            </Empty>
                        )}
                        {days.length > 0 && (
                            <Disclosure title="Xem số liệu từng ngày">
                                <Table className={tableClass} aria-label="Lượt mở từng ngày (UTC)">
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead scope="col">Ngày (UTC)</TableHead>
                                            <TableHead scope="col" className="text-right">
                                                Lượt mở
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {days.map((day) => (
                                            <TableRow key={day.date}>
                                                <TableHead scope="row">
                                                    {fullDate.format(dayDate(day.date))}
                                                </TableHead>
                                                <TableCell className="text-right">
                                                    {number.format(day.opens)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Disclosure>
                        )}
                    </CardContent>
                </section>
            </Card>

            <div className="grid @min-[900px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-4">
                <Card asChild className="min-w-0 gap-3">
                    <section aria-labelledby="stats-pages-heading">
                        <CardHeader>
                            <CardTitle asChild>
                                <h2 id="stats-pages-heading" className="m-0">
                                    Tương tác theo trang
                                </h2>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="min-w-0">
                            {hasPageEvents && (
                                <>
                                    <ul className="m-0 flex list-none flex-wrap gap-x-5 gap-y-1 px-0 py-1.5 text-muted-foreground text-sm">
                                        {Object.entries(pageConfig).map(
                                            ([key, { label, color }]) => (
                                                <li key={key} className="flex items-center gap-2">
                                                    <span
                                                        className="size-2 rounded-full"
                                                        style={{ backgroundColor: color }}
                                                        aria-hidden="true"
                                                    />
                                                    {label}
                                                </li>
                                            ),
                                        )}
                                    </ul>
                                    <section
                                        className="overflow-x-auto"
                                        aria-label="Biểu đồ tương tác theo trang"
                                    >
                                        <ChartContainer
                                            config={pageConfig}
                                            className="aspect-auto h-60 w-full overflow-clip"
                                            style={{ minWidth: pages.length * 52 }}
                                        >
                                            <BarChart
                                                accessibilityLayer
                                                barGap={4}
                                                barSize={20}
                                                data={pages}
                                                margin={{ top: 8, right: 8, left: 2 }}
                                            >
                                                <CartesianGrid
                                                    vertical={false}
                                                    stroke="var(--border-default)"
                                                    strokeDasharray="4 5"
                                                />
                                                <XAxis
                                                    dataKey="label"
                                                    tick={axisTick}
                                                    tickMargin={10}
                                                    tickLine={false}
                                                    axisLine={false}
                                                    minTickGap={10}
                                                />
                                                <YAxis {...countAxis} />
                                                <ChartTooltip
                                                    isAnimationActive={false}
                                                    content={
                                                        <ChartTooltipContent
                                                            className="wrap-anywhere max-w-56"
                                                            labelFormatter={(label) => {
                                                                const page = pages.find(
                                                                    (row) => row.label === label,
                                                                );
                                                                return page?.title
                                                                    ? `${page.label} — ${page.title}`
                                                                    : label;
                                                            }}
                                                        />
                                                    }
                                                />
                                                <Bar
                                                    dataKey="found"
                                                    fill="var(--color-found)"
                                                    radius={[3, 3, 0, 0]}
                                                    isAnimationActive={false}
                                                />
                                                <Bar
                                                    dataKey="taps"
                                                    fill="var(--color-taps)"
                                                    radius={[3, 3, 0, 0]}
                                                    isAnimationActive={false}
                                                />
                                            </BarChart>
                                        </ChartContainer>
                                    </section>
                                </>
                            )}
                            {!hasPageEvents && (
                                <p className="m-0 py-4 text-muted-foreground text-sm">
                                    {pages.length
                                        ? 'Chưa ghi nhận tương tác theo trang trong khoảng này.'
                                        : 'Sách chưa có trang.'}
                                </p>
                            )}
                            {pages.length > 0 && (
                                <Disclosure title="Xem số liệu theo trang">
                                    <Table className={tableClass} aria-label="Tương tác theo trang">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead scope="col">Trang</TableHead>
                                                <TableHead scope="col" className="text-right">
                                                    Nhận diện AR
                                                </TableHead>
                                                <TableHead scope="col" className="text-right">
                                                    Lượt chạm
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {pages.map((page) => (
                                                <TableRow key={page.pageId}>
                                                    <TableHead
                                                        scope="row"
                                                        className="wrap-anywhere whitespace-normal text-foreground"
                                                    >
                                                        {page.title
                                                            ? `${page.pageNumber}. ${page.title}`
                                                            : page.label}
                                                    </TableHead>
                                                    <TableCell className="text-right">
                                                        {number.format(page.found)}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {number.format(page.taps)}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </Disclosure>
                            )}
                        </CardContent>
                    </section>
                </Card>
                <Card asChild className="min-w-0 gap-3">
                    <section aria-labelledby="stats-devices-heading">
                        <CardHeader>
                            <CardTitle asChild>
                                <h2 id="stats-devices-heading" className="m-0">
                                    Thiết bị đọc
                                </h2>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="min-w-0">
                            {deviceTotal > 0 ? (
                                <>
                                    <div className="mx-auto flex min-h-[17rem] max-w-xl flex-wrap items-center justify-center gap-x-5 gap-y-3 py-3">
                                        <ChartContainer
                                            config={deviceConfig}
                                            className="aspect-square w-36 max-w-full"
                                            aria-label="Tỷ lệ phiên đọc theo thiết bị"
                                        >
                                            <PieChart accessibilityLayer>
                                                <ChartTooltip
                                                    content={
                                                        <ChartTooltipContent
                                                            nameKey="type"
                                                            hideLabel
                                                        />
                                                    }
                                                />
                                                <Pie
                                                    data={devices}
                                                    dataKey="count"
                                                    nameKey="type"
                                                    innerRadius="65%"
                                                    outerRadius="96%"
                                                    stroke="var(--bg-surface)"
                                                    strokeWidth={2}
                                                    isAnimationActive={false}
                                                />
                                            </PieChart>
                                        </ChartContainer>
                                        <ul className="m-0 grid min-w-36 list-none gap-3 p-0 text-sm">
                                            {devices.map(({ type, label, fill, count }) => (
                                                <li key={type} className="flex items-center gap-2">
                                                    <span
                                                        className="size-2.5 shrink-0 rounded-full"
                                                        style={{ backgroundColor: fill }}
                                                        aria-hidden="true"
                                                    />
                                                    <span>{label}</span>
                                                    <span className="ml-auto pl-3 font-medium tabular-nums">
                                                        {percent.format(count / deviceTotal)}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <Disclosure title="Xem số liệu theo hệ điều hành">
                                        <Table
                                            className={tableClass}
                                            aria-label="Phiên đọc theo nhóm thiết bị và hệ điều hành"
                                        >
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead scope="col">Thiết bị</TableHead>
                                                    <TableHead scope="col">Hệ điều hành</TableHead>
                                                    <TableHead scope="col" className="text-right">
                                                        Phiên đọc
                                                    </TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {stats.byDevice.map((device) => (
                                                    <TableRow key={`${device.type}:${device.os}`}>
                                                        <TableHead
                                                            scope="row"
                                                            className="text-foreground"
                                                        >
                                                            {deviceConfig[device.type].label}
                                                        </TableHead>
                                                        <TableCell className="wrap-anywhere whitespace-normal">
                                                            {device.os || 'Chưa xác định'}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {number.format(device.count)}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </Disclosure>
                                </>
                            ) : (
                                <p className="m-0 py-4 text-muted-foreground text-sm">
                                    Chưa có dữ liệu thiết bị trong khoảng này.
                                </p>
                            )}
                        </CardContent>
                    </section>
                </Card>
            </div>
            <p className="m-0 max-w-[72ch] text-muted-foreground text-xs leading-relaxed">
                Số liệu tính trên các phiên bản đã xuất bản. Một người có thể có nhiều phiên đọc.
                Thống kê theo trang dùng danh sách trang hiện tại. Lần quét chưa nhận diện được tổng
                hợp cho cả sách.
            </p>
        </div>
    );
}
