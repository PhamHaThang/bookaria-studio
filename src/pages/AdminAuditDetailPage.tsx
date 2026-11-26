import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { adminOperationsApi } from '../features/admin';
import {
    AuditLogDetails,
    AuditTargetHistoryLink,
} from '../features/admin/components/AuditLogDetails';
import { AuditIdSchema } from '../features/admin/operations-api';
import { operationsKeys } from '../features/admin/operations-model';
import { AdminReload } from '../features/admin/ui';
import { useAuth } from '../features/auth';
import { errorMessage } from '../shared/api/errors';
import { Feedback } from '../shared/ui/Feedback';
import { LoadingState } from '../shared/ui/LoadingState';
import { RetryNotice } from '../shared/ui/RetryNotice';

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
        <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
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
                        Người thực hiện, đối tượng và dữ liệu ghi nhận khi thao tác.
                    </p>
                </div>
                {id !== null && (
                    <AdminReload retry={() => void detail.refetch()} busy={detail.isFetching} />
                )}
            </div>

            {id === null && (
                <Feedback error="Mã nhật ký phải là số nguyên dương hợp lệ." errorMode="toast" />
            )}

            {id !== null && detail.isPending && (
                <LoadingState layout="detail">Đang tải nhật ký…</LoadingState>
            )}

            {id !== null && detail.isError && (
                <RetryNotice
                    message={errorMessage(detail.error)}
                    busy={detail.isFetching}
                    onRetry={() => void detail.refetch()}
                />
            )}

            {log && (
                <div className="grid gap-4">
                    <AuditLogDetails log={log} />
                    <div className="flex justify-end">
                        <AuditTargetHistoryLink log={log} />
                    </div>
                </div>
            )}
        </div>
    );
}
