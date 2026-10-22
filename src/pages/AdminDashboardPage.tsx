import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { adminApi, adminKeys, auditLabel, bytesLabel } from '../features/admin';
import { AdminReload, AdminTable } from '../features/admin/ui';
import { useAuth } from '../features/auth';

export function AdminDashboardPage() {
    const { user } = useAuth();
    const query = useQuery({
        queryKey: adminKeys.dashboard(user?.id || ''),
        queryFn: ({ signal }) => adminApi.dashboard(signal),
        staleTime: 10000,
        retry: false,
    });
    const data = query.data;
    if (!data) return null;
    return (
        <>
            <div className="page-heading insights-heading">
                <div>
                    <h1>Tổng quan quản trị</h1>
                    <p>Số liệu hệ thống và những việc cần xử lý.</p>
                </div>
                <AdminReload retry={() => void query.refetch()} busy={query.isFetching} />
            </div>
            <dl className="admin-facts">
                <div>
                    <dt>Người dùng</dt>
                    <dd>
                        <Link to="/admin/users">{data.users}</Link>
                    </dd>
                </div>
                <div>
                    <dt>Sách từng xuất bản, chưa xóa</dt>
                    <dd>{data.publishedBooks}</dd>
                </div>
                <div>
                    <dt>Dung lượng đã dùng</dt>
                    <dd>{bytesLabel(data.storageUsedBytes)}</dd>
                </div>
                <div>
                    <dt>Tác vụ lỗi trong 24 giờ</dt>
                    <dd>{data.failedJobs24h}</dd>
                </div>
                <div>
                    <dt>Báo cáo đang chờ</dt>
                    <dd>
                        <Link to="/admin/moderation">{data.openReports}</Link>
                    </dd>
                </div>
            </dl>
            <section className="admin-section">
                <h2>Sách xuất bản lần đầu trong 7 ngày</h2>
                <p className="stats-note">
                    Ngày tính theo giờ Việt Nam (Asia/Ho_Chi_Minh). Mỗi sách được tính ở lần xuất
                    bản đầu, không tính lại khi cập nhật phiên bản.
                </p>
                <AdminTable label="Sách xuất bản theo ngày">
                    <table>
                        <thead>
                            <tr>
                                <th scope="col">Ngày</th>
                                <th scope="col">Số sách</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.publishedPerDay.map((row) => (
                                <tr key={row.date}>
                                    <th scope="row">{row.date}</th>
                                    <td>{row.count}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </AdminTable>
            </section>
            <section className="admin-section">
                <h2>Thao tác quản trị hôm nay</h2>
                {data.auditActionsToday.length ? (
                    <ul className="admin-rows">
                        {data.auditActionsToday.map((row) => (
                            <li key={row.action}>
                                <span>{auditLabel[row.action]}</span>
                                <strong>{row.count}</strong>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>Chưa ghi nhận thao tác hôm nay.</p>
                )}
            </section>
        </>
    );
}
