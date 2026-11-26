import { useQuery } from '@tanstack/react-query';
import { adminOperationsApi } from '@/features/admin';
import { operationsKeys } from '@/features/admin/operations-model';
import { useAuth } from '@/features/auth';
import { errorMessage } from '@/shared/api/errors';
import { Button } from '@/shared/ui/Button';
import { LoadingState } from '@/shared/ui/LoadingState';
import { DialogFooter } from '@/shared/ui/primitives/dialog';
import { RetryNotice } from '@/shared/ui/RetryNotice';
import { AdminDialog } from './AdminDialog';
import { AuditLogDetails, AuditTargetHistoryLink } from './AuditLogDetails';

export interface AuditLogDetailModalProps {
    logId: number | null;
    isOpen: boolean;
    onClose: () => void;
}

export function AuditLogDetailModal({ logId, isOpen, onClose }: AuditLogDetailModalProps) {
    const { user } = useAuth();
    const detail = useQuery({
        queryKey: operationsKeys.auditLog(user?.id || '', logId),
        queryFn: ({ signal }) => adminOperationsApi.auditLog(logId || 0, signal),
        enabled: isOpen && logId !== null,
        retry: false,
    });

    const log = detail.data;

    return (
        <AdminDialog
            open={isOpen}
            onClose={onClose}
            title={logId === null ? 'Chi tiết nhật ký' : `Chi tiết nhật ký #${logId}`}
            description="Người thực hiện, đối tượng và dữ liệu ghi nhận khi thao tác."
            className="max-w-[min(680px,calc(100vw-32px))]"
        >
            <div className="-mx-1 min-h-0 overflow-y-auto px-1 pb-1">
                {detail.isPending && (
                    <LoadingState layout="detail">Đang tải chi tiết nhật ký…</LoadingState>
                )}
                {detail.isError && (
                    <RetryNotice
                        message={errorMessage(detail.error)}
                        busy={detail.isFetching}
                        onRetry={() => void detail.refetch()}
                    />
                )}
                {log && <AuditLogDetails log={log} />}
            </div>

            <DialogFooter className="mt-0 shrink-0 flex-row flex-wrap items-center justify-end border-0 pt-0">
                <Button type="button" variant="outline" onClick={onClose}>
                    Đóng
                </Button>
                {log && <AuditTargetHistoryLink log={log} onClick={onClose} />}
            </DialogFooter>
        </AdminDialog>
    );
}
