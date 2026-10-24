import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/shared/ui/primitives/table';
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
            <div className="page-heading insights-heading [&_h1]:wrap-anywhere mx-0 mt-0 mb-7 flex items-center justify-between gap-6 max-[760px]:mb-6 max-[640px]:flex-col max-[700px]:flex-wrap max-[640px]:items-start max-[700px]:items-start max-[760px]:items-start max-[700px]:gap-3 max-[760px]:gap-4 max-[700px]:[&_>_.button]:max-w-full max-[700px]:[&_>_.button]:flex-[0_0_auto] [&_>_div]:min-w-0 max-[640px]:[&_>_div]:w-full max-[700px]:[&_>_div]:flex-[1_1_180px] [&_h1]:font-semibold [&_h1]:text-[length:28px] [&_h1]:tracking-[-0.025em] max-[700px]:[&_h1]:text-[length:25px] max-[760px]:[&_h1]:text-[length:var(--text-2xl)] [&_p]:mx-0 [&_p]:mt-2 [&_p]:mb-0 [&_p]:max-w-[64ch] [&_p]:text-[length:13px] [&_p]:text-muted-foreground max-[760px]:[&_p]:text-[length:var(--text-sm)] [.page-editor-screen[data-mode=content]_>_&]:hidden [.studio-editing_&]:mb-2 [.studio-editing_&_h1]:ml-4 [.studio-editing_&_h1]:inline [.studio-editing_&_h1]:text-[length:21px] max-[700px]:[.studio-editing_&_h1]:mx-0 max-[700px]:[.studio-editing_&_h1]:mt-[6px] max-[700px]:[.studio-editing_&_h1]:mb-0 max-[700px]:[.studio-editing_&_h1]:block [.studio-editing_&_p]:ml-[14px] [.studio-editing_&_p]:inline [.studio-editing_&_p]:text-[length:11px] max-[700px]:[.studio-editing_&_p]:mx-0 max-[700px]:[.studio-editing_&_p]:my-1 max-[700px]:[.studio-editing_&_p]:block [:where(.studio-main_>_&)]:mx-auto [:where(.studio-main_>_&)]:max-w-375">
                <div>
                    <h1>Tổng quan quản trị</h1>
                    <p>Số liệu hệ thống và những việc cần xử lý.</p>
                </div>
                <AdminReload retry={() => void query.refetch()} busy={query.isFetching} />
            </div>
            <dl className="admin-facts [&_dd]:wrap-anywhere my-5 grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-[var(--space-4)_var(--space-6)] max-[640px]:grid-cols-[1fr] [&_>_div]:border-b-[1px] [&_>_div]:border-b-border [&_>_div]:py-3 [&_>_div]:[border-bottom-style:solid] [&_dd]:mx-0 [&_dd]:mt-2 [&_dd]:mb-0 [&_dd]:tabular-nums [&_dt]:text-[length:var(--text-sm)] [&_dt]:text-muted-foreground">
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
            <section className="admin-section mt-8">
                <h2>Sách xuất bản lần đầu trong 7 ngày</h2>
                <p className="stats-note max-w-[75ch] text-[length:var(--text-sm)] text-muted-foreground [.admin-form_&]:mb-4">
                    Ngày tính theo giờ Việt Nam (Asia/Ho_Chi_Minh). Mỗi sách được tính ở lần xuất
                    bản đầu, không tính lại khi cập nhật phiên bản.
                </p>
                <AdminTable label="Sách xuất bản theo ngày">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead scope="col">Ngày</TableHead>
                                <TableHead scope="col">Số sách</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.publishedPerDay.map((row) => (
                                <TableRow key={row.date}>
                                    <TableHead scope="row">{row.date}</TableHead>
                                    <TableCell>{row.count}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </AdminTable>
            </section>
            <section className="admin-section mt-8">
                <h2>Thao tác quản trị hôm nay</h2>
                {data.auditActionsToday.length ? (
                    <ul className="admin-rows [&_>_li]:wrap-anywhere mx-0 my-4 list-none p-0 [&_>_li]:flex [&_>_li]:items-start [&_>_li]:justify-between [&_>_li]:gap-5 [&_>_li]:border-b-[1px] [&_>_li]:border-b-border [&_>_li]:py-5 [&_>_li]:[border-bottom-style:solid] max-[640px]:[&_>_li]:flex-col max-[640px]:[&_>_li]:gap-3 [&_h2]:mx-0 [&_h2]:mt-0 [&_h2]:mb-2 [&_h2]:text-[length:var(--text-md)] [&_h3]:mx-0 [&_h3]:mt-0 [&_h3]:mb-2 [&_h3]:text-[length:var(--text-md)] [&_p]:mx-0 [&_p]:my-2">
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
