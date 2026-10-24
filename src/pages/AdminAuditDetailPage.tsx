import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { LoadingState } from '@/shared/ui/LoadingState';
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
            <div className="page-heading insights-heading [&_h1]:wrap-anywhere mx-0 mt-0 mb-7 flex items-center justify-between gap-6 max-[760px]:mb-6 max-[640px]:flex-col max-[700px]:flex-wrap max-[640px]:items-start max-[700px]:items-start max-[760px]:items-start max-[700px]:gap-3 max-[760px]:gap-4 max-[700px]:[&_>_.button]:max-w-full max-[700px]:[&_>_.button]:flex-[0_0_auto] [&_>_div]:min-w-0 max-[640px]:[&_>_div]:w-full max-[700px]:[&_>_div]:flex-[1_1_180px] [&_h1]:font-semibold [&_h1]:text-[length:28px] [&_h1]:tracking-[-0.025em] max-[700px]:[&_h1]:text-[length:25px] max-[760px]:[&_h1]:text-[length:var(--text-2xl)] [&_p]:mx-0 [&_p]:mt-2 [&_p]:mb-0 [&_p]:max-w-[64ch] [&_p]:text-[length:13px] [&_p]:text-muted-foreground max-[760px]:[&_p]:text-[length:var(--text-sm)] [.page-editor-screen[data-mode=content]_>_&]:hidden [.studio-editing_&]:mb-2 [.studio-editing_&_h1]:ml-4 [.studio-editing_&_h1]:inline [.studio-editing_&_h1]:text-[length:21px] max-[700px]:[.studio-editing_&_h1]:mx-0 max-[700px]:[.studio-editing_&_h1]:mt-[6px] max-[700px]:[.studio-editing_&_h1]:mb-0 max-[700px]:[.studio-editing_&_h1]:block [.studio-editing_&_p]:ml-[14px] [.studio-editing_&_p]:inline [.studio-editing_&_p]:text-[length:11px] max-[700px]:[.studio-editing_&_p]:mx-0 max-[700px]:[.studio-editing_&_p]:my-1 max-[700px]:[.studio-editing_&_p]:block [:where(.studio-main_>_&)]:mx-auto [:where(.studio-main_>_&)]:max-w-375">
                <div>
                    <h1>Chi tiết nhật ký{id !== null ? ` #${id}` : ''}</h1>
                    <p>Bản ghi thao tác tại thời điểm máy chủ ghi nhận.</p>
                </div>
                {id !== null && (
                    <AdminReload retry={() => void detail.refetch()} busy={detail.isFetching} />
                )}
            </div>
            {id === null && <Feedback error="Mã nhật ký phải là số nguyên dương hợp lệ." />}
            {id !== null && detail.isPending && <LoadingState>Đang tải nhật ký…</LoadingState>}
            {id !== null && detail.isError && <Feedback error={errorMessage(detail.error)} />}
            {log && (
                <>
                    <dl className="admin-facts [&_dd]:wrap-anywhere my-5 grid grid-cols-[repeat(2,_minmax(0,_1fr))] gap-[var(--space-4)_var(--space-6)] max-[640px]:grid-cols-[1fr] [&_>_div]:border-b-[1px] [&_>_div]:border-b-border [&_>_div]:py-3 [&_>_div]:[border-bottom-style:solid] [&_dd]:mx-0 [&_dd]:mt-2 [&_dd]:mb-0 [&_dd]:tabular-nums [&_dt]:text-[length:var(--text-sm)] [&_dt]:text-muted-foreground">
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
                                <code className="admin-id wrap-anywhere">{log.actor.id}</code>
                            </dd>
                        </div>
                        <div>
                            <dt>Đối tượng · {targetLabel[log.target.type]}</dt>
                            <dd>
                                <code className="admin-id wrap-anywhere">{log.target.id}</code>
                            </dd>
                        </div>
                    </dl>
                    <p>
                        <Link to={auditTargetLink(log.target.type, log.target.id)}>
                            Các thao tác trên cùng đối tượng
                        </Link>
                    </p>
                    <section className="admin-section mt-8">
                        <h2>Dữ liệu thao tác</h2>
                        <p className="stats-note max-w-[75ch] text-[length:var(--text-sm)] text-muted-foreground [.admin-form_&]:mb-4">
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
