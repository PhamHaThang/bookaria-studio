import type { ReactNode } from 'react';
import type { BookStats } from '../../shared/contracts/api/books.schema';

function TableRegion({ label, children }: { label: string; children: ReactNode }) {
    return (
        // biome-ignore lint/a11y/noNoninteractiveTabindex: Keyboard users need focus to scroll wide data tables.
        <section className="stats-table-scroll" aria-label={label} tabIndex={0}>
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
    const maximum = Math.max(1, ...days.map((day) => day.opens));
    const hasEvents = Object.values(stats.totals).some((value) => value > 0);
    return (
        <div className="stats-content">
            <dl className="stats-totals" aria-label="Tổng số trong khoảng đã chọn">
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
            <p className="stats-note">
                Phiên đọc không tương đương số người đọc duy nhất. Số liệu gồm các phiên bản đã xuất
                bản; bản xem trước không được tính.
            </p>
            {!hasEvents && (
                <section className="empty-state">
                    <h2>Chưa có sự kiện đọc trong khoảng này</h2>
                    <p>
                        Chọn khoảng dài hơn hoặc chia sẻ sách đã xuất bản để bắt đầu nhận số liệu.
                    </p>
                </section>
            )}
            <section aria-labelledby="daily-opens-title">
                <h2 id="daily-opens-title">Lượt mở theo ngày</h2>
                <p className="stats-note">Ngày được tính theo UTC.</p>
                {days.some((day) => day.opens > 0) && (
                    <figure className="stats-chart">
                        <svg
                            viewBox="0 0 800 160"
                            preserveAspectRatio="none"
                            role="img"
                            aria-labelledby="opens-chart-title"
                            aria-describedby="opens-chart-description"
                        >
                            <title id="opens-chart-title">Lượt mở sách theo ngày</title>
                            <desc id="opens-chart-description">
                                Biểu đồ cột. Số liệu chính xác có trong bảng từng ngày bên dưới.
                            </desc>
                            {days.map((day, i) => (
                                <rect
                                    key={day.date}
                                    x={(i * 800) / days.length}
                                    y={160 - (day.opens / maximum) * 150}
                                    width={Math.max(1, 800 / days.length - 2)}
                                    height={(day.opens / maximum) * 150}
                                    fill="var(--action-primary)"
                                >
                                    <title>
                                        {date(day.date)}: {number(day.opens)} lượt mở
                                    </title>
                                </rect>
                            ))}
                        </svg>
                        <figcaption>
                            <span>{days[0] && date(days[0].date)}</span>
                            <span>{days.length > 1 && date(days[days.length - 1].date)}</span>
                        </figcaption>
                    </figure>
                )}
                <details className="stats-days">
                    <summary>Xem số liệu từng ngày</summary>
                    <TableRegion label="Bảng lượt mở theo ngày">
                        <table>
                            <caption>Lượt mở từng ngày (UTC)</caption>
                            <thead>
                                <tr>
                                    <th scope="col">Ngày</th>
                                    <th scope="col">Lượt mở</th>
                                </tr>
                            </thead>
                            <tbody>
                                {days.map((day) => (
                                    <tr key={day.date}>
                                        <th scope="row">{date(day.date)}</th>
                                        <td>{number(day.opens)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </TableRegion>
                </details>
            </section>
            <section aria-labelledby="page-stats-title">
                <h2 id="page-stats-title">Tương tác theo trang</h2>
                <p className="stats-note">
                    Bảng dùng danh sách trang hiện tại. Lần quét chưa nhận diện được tổng hợp cho cả
                    sách.
                </p>
                {stats.byPage.length ? (
                    <TableRegion label="Bảng tương tác theo trang">
                        <table>
                            <caption>Nhận diện AR và chạm đối tượng</caption>
                            <thead>
                                <tr>
                                    <th scope="col">Trang</th>
                                    <th scope="col">Nhận diện AR</th>
                                    <th scope="col">Lượt chạm</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.byPage.map((page) => (
                                    <tr key={page.pageId}>
                                        <th scope="row">
                                            {page.pageNumber}. {page.title || 'Trang chưa đặt tên'}
                                        </th>
                                        <td>{number(page.found)}</td>
                                        <td>{number(page.taps)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </TableRegion>
                ) : (
                    <p>Sách chưa có trang.</p>
                )}
            </section>
            <section aria-labelledby="device-stats-title">
                <h2 id="device-stats-title">Thiết bị đọc</h2>
                {stats.byDevice.length ? (
                    <TableRegion label="Bảng phiên đọc theo thiết bị">
                        <table>
                            <caption>Phiên đọc theo nhóm thiết bị và hệ điều hành</caption>
                            <thead>
                                <tr>
                                    <th scope="col">Thiết bị</th>
                                    <th scope="col">Hệ điều hành</th>
                                    <th scope="col">Phiên đọc</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.byDevice.map((device) => (
                                    <tr key={`${device.type}:${device.os}`}>
                                        <th scope="row">{deviceLabels[device.type]}</th>
                                        <td>{device.os || 'Chưa xác định'}</td>
                                        <td>{number(device.count)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </TableRegion>
                ) : (
                    <p>Chưa có dữ liệu thiết bị trong khoảng này.</p>
                )}
            </section>
        </div>
    );
}
