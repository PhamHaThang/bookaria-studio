import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { adminDate, adminOperationsApi, auditLabel } from '../features/admin';
import { AuditIdSchema } from '../features/admin/operations-api';
import { auditTargetLink, operationsKeys, targetLabel } from '../features/admin/operations-model';
import { AdminActor, AuditJson } from '../features/admin/operations-ui';
import { AdminReload } from '../features/admin/ui';
import { useAuth } from '../features/auth';
import { errorMessage } from '../shared/api/errors';
import { Feedback } from '../shared/ui/Feedback';

export function AdminAuditDetailPage() {
    const { user } = useAuth(),
        { logId } = useParams();
    const parsed = AuditIdSchema.safeParse(logId),
        id = parsed.success ? parsed.data : null;
    const detail = useQuery({
        queryKey: operationsKeys.auditLog(user?.id || '', id),
        queryFn: ({ signal }) => adminOperationsApi.auditLog(id || 0, signal),
        enabled: id !== null,
        retry: false,
    });
    const log = detail.isSuccess ? detail.data : null;
    return (
        <>
            <p>
                <Link to="/admin/audit-logs">← Nhật ký quản trị</Link>
            </p>
            <div className="page-heading insights-heading">
                <div>
                    <h1>Chi tiết nhật ký{id !== null ? ` #${id}` : ''}</h1>
                    <p>Bản ghi thao tác tại thời điểm máy chủ ghi nhận.</p>
                </div>
                {id !== null && (
                    <AdminReload retry={() => void detail.refetch()} busy={detail.isFetching} />
                )}
            </div>
            {id === null && <Feedback error="Mã nhật ký phải là số nguyên dương hợp lệ." />}
            {id !== null && detail.isPending && <p role="status">Đang tải nhật ký…</p>}
            {id !== null && detail.isError && <Feedback error={errorMessage(detail.error)} />}
            {log && (
                <>
                    <dl className="admin-facts">
                        <div>
                            <dt>Thao tác</dt>
                            <dd>{auditLabel[log.action]}</dd>
                        </div>
                        <div>
                            <dt>Thời điểm</dt>
                            <dd>
                                <time dateTime={log.createdAt}>{adminDate(log.createdAt)}</time>
                            </dd>
                        </div>
                        <div>
                            <dt>Người thực hiện</dt>
                            <dd>
                                <AdminActor actor={log.actor} />
                                <br />
                                <code className="admin-id">{log.actor.id}</code>
                            </dd>
                        </div>
                        <div>
                            <dt>Đối tượng · {targetLabel[log.target.type]}</dt>
                            <dd>
                                <code className="admin-id">{log.target.id}</code>
                            </dd>
                        </div>
                    </dl>
                    <p>
                        <Link to={auditTargetLink(log.target.type, log.target.id)}>
                            Các thao tác trên cùng đối tượng
                        </Link>
                    </p>
                    <section className="admin-section">
                        <h2>Dữ liệu thao tác</h2>
                        <p className="stats-note">
                            Dữ liệu lịch sử có thể khác trạng thái hiện tại. Liên kết hoặc HTML
                            trong dữ liệu chỉ được hiển thị dưới dạng văn bản.
                        </p>
                        <AuditJson value={log.detail} />
                    </section>
                </>
            )}
        </>
    );
}
