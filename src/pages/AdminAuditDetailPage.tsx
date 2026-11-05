import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calendar, ExternalLink, ScrollText } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { adminDate, adminOperationsApi, auditLabel } from '../features/admin';
import { AuditIdSchema } from '../features/admin/operations-api';
import { auditTargetLink, operationsKeys, targetLabel } from '../features/admin/operations-model';
import { AdminActor, AuditJson } from '../features/admin/operations-ui';
import { AdminReload } from '../features/admin/ui';
import { useAuth } from '../features/auth';
import { errorMessage } from '../shared/api/errors';
import { Badge } from '../shared/ui/Badge';
import { Button } from '../shared/ui/Button';
import { Feedback } from '../shared/ui/Feedback';
import { LoadingState } from '../shared/ui/LoadingState';

function getAuditActionTone(action: string): 'success' | 'danger' | 'warning' | 'info' | 'neutral' {
    switch (action) {
        case 'LOCK_USER':
        case 'TAKE_DOWN_BOOK':
        case 'DELETE_ASSET':
            return 'danger';
        case 'CREATE_USER':
        case 'REINSTATE_BOOK':
        case 'CREATE_LIBRARY_ASSET':
            return 'success';
        case 'UNLOCK_USER':
        case 'CHANGE_ROLE':
        case 'SET_QUOTA':
        case 'RESOLVE_REPORT':
            return 'info';
        case 'RETRY_JOB':
            return 'warning';
        default:
            return 'neutral';
    }
}

export function AdminAuditDetailPage() {
    const { user } = useAuth();
    const { logId } = useParams();

    const parsed = AuditIdSchema.safeParse(logId);
    const id = parsed.success ? parsed.data : null;

    const detail = useQuery({
        queryKey: operationsKeys.auditLog(user?.id || '', id),
        queryFn: ({ signal }) => adminOperationsApi.auditLog(id || 0, signal),
        enabled: id !== null,
        retry: false,
    });

    const log = detail.isSuccess ? detail.data : null;

    return (
        <div className="mx-auto max-w-4xl space-y-6 p-6">
            {/* Thanh điều hướng quay lại */}
            <div className="flex items-center gap-2">
                <Link
                    to="/admin/audit-logs"
                    className="inline-flex items-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Về nhật ký quản trị</span>
                </Link>
            </div>

            {/* Header: Tiêu đề & Nút tải lại */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="font-semibold text-2xl text-foreground tracking-tight">
                        Chi tiết nhật ký{id !== null ? ` #${id}` : ''}
                    </h1>
                    <p className="mt-1 text-muted-foreground text-sm">
                        Bản ghi kiểm toán tại thời điểm máy chủ tiếp nhận và xử lý thao tác.
                    </p>
                </div>
                {id !== null && (
                    <AdminReload retry={() => void detail.refetch()} busy={detail.isFetching} />
                )}
            </div>

            {id === null && <Feedback error="Mã nhật ký phải là số nguyên dương hợp lệ." />}

            {id !== null && detail.isPending && (
                <LoadingState layout="detail">Đang tải nhật ký…</LoadingState>
            )}

            {id !== null && detail.isError && <Feedback error={errorMessage(detail.error)} />}

            {log && (
                <div className="space-y-6">
                    {/* Thẻ tóm tắt thông tin thao tác & thời điểm */}
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-border bg-surface p-5">
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border bg-muted/40 text-primary shadow-xs">
                                <ScrollText className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="font-semibold text-base text-foreground leading-tight">
                                        {auditLabel[log.action] || log.action}
                                    </h2>
                                    <Badge
                                        tone={getAuditActionTone(log.action)}
                                        className="text-xs font-medium"
                                    >
                                        #{log.id}
                                    </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Mã bản ghi kiểm toán hệ thống
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            <time dateTime={log.createdAt}>{adminDate(log.createdAt)}</time>
                        </div>
                    </div>

                    {/* Lưới thông tin người thực hiện & đối tượng */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4 space-y-2">
                            <span className="font-medium text-xs text-muted-foreground block">
                                Người thực hiện
                            </span>
                            <div className="font-semibold text-foreground text-sm">
                                <AdminActor actor={log.actor} />
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Mã tài khoản:{' '}
                                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground break-all">
                                    {log.actor.id}
                                </code>
                            </div>
                        </div>

                        <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-4 space-y-2">
                            <span className="font-medium text-xs text-muted-foreground block">
                                Đối tượng thao tác ({targetLabel[log.target.type] || log.target.type})
                            </span>
                            <div>
                                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold text-foreground break-all">
                                    {log.target.id}
                                </code>
                            </div>
                            <div className="pt-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    asChild
                                    className="h-7 gap-1.5 px-2.5 text-xs"
                                >
                                    <Link to={auditTargetLink(log.target.type, log.target.id)}>
                                        <ExternalLink className="h-3 w-3" />
                                        <span>Xem tất cả nhật ký của đối tượng này</span>
                                    </Link>
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Khối dữ liệu payload chi tiết */}
                    <div className="rounded-[var(--radius-lg)] border border-border bg-surface p-5 space-y-3">
                        <div>
                            <h3 className="font-semibold text-base text-foreground">
                                Dữ liệu payload thao tác
                            </h3>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                                Dữ liệu lịch sử ghi lại tại thời điểm xảy ra sự kiện. Liên kết hoặc HTML chỉ hiển thị dạng văn bản.
                            </p>
                        </div>
                        <AuditJson value={log.detail} />
                    </div>
                </div>
            )}
        </div>
    );
}
