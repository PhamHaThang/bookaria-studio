import type { ReactNode } from 'react';
import { Bar, BarChart, XAxis } from 'recharts';
import { Disclosure } from '@/shared/ui/Disclosure';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/shared/ui/primitives/chart';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/shared/ui/primitives/empty';
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/shared/ui/primitives/table';
import type { BookStats } from '../../shared/contracts/api/books.schema';

function TableRegion({ label, children }: { label: string; children: ReactNode }) {
    return (
        <section
            className="stats-table-scroll [&_th]:wrap-anywhere [&_td]:wrap-anywhere max-w-full overflow-x-auto [&_caption]:px-0 [&_caption]:py-3 [&_caption]:text-left [&_caption]:text-muted-foreground [&_table]:w-full [&_table]:min-w-95 [&_table]:text-[length:var(--text-sm)] [&_table]:[border-collapse:collapse] [&_td]:border-b-[1px] [&_td]:border-b-border [&_td]:p-3 [&_td]:text-left [&_td]:tabular-nums [&_td]:[border-bottom-style:solid] [&_td]:[vertical-align:top] [&_th]:border-b-[1px] [&_th]:border-b-border [&_th]:p-3 [&_th]:text-left [&_th]:[border-bottom-style:solid] [&_th]:[vertical-align:top] [&_thead]:bg-muted"
            aria-label={label}
        >
            {children}
        </section>
    );
}

const number = (value: number) => new Intl.NumberFormat('vi-VN').format(value);
const date = (day: string) =>
    new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(new Date(`${day}T00:00:00Z`));
const deviceLabels = { desktop: 'Máy tính', mobile: 'Điện thoại', tablet: 'Máy tính bảng' };

export function StatsContent({ stats }: { stats: BookStats }) {
    const days = [...stats.opensByDay].sort((a, b) => a.date.localeCompare(b.date));
    const hasEvents = Object.values(stats.totals).some((value) => value > 0);
    return (
        <div className="stats-content [&_>_section]:mt-8">
            <dl
                className="stats-totals m-0 grid grid-cols-[repeat(4,_minmax(0,_1fr))] gap-5 py-5 [border-block:1px_solid_var(--border-default)] max-[640px]:grid-cols-[repeat(2,_minmax(0,_1fr))] [&_dd]:mx-0 [&_dd]:mt-2 [&_dd]:mb-0 [&_dd]:font-semibold [&_dd]:text-[length:var(--text-2xl)] [&_dd]:tabular-nums [&_dt]:text-[length:var(--text-sm)] [&_dt]:text-muted-foreground max-[640px]:[&_dt]:min-h-[calc(2em_*_var(--leading-normal))]"
                aria-label="Tổng số trong khoảng đã chọn"
            >
                {[
                    ['Lượt mở', stats.totals.opens],
                    ['Phiên đọc', stats.totals.sessions],
                    ['Lượt chạm', stats.totals.taps],
                    ['Lần quét chưa nhận diện', stats.totals.scanTimeouts],
                ].map(([label, value]) => (
                    <div key={label}>
                        <dt>{label}</dt>
                        <dd>{number(Number(value))}</dd>
                    </div>
                ))}
            </dl>
            <p className="stats-note max-w-[75ch] text-[length:var(--text-sm)] text-muted-foreground [.admin-form_&]:mb-4">
                Phiên đọc không tương đương số người đọc duy nhất. Số liệu gồm các phiên bản đã xuất
                bản; bản xem trước không được tính.
            </p>
            {!hasEvents && (
                <Empty className="empty-state border-border border-t px-5 py-16 max-[760px]:px-3 max-[760px]:py-12">
                    <EmptyHeader>
                        <EmptyTitle>
                            <h2>Chưa có sự kiện đọc trong khoảng này</h2>
                        </EmptyTitle>
                        <EmptyDescription>
                            <p>
                                Chọn khoảng dài hơn hoặc chia sẻ sách đã xuất bản để bắt đầu nhận số
                                liệu.
                            </p>
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            )}
            <section aria-labelledby="daily-opens-title">
                <h2 id="daily-opens-title">Lượt mở theo ngày</h2>
                <p className="stats-note max-w-[75ch] text-[length:var(--text-sm)] text-muted-foreground [.admin-form_&]:mb-4">
                    Ngày được tính theo UTC.
                </p>
                {days.some((day) => day.opens > 0) && (
                    <figure className="stats-chart mx-0 my-5 [&_[data-slot=chart]]:h-45 [&_[data-slot=chart]]:border-b-[1px] [&_[data-slot=chart]]:border-b-input [&_[data-slot=chart]]:[border-bottom-style:solid] [&_figcaption]:flex [&_figcaption]:justify-between [&_figcaption]:gap-3 [&_figcaption]:pt-2 [&_figcaption]:text-[length:var(--text-xs)] [&_figcaption]:text-muted-foreground [&_svg]:block [&_svg]:w-full">
                        <ChartContainer
                            config={{ opens: { label: 'Lượt mở', color: 'var(--action-primary)' } }}
                            className="h-45 w-full"
                            aria-label="Lượt mở sách theo ngày"
                        >
                            <BarChart accessibilityLayer data={days}>
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={date}
                                    tickLine={false}
                                    axisLine={false}
                                    minTickGap={30}
                                />
                                <ChartTooltip
                                    content={
                                        <ChartTooltipContent
                                            labelFormatter={(label) => date(String(label))}
                                        />
                                    }
                                />
                                <Bar
                                    dataKey="opens"
                                    fill="var(--color-opens)"
                                    radius={[3, 3, 0, 0]}
                                    isAnimationActive={false}
                                />
                            </BarChart>
                        </ChartContainer>
                        <figcaption>
                            <span>{days[0] && date(days[0].date)}</span>
                            <span>{days.length > 1 && date(days[days.length - 1].date)}</span>
                        </figcaption>
                    </figure>
                )}
                <Disclosure
                    title={<> Xem số liệu từng ngày </>}
                    className="stats-days [&_[data-slot=accordion-trigger]]:cursor-pointer [&_[data-slot=accordion-trigger]]:py-3"
                >
                    <TableRegion label="Bảng lượt mở theo ngày">
                        <Table>
                            <TableCaption>Lượt mở từng ngày (UTC)</TableCaption>
                            <TableHeader>
                                <TableRow>
                                    <TableHead scope="col">Ngày</TableHead>
                                    <TableHead scope="col">Lượt mở</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {days.map((day) => (
                                    <TableRow key={day.date}>
                                        <TableHead scope="row">{date(day.date)}</TableHead>
                                        <TableCell>{number(day.opens)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableRegion>
                </Disclosure>
            </section>
            <section aria-labelledby="page-stats-title">
                <h2 id="page-stats-title">Tương tác theo trang</h2>
                <p className="stats-note max-w-[75ch] text-[length:var(--text-sm)] text-muted-foreground [.admin-form_&]:mb-4">
                    Bảng dùng danh sách trang hiện tại. Lần quét chưa nhận diện được tổng hợp cho cả
                    sách.
                </p>
                {stats.byPage.length ? (
                    <TableRegion label="Bảng tương tác theo trang">
                        <Table>
                            <TableCaption>Nhận diện AR và chạm đối tượng</TableCaption>
                            <TableHeader>
                                <TableRow>
                                    <TableHead scope="col">Trang</TableHead>
                                    <TableHead scope="col">Nhận diện AR</TableHead>
                                    <TableHead scope="col">Lượt chạm</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stats.byPage.map((page) => (
                                    <TableRow key={page.pageId}>
                                        <TableHead scope="row">
                                            {page.pageNumber}. {page.title || 'Trang chưa đặt tên'}
                                        </TableHead>
                                        <TableCell>{number(page.found)}</TableCell>
                                        <TableCell>{number(page.taps)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableRegion>
                ) : (
                    <p>Sách chưa có trang.</p>
                )}
            </section>
            <section aria-labelledby="device-stats-title">
                <h2 id="device-stats-title">Thiết bị đọc</h2>
                {stats.byDevice.length ? (
                    <TableRegion label="Bảng phiên đọc theo thiết bị">
                        <Table>
                            <TableCaption>
                                Phiên đọc theo nhóm thiết bị và hệ điều hành
                            </TableCaption>
                            <TableHeader>
                                <TableRow>
                                    <TableHead scope="col">Thiết bị</TableHead>
                                    <TableHead scope="col">Hệ điều hành</TableHead>
                                    <TableHead scope="col">Phiên đọc</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stats.byDevice.map((device) => (
                                    <TableRow key={`${device.type}:${device.os}`}>
                                        <TableHead scope="row">
                                            {deviceLabels[device.type]}
                                        </TableHead>
                                        <TableCell>{device.os || 'Chưa xác định'}</TableCell>
                                        <TableCell>{number(device.count)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableRegion>
                ) : (
                    <p>Chưa có dữ liệu thiết bị trong khoảng này.</p>
                )}
            </section>
        </div>
    );
}
