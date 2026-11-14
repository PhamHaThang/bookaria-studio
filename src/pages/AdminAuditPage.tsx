import { useQuery } from '@tanstack/react-query';
import { Eye, ScrollText } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuditLogDetailModal, adminDate, adminOperationsApi, auditLabel } from '../features/admin';
import { operationsKeys, readAuditSearch, targetLabel } from '../features/admin/operations-model';
import { AdminActor } from '../features/admin/operations-ui';
import { AdminPager, AdminReload } from '../features/admin/ui';
import { useAuth } from '../features/auth';
import { errorMessage } from '../shared/api/errors';
import { AuditActionSchema, AuditTargetTypeSchema } from '../shared/contracts/enums.schema';
import { Badge } from '../shared/ui/Badge';
import { Button } from '../shared/ui/Button';
import { Feedback } from '../shared/ui/Feedback';
import { SelectFilter, TextFilter } from '../shared/ui/LiveFilters';
import { LoadingState } from '../shared/ui/LoadingState';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../shared/ui/primitives/empty';
import { Field, FieldGroup, FieldLabel } from '../shared/ui/primitives/field';

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

interface AdminAuditItemProps {
    log: {
        id: number;
        action: string;
        createdAt: string;
        actor: { id: string; displayName: string } | null;
        target: { id: string; type: string };
    };
    onViewDetails: (logId: number) => void;
}

function AdminAuditItem({ log, onViewDetails }: AdminAuditItemProps) {
    const actionTone = getAuditActionTone(log.action);

    return (
        <li className="group rounded-[var(--radius-lg)] border border-border bg-surface p-5 transition-all hover:border-primary/40 hover:shadow-xs space-y-3.5">
            {/* Hàng 1: Icon + Tên hành động + Mã log + Nút Xem chi tiết */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-1 items-start gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border bg-muted/40 shadow-xs text-primary">
                        <ScrollText className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => onViewDetails(log.id)}
                                className="truncate text-left font-semibold text-base text-foreground transition-colors hover:text-primary focus-visible:underline focus-visible:outline-none"
                            >
                                {auditLabel[log.action as keyof typeof auditLabel] || log.action}
                            </button>
                            <Badge tone={actionTone} className="px-2 py-0.5 font-medium text-xs">
                                #{log.id}
                            </Badge>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            Thời điểm:{' '}
                            <span className="text-foreground">{adminDate(log.createdAt)}</span>
                        </p>
                    </div>
                </div>

                {/* Nút Xem chi tiết mở modal */}
                <div className="flex shrink-0 items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => onViewDetails(log.id)}
                        className="h-8 gap-1.5 px-3 text-xs"
                    >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Xem chi tiết</span>
                    </Button>
                </div>
            </div>

            {/* Hàng 2: Chi tiết người thực hiện & đối tượng */}
            <div className="grid grid-cols-1 gap-2.5 rounded-lg border border-border/50 bg-muted/20 p-3 text-xs sm:grid-cols-2">
                <div className="flex items-center gap-1.5 truncate">
                    <span className="text-muted-foreground shrink-0">Người thực hiện:</span>
                    <span className="font-medium text-foreground truncate">
                        <AdminActor actor={log.actor} />
                    </span>
                </div>
                <div className="flex items-center gap-1.5 truncate">
                    <span className="text-muted-foreground shrink-0">
                        {targetLabel[log.target.type as keyof typeof targetLabel] || 'Đối tượng'}:
                    </span>
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground truncate">
                        {log.target.id}
                    </code>
                </div>
            </div>
        </li>
    );
}

export function AdminAuditPage() {
    const { user } = useAuth();
    const [params] = useSearchParams();

    const parsed = readAuditSearch(params);
    const query = parsed.success ? parsed.data : null;

    const [selectedLogId, setSelectedLogId] = useState<number | null>(null);

    const list = useQuery({
        queryKey: operationsKeys.audit(user?.id || '', query),
        queryFn: ({ signal }) => adminOperationsApi.audit(query || {}, signal),
        enabled: query !== null,
        retry: false,
    });

    const hasFilters = Boolean(
        params.get('action') ||
            params.get('actorId') ||
            params.get('targetType') ||
            params.get('targetId'),
    );

    return (
        <div className="mx-auto max-w-6xl space-y-6 p-6">
            {/* Header: Tiêu đề & Mô tả */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="font-semibold text-2xl text-foreground tracking-tight">
                        Nhật ký quản trị
                    </h1>
                    <p className="mt-1 text-muted-foreground text-sm">
                        Đối chiếu người thực hiện, đối tượng và nội dung từng thao tác quản trị.
                    </p>
                </div>
            </div>

            {/* Thanh Bộ lọc & Tìm kiếm đồng bộ */}
            <form
                className="rounded-[var(--radius-lg)] border border-border bg-surface p-4"
                onSubmit={(event) => event.preventDefault()}
            >
                <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {/* 1. Lọc theo Thao tác */}
                    <Field orientation="contents">
                        <FieldLabel htmlFor="audit-action" className="font-medium text-xs">
                            Thao tác
                            <SelectFilter
                                id="audit-action"
                                name="action"
                                value={params.get('action') || ''}
                                options={[
                                    { value: '', label: 'Tất cả thao tác' },
                                    ...(AuditActionSchema.options.map((value) => ({
                                        value,
                                        label: auditLabel[value],
                                    })) ?? []),
                                ]}
                            />
                        </FieldLabel>
                    </Field>

                    {/* 2. Lọc theo Loại đối tượng */}
                    <Field orientation="contents">
                        <FieldLabel htmlFor="audit-target-type" className="font-medium text-xs">
                            Loại đối tượng
                            <SelectFilter
                                id="audit-target-type"
                                name="targetType"
                                value={params.get('targetType') || ''}
                                options={[
                                    { value: '', label: 'Tất cả đối tượng' },
                                    ...(AuditTargetTypeSchema.options.map((value) => ({
                                        value,
                                        label: targetLabel[value],
                                    })) ?? []),
                                ]}
                            />
                        </FieldLabel>
                    </Field>

                    {/* 3. Lọc theo Người thực hiện (Actor UUID) */}
                    <Field orientation="contents">
                        <FieldLabel htmlFor="audit-actor" className="font-medium text-xs">
                            Mã người thực hiện (UUID)
                            <TextFilter
                                id="audit-actor"
                                name="actorId"
                                placeholder="Nhập UUID..."
                                pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
                                value={params.get('actorId') || ''}
                                spellCheck={false}
                                autoCapitalize="none"
                            />
                        </FieldLabel>
                    </Field>

                    {/* 4. Lọc theo Đối tượng (Target UUID) */}
                    <Field orientation="contents">
                        <FieldLabel htmlFor="audit-target" className="font-medium text-xs">
                            Mã đối tượng (UUID)
                            <TextFilter
                                id="audit-target"
                                name="targetId"
                                placeholder="Nhập UUID..."
                                pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
                                value={params.get('targetId') || ''}
                                spellCheck={false}
                                autoCapitalize="none"
                            />
                        </FieldLabel>
                    </Field>
                </FieldGroup>

                {/* Footer bar của filter: thông tin & Đặt lại bộ lọc */}
                <div className="mt-3 flex items-center justify-between border-border border-t pt-3 text-xs">
                    <span className="text-muted-foreground">
                        Hệ thống kiểm toán lưu vết toàn bộ hoạt động can thiệp dữ liệu và quản trị.
                    </span>
                    {hasFilters && (
                        <Link
                            to="/admin/audit-logs"
                            state={{ resetFilters: true }}
                            className="font-medium text-primary hover:underline"
                        >
                            Đặt lại bộ lọc
                        </Link>
                    )}
                </div>
            </form>

            {!parsed.success && (
                <Feedback error="Bộ lọc không hợp lệ. Mã người thực hiện và mã đối tượng phải là định dạng UUID hợp lệ; hãy sửa hoặc xóa bộ lọc." />
            )}

            {query && list.isPending && (
                <LoadingState layout="admin-rows">Đang tải nhật ký…</LoadingState>
            )}

            {query && list.isError && <Feedback error={errorMessage(list.error)} />}

            {query && list.isSuccess && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between text-muted-foreground text-xs">
                        <span>
                            Hiển thị{' '}
                            <strong className="text-foreground">{list.data.data.length}</strong>{' '}
                            trên <strong className="text-foreground">{list.data.meta.total}</strong>{' '}
                            bản ghi · mới nhất trước
                        </span>
                        <AdminReload retry={() => void list.refetch()} busy={list.isFetching} />
                    </div>

                    {list.data.data.length ? (
                        <ul className="list-none space-y-3.5 p-0">
                            {list.data.data.map((log) => (
                                <AdminAuditItem
                                    key={log.id}
                                    log={log}
                                    onViewDetails={(id) => setSelectedLogId(id)}
                                />
                            ))}
                        </ul>
                    ) : (
                        <Empty className="empty-state px-5 py-16">
                            <EmptyHeader>
                                <EmptyTitle>
                                    <h2>Không có nhật ký phù hợp</h2>
                                </EmptyTitle>
                                <EmptyDescription>
                                    <p>
                                        Thử bộ lọc khác hoặc đợi thao tác quản trị mới được ghi
                                        nhận.
                                    </p>
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    )}

                    <div className="pt-2">
                        <AdminPager
                            page={query.page}
                            meta={list.data.meta}
                            busy={list.isFetching}
                        />
                    </div>
                </div>
            )}

            {/* Modal xem chi tiết nhật ký kiểm toán */}
            <AuditLogDetailModal
                logId={selectedLogId}
                isOpen={selectedLogId !== null}
                onClose={() => setSelectedLogId(null)}
            />
        </div>
    );
}
