import { useQuery } from '@tanstack/react-query';
import { Calendar, ExternalLink, ScrollText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { adminDate, adminOperationsApi, auditLabel } from '@/features/admin';
import { auditTargetLink, operationsKeys, targetLabel } from '@/features/admin/operations-model';
import { AdminActor, AuditJson } from '@/features/admin/operations-ui';
import { useAuth } from '@/features/auth';
import { errorMessage } from '@/shared/api/errors';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Feedback } from '@/shared/ui/Feedback';
import { LoadingState } from '@/shared/ui/LoadingState';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/shared/ui/primitives/dialog';

export interface AuditLogDetailModalProps {
    logId: number | null;
    isOpen: boolean;
    onClose: () => void;
}

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

export function AuditLogDetailModal({ logId, isOpen, onClose }: AuditLogDetailModalProps) {
    const { user } = useAuth();

    const detailQuery = useQuery({
        queryKey: operationsKeys.auditLog(user?.id || '', logId),
        queryFn: ({ signal }) => adminOperationsApi.auditLog(logId || 0, signal),
        enabled: isOpen && logId !== null,
        retry: false,
    });

    const log = detailQuery.isSuccess ? detailQuery.data : null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90dvh] max-w-2xl space-y-4 overflow-y-auto p-5 sm:p-6">
                <DialogHeader className="gap-1 pb-0.5">
                    <DialogTitle className="m-0 flex items-center gap-2 font-semibold text-base text-foreground leading-tight sm:text-lg">
                        <ScrollText className="h-5 w-5 shrink-0 text-primary" />
                        <span>Chi tiết nhật ký quản trị {logId ? `(#${logId})` : ''}</span>
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
                        Bản ghi kiểm toán bất biến tại thời điểm máy chủ tiếp nhận và thực thi thao
                        tác.
                    </DialogDescription>
                </DialogHeader>

                {detailQuery.isPending && (
                    <LoadingState layout="detail">Đang tải chi tiết nhật ký…</LoadingState>
                )}

                {detailQuery.isError && <Feedback error={errorMessage(detailQuery.error)} />}

                {log && (
                    <div className="space-y-4">
                        {/* Thanh thông tin tóm tắt thao tác & thời điểm */}
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-surface/50 p-3">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground text-sm">
                                    {auditLabel[log.action] || log.action}
                                </span>
                                <Badge tone={getAuditActionTone(log.action)} className="text-xs">
                                    #{log.id}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Calendar className="h-3.5 w-3.5" />
                                <span>{adminDate(log.createdAt)}</span>
                            </div>
                        </div>

                        {/* Lưới thông tin người thực hiện & đối tượng */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-1 text-xs">
                                <span className="font-medium text-muted-foreground block">
                                    Người thực hiện:
                                </span>
                                <div className="font-semibold text-foreground">
                                    <AdminActor actor={log.actor} />
                                </div>
                                <code className="block font-mono text-[11px] text-muted-foreground break-all">
                                    {log.actor.id}
                                </code>
                            </div>

                            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-1 text-xs">
                                <span className="font-medium text-muted-foreground block">
                                    Đối tượng ({targetLabel[log.target.type] || log.target.type}):
                                </span>
                                <code className="block font-mono text-xs font-semibold text-foreground break-all">
                                    {log.target.id}
                                </code>
                                <div className="pt-1">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        asChild
                                        className="h-6 gap-1 px-2 text-[11px]"
                                    >
                                        <Link
                                            to={auditTargetLink(log.target.type, log.target.id)}
                                            onClick={onClose}
                                        >
                                            <ExternalLink className="h-3 w-3" />
                                            <span>Xem nhật ký đối tượng này</span>
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Chi tiết dữ liệu JSON */}
                        <div className="space-y-2">
                            <h4 className="font-semibold text-xs text-foreground">
                                Dữ liệu payload thao tác
                            </h4>
                            <p className="text-[11px] text-muted-foreground">
                                Dữ liệu lịch sử có thể khác trạng thái hiện tại. Liên kết hoặc HTML
                                trong dữ liệu chỉ hiển thị dạng văn bản.
                            </p>
                            <AuditJson value={log.detail} />
                        </div>
                    </div>
                )}

                <DialogFooter className="mt-2 border-border/60 border-t pt-2">
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-8 px-3 text-xs"
                        onClick={onClose}
                    >
                        Đóng
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
