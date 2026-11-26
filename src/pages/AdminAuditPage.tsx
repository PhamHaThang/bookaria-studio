import { useQuery } from '@tanstack/react-query';
import { Eye, ScrollText } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuditLogDetailModal, adminDate, adminOperationsApi, auditLabel } from '../features/admin';
import { operationsKeys, readAuditSearch, targetLabel } from '../features/admin/operations-model';
import { AdminActor, auditActionTone } from '../features/admin/operations-ui';
import { AdminPager, AdminReload } from '../features/admin/ui';
import { useAuth } from '../features/auth';
import { errorMessage } from '../shared/api/errors';
import type { AuditLog } from '../shared/contracts/dto.schema';
import { AuditActionSchema, AuditTargetTypeSchema } from '../shared/contracts/enums.schema';
import { Badge } from '../shared/ui/Badge';
import { Button } from '../shared/ui/Button';
import { Feedback } from '../shared/ui/Feedback';
import { SelectFilter, TextFilter } from '../shared/ui/LiveFilters';
import { LoadingState } from '../shared/ui/LoadingState';
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from '../shared/ui/primitives/empty';
import { Field, FieldGroup, FieldLabel } from '../shared/ui/primitives/field';
import { RetryNotice } from '../shared/ui/RetryNotice';

interface AdminAuditItemProps {
    log: AuditLog;
    onViewDetails: (logId: number) => void;
}

function AdminAuditItem({ log, onViewDetails }: AdminAuditItemProps) {
    const actionTone = auditActionTone(log.action);

    return (
        <li className="grid gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-primary/40 sm:p-5">
            {/* Hàng 1: Icon + Tên hành động + Mã log + Nút Xem chi tiết */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                        <ScrollText className="size-5" aria-hidden="true" />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => onViewDetails(log.id)}
                                className="truncate text-left font-semibold text-base text-foreground transition-colors hover:text-primary focus-visible:underline focus-visible:outline-none"
                            >
                                {auditLabel[log.action]}
                            </button>
                            <Badge tone={actionTone} className="px-2 py-0.5 font-medium text-xs">
                                #{log.id}
                            </Badge>
                        </div>

                        <time
                            dateTime={log.createdAt}
                            className="block text-muted-foreground text-xs"
                        >
                            {adminDate(log.createdAt)}
                        </time>
                    </div>
                </div>

                {/* Nút Xem chi tiết mở modal */}
                <div className="ml-auto shrink-0">
                    <Button
                        variant="outline"
                        size="sm"
                        type="button"
                        onClick={() => onViewDetails(log.id)}
                    >
                        <Eye data-icon="inline-start" />
                        <span>Xem chi tiết</span>
                    </Button>
                </div>
            </div>

            {/* Hàng 2: Chi tiết người thực hiện & đối tượng */}
            <div className="grid gap-2 rounded-lg bg-muted/40 p-3 text-xs sm:grid-cols-2">
                <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                    <span className="shrink-0 text-muted-foreground">Người thực hiện:</span>
                    <span className="wrap-anywhere min-w-0 font-medium text-foreground">
                        <AdminActor actor={log.actor} />
                    </span>
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                    <span className="shrink-0 text-muted-foreground">
                        {targetLabel[log.target.type]}:
                    </span>
                    <code className="wrap-anywhere min-w-0 font-mono text-foreground">
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
    const isJobHistory = query?.targetType === 'JOB' && Boolean(query.targetId);

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
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
            {/* Header: Tiêu đề & Mô tả */}
            <div>
                <h1 className="font-semibold text-2xl text-foreground tracking-tight">
                    Nhật ký quản trị
                </h1>
                <p className="mt-1 text-muted-foreground text-sm">
                    Đối chiếu người thực hiện, đối tượng và nội dung từng thao tác quản trị.
                </p>
            </div>

            {/* Thanh Bộ lọc & Tìm kiếm đồng bộ */}
            <form
                className="rounded-[var(--radius-lg)] border border-border bg-surface p-4"
                onSubmit={(event) => event.preventDefault()}
            >
                <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {/* 1. Lọc theo Thao tác */}
                    <Field>
                        <FieldLabel htmlFor="audit-action" className="font-medium text-xs">
                            Thao tác
                        </FieldLabel>
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
                    </Field>

                    {/* 2. Lọc theo Loại đối tượng */}
                    <Field>
                        <FieldLabel htmlFor="audit-target-type" className="font-medium text-xs">
                            Loại đối tượng
                        </FieldLabel>
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
                    </Field>

                    {/* 3. Lọc theo Người thực hiện (Actor UUID) */}
                    <Field>
                        <FieldLabel htmlFor="audit-actor" className="font-medium text-xs">
                            Mã người thực hiện (UUID)
                        </FieldLabel>
                        <TextFilter
                            id="audit-actor"
                            name="actorId"
                            placeholder="Nhập UUID..."
                            pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
                            value={params.get('actorId') || ''}
                            spellCheck={false}
                            autoCapitalize="none"
                        />
                    </Field>

                    {/* 4. Lọc theo Đối tượng (Target UUID) */}
                    <Field>
                        <FieldLabel htmlFor="audit-target" className="font-medium text-xs">
                            Mã đối tượng (UUID)
                        </FieldLabel>
                        <TextFilter
                            id="audit-target"
                            name="targetId"
                            placeholder="Nhập UUID..."
                            pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
                            value={params.get('targetId') || ''}
                            spellCheck={false}
                            autoCapitalize="none"
                        />
                    </Field>
                </FieldGroup>

                {/* Footer bar của filter: thông tin & Đặt lại bộ lọc */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-border border-t pt-3 text-xs">
                    <span className="text-muted-foreground">
                        Dùng bộ lọc để tìm các thao tác quản trị đã ghi nhận.
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
                <Feedback
                    error="Bộ lọc không hợp lệ. Mã người thực hiện và mã đối tượng phải là định dạng UUID hợp lệ; hãy sửa hoặc xóa bộ lọc."
                    errorMode="toast"
                />
            )}

            {query && list.isPending && (
                <LoadingState layout="admin-rows">Đang tải nhật ký…</LoadingState>
            )}

            {query && list.isError && (
                <RetryNotice
                    message={errorMessage(list.error)}
                    busy={list.isFetching}
                    onRetry={() => void list.refetch()}
                />
            )}

            {query && list.isSuccess && (
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground text-xs">
                        <span>
                            Hiển thị{' '}
                            <strong className="text-foreground">{list.data.data.length}</strong>{' '}
                            trên <strong className="text-foreground">{list.data.meta.total}</strong>{' '}
                            bản ghi · mới nhất trước
                        </span>
                        <AdminReload retry={() => void list.refetch()} busy={list.isFetching} />
                    </div>

                    {list.data.data.length ? (
                        <ul className="m-0 list-none space-y-3 p-0">
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
                                    <h2>
                                        {isJobHistory
                                            ? 'Chưa có nhật ký quản trị cho tác vụ này'
                                            : 'Không có nhật ký phù hợp'}
                                    </h2>
                                </EmptyTitle>
                                <EmptyDescription>
                                    <p>
                                        {isJobHistory
                                            ? 'Mục này ghi các thao tác của quản trị viên như yêu cầu chạy lại. Trạng thái, tiến độ và kết quả xử lý nằm ở trang Tác vụ.'
                                            : 'Thử bộ lọc khác hoặc đợi thao tác quản trị mới được ghi nhận.'}
                                    </p>
                                </EmptyDescription>
                            </EmptyHeader>
                            {isJobHistory && (
                                <EmptyContent>
                                    <Button asChild variant="outline">
                                        <Link to="/admin/jobs">Về trang Tác vụ</Link>
                                    </Button>
                                </EmptyContent>
                            )}
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
