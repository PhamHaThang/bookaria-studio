import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    Clock,
    FileText,
    RefreshCw,
    RotateCcw,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { adminDate, adminOperationsApi } from '../features/admin';
import {
    auditTargetLink,
    canRetryJob,
    jobStatusLabel,
    jobTypeLabel,
    operationsKeys,
    readJobsSearch,
    targetLabel,
} from '../features/admin/operations-model';
import { AdminActor, AuditJson } from '../features/admin/operations-ui';
import { AdminPager, AdminReload, useAdminAction } from '../features/admin/ui';
import { useAuth } from '../features/auth';
import { errorMessage } from '../shared/api/errors';
import type { AdminJob } from '../shared/contracts/api/admin.schema';
import { JobStatusSchema, JobTypeSchema } from '../shared/contracts/enums.schema';
import { Badge } from '../shared/ui/Badge';
import { Button } from '../shared/ui/Button';
import { ConfirmationDialog } from '../shared/ui/ConfirmationDialog';
import { Disclosure } from '../shared/ui/Disclosure';
import { Feedback } from '../shared/ui/Feedback';
import { SelectFilter } from '../shared/ui/LiveFilters';
import { LoadingState } from '../shared/ui/LoadingState';
import { AlertDialogAction, AlertDialogCancel } from '../shared/ui/primitives/alert-dialog';
import { Checkbox } from '../shared/ui/primitives/checkbox';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../shared/ui/primitives/empty';
import { Field, FieldGroup, FieldLabel } from '../shared/ui/primitives/field';

function getJobStatusTone(status: string): 'success' | 'danger' | 'warning' | 'neutral' {
    switch (status) {
        case 'SUCCEEDED':
            return 'success';
        case 'FAILED':
            return 'danger';
        case 'RUNNING':
        case 'PENDING':
            return 'warning';
        case 'CANCELLED':
        default:
            return 'neutral';
    }
}

function JobStatusIcon({ status }: { status: string }) {
    switch (status) {
        case 'SUCCEEDED':
            return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
        case 'FAILED':
            return <AlertTriangle className="h-5 w-5 text-destructive" />;
        case 'RUNNING':
            return <RefreshCw className="h-5 w-5 text-amber-500 animate-spin" />;
        case 'PENDING':
            return <Clock className="h-5 w-5 text-amber-500" />;
        default:
            return <Activity className="h-5 w-5 text-muted-foreground" />;
    }
}

interface AdminJobItemProps {
    job: AdminJob;
    onRetry: (job: AdminJob) => void;
    retryDisabled: boolean;
}

function AdminJobItem({ job, onRetry, retryDisabled }: AdminJobItemProps) {
    const statusTone = getJobStatusTone(job.status);
    const canRetry = canRetryJob(job);

    return (
        <li className="group rounded-[var(--radius-lg)] border border-border bg-surface p-5 transition-all hover:border-primary/40 hover:shadow-xs space-y-4">
            {/* Hàng 1: Icon + Tên loại tác vụ + Trạng thái + Nút Thao tác */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-1 items-start gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border bg-muted/40 shadow-xs">
                        <JobStatusIcon status={job.status} />
                    </div>

                    <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="font-semibold text-base text-foreground leading-tight">
                                {jobTypeLabel[job.type] || job.type}
                            </h2>
                            <Badge tone={statusTone} className="px-2 py-0.5 font-medium text-xs">
                                {jobStatusLabel[job.status] || job.status}
                            </Badge>
                            {job.progress > 0 && (
                                <Badge tone="neutral" className="px-2 py-0.5 font-normal text-xs">
                                    Tiến độ {job.progress}%
                                </Badge>
                            )}
                        </div>

                        {/* ID tác vụ & lượt worker */}
                        <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
                            <span>
                                Mã tác vụ:{' '}
                                <code className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                                    {job.id}
                                </code>
                            </span>
                            <span>•</span>
                            <span>{job.attempts}/3 lượt worker</span>
                        </div>
                    </div>
                </div>

                {/* Các nút hành động bên phải */}
                <div className="flex shrink-0 items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="h-8 gap-1.5 px-3 text-xs"
                    >
                        <Link to={auditTargetLink('JOB', job.id)}>
                            <FileText className="h-3.5 w-3.5" />
                            <span>Nhật ký tác vụ</span>
                        </Link>
                    </Button>

                    {canRetry && (
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={retryDisabled}
                            onClick={() => onRetry(job)}
                            className="h-8 gap-1.5 px-3 text-xs"
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Thử lại</span>
                        </Button>
                    )}
                </div>
            </div>

            {/* Hàng 2: Chi tiết đối tượng, người tạo & thời gian */}
            <div className="grid grid-cols-1 gap-2.5 rounded-lg border border-border/50 bg-muted/20 p-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
                <div>
                    <span className="text-muted-foreground">Người khởi tạo:</span>{' '}
                    <span className="font-medium text-foreground">
                        <AdminActor actor={job.createdBy} />
                    </span>
                </div>
                <div>
                    <span className="text-muted-foreground">
                        {targetLabel[job.ref.type] || 'Đối tượng'}:
                    </span>{' '}
                    <code className="rounded bg-muted/60 px-1 py-0.5 font-mono text-[11px] text-foreground">
                        {job.ref.id}
                    </code>
                </div>
                <div>
                    <span className="text-muted-foreground">Khởi tạo:</span>{' '}
                    <span className="text-foreground">{adminDate(job.createdAt)}</span>
                    {job.finishedAt && (
                        <>
                            {' '}
                            • <span className="text-muted-foreground">Xong:</span>{' '}
                            <span className="text-foreground">{adminDate(job.finishedAt)}</span>
                        </>
                    )}
                </div>
            </div>

            {/* Hàng 3: Khối thông báo lỗi (nếu có) */}
            {job.error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                    <span className="font-semibold">Lỗi {job.error.code}:</span>{' '}
                    <span className="font-mono whitespace-pre-wrap">{job.error.message}</span>
                </div>
            )}

            {/* Hàng 4: Disclosure chi tiết payload JSON */}
            <Disclosure title="Xem kết quả và mã tham chiếu JSON">
                <AuditJson
                    value={{
                        id: job.id,
                        type: job.type,
                        status: job.status,
                        ref: job.ref,
                        result: job.result,
                        error: job.error,
                    }}
                />
            </Disclosure>
        </li>
    );
}

export function AdminJobsPage() {
    const { user } = useAuth();
    const [params] = useSearchParams();
    const cache = useQueryClient();

    const parsed = readJobsSearch(params);
    const query = parsed.success ? parsed.data : null;

    const [monitor, setMonitor] = useState(false);
    const [selected, setSelected] = useState<AdminJob | null>(null);
    const [accepted, setAccepted] = useState<{ previous: string; next: string } | null>(null);

    const action = useAdminAction();

    const list = useQuery({
        queryKey: operationsKeys.jobs(user?.id || '', query),
        queryFn: ({ signal }) => adminOperationsApi.jobs(query || {}, signal),
        enabled: query !== null,
        retry: false,
        refetchInterval: (current) => (monitor && !current.state.error ? 10_000 : false),
        refetchIntervalInBackground: false,
    });

    return (
        <div className="mx-auto max-w-6xl space-y-6 p-6">
            {/* Header: Tiêu đề & Mô tả */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="font-semibold text-2xl text-foreground tracking-tight">
                        Tác vụ hệ thống
                    </h1>
                    <p className="mt-1 text-muted-foreground text-sm">
                        Theo dõi tiến trình xử lý nền và kích hoạt thử lại các tác vụ thất bại.
                    </p>
                </div>
            </div>

            {/* Thanh Bộ lọc & Tìm kiếm đồng bộ với AdminUsersPage / AdminBooksPage */}
            <form
                className="rounded-[var(--radius-lg)] border border-border bg-surface p-4"
                onSubmit={(event) => event.preventDefault()}
            >
                <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {/* 1. Lọc theo Trạng thái */}
                    <Field orientation="contents">
                        <FieldLabel htmlFor="jobs-status" className="font-medium text-xs">
                            Trạng thái tác vụ
                            <SelectFilter
                                id="jobs-status"
                                name="status"
                                value={params.get('status') || ''}
                                options={[
                                    { value: '', label: 'Tất cả trạng thái' },
                                    ...(JobStatusSchema.options.map((value) => ({
                                        value,
                                        label: jobStatusLabel[value],
                                    })) ?? []),
                                ]}
                            />
                        </FieldLabel>
                    </Field>

                    {/* 2. Lọc theo Loại tác vụ */}
                    <Field orientation="contents">
                        <FieldLabel htmlFor="jobs-type" className="font-medium text-xs">
                            Loại tác vụ
                            <SelectFilter
                                id="jobs-type"
                                name="type"
                                value={params.get('type') || ''}
                                options={[
                                    { value: '', label: 'Tất cả loại tác vụ' },
                                    ...(JobTypeSchema.options.map((value) => ({
                                        value,
                                        label: jobTypeLabel[value],
                                    })) ?? []),
                                ]}
                            />
                        </FieldLabel>
                    </Field>
                </FieldGroup>

                {/* Footer bar của filter: thông tin & Đặt lại bộ lọc */}
                <div className="mt-3 flex items-center justify-between border-border border-t pt-3 text-xs">
                    <span className="text-muted-foreground">
                        Lọc tác vụ theo trạng thái hoàn thành và loại tác vụ xử lý nền.
                    </span>
                    {(params.get('status') || params.get('type')) && (
                        <Link
                            to="/admin/jobs"
                            state={{ resetFilters: true }}
                            className="font-medium text-primary hover:underline"
                        >
                            Đặt lại bộ lọc
                        </Link>
                    )}
                </div>
            </form>

            {/* Thanh công cụ Giám sát tự động (Auto-refresh) & Chú thích */}
            <div className="flex flex-col gap-2.5 rounded-[var(--radius-md)] border border-border/70 bg-surface/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between text-xs">
                <div className="m-0 mb-0 flex items-center gap-2.5 font-medium text-foreground select-none">
                    <Checkbox
                        id="auto-refresh-monitor"
                        checked={monitor}
                        onCheckedChange={(checked) => setMonitor(checked === true)}
                    />
                    <label htmlFor="auto-refresh-monitor" className="cursor-pointer">
                        Tự động làm mới mỗi 10 giây
                    </label>
                    {monitor && (
                        <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-normal text-emerald-600 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Đang tự động theo dõi
                        </span>
                    )}
                </div>
                <span className="m-0 text-muted-foreground text-[11px] leading-normal sm:text-right">
                    Tối đa 3 lượt worker xử lý cho mỗi tác vụ. Thử lại thủ công sẽ sinh mã tiến
                    trình mới.
                </span>
            </div>

            {/* Thông báo lỗi bộ lọc URL không hợp lệ */}
            {!parsed.success && (
                <Feedback error="Bộ lọc trong URL không hợp lệ. Chọn lại bộ lọc hoặc xóa bộ lọc để tiếp tục." />
            )}

            <Feedback error={action.error} />

            {action.uncertain && (
                <Button type="button" variant="secondary" onClick={() => window.location.reload()}>
                    Tải lại trang để đối chiếu
                </Button>
            )}

            {/* Banner hiển thị khi yêu cầu thử lại vừa được máy chủ tiếp nhận */}
            {accepted && (
                <div className="rounded-[var(--radius-lg)] border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                    <div className="flex items-center gap-2 font-semibold text-sm text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>Yêu cầu thử lại đã được máy chủ tiếp nhận</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Máy chủ đã khởi tạo tác vụ mới và đưa vào hàng chờ xử lý. Tiến trình mới
                        chưa được xác nhận hoàn tất.
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span>Mã tác vụ mới:</span>
                        <code className="rounded border border-border/60 bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                            {accepted.next}
                        </code>
                        <span className="text-muted-foreground">•</span>
                        <span>Tác vụ gốc:</span>
                        <code className="rounded border border-border/60 bg-muted/60 px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                            {accepted.previous}
                        </code>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 text-xs"
                            onClick={() => void list.refetch()}
                        >
                            Cập nhật danh sách
                        </Button>
                        <Button size="sm" variant="outline" asChild className="h-7 text-xs">
                            <Link to={auditTargetLink('JOB', accepted.previous)}>
                                Xem nhật ký thử lại
                            </Link>
                        </Button>
                    </div>
                </div>
            )}

            {/* Trạng thái đang tải */}
            {query && list.isPending && (
                <LoadingState layout="admin-rows">Đang tải tác vụ…</LoadingState>
            )}

            {/* Báo lỗi khi truy vấn */}
            {query && list.isError && (
                <Feedback
                    error={`${errorMessage(list.error)} Theo dõi tự động đã dừng; hãy tải lại dữ liệu.`}
                />
            )}

            {/* Danh sách tác vụ */}
            {query && list.isSuccess && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between text-muted-foreground text-xs">
                        <span>
                            Hiển thị{' '}
                            <strong className="text-foreground">{list.data.data.length}</strong>{' '}
                            trên <strong className="text-foreground">{list.data.meta.total}</strong>{' '}
                            tác vụ
                        </span>
                        <AdminReload retry={() => void list.refetch()} busy={list.isFetching} />
                    </div>

                    {list.data.data.length ? (
                        <ul className="list-none space-y-3.5 p-0">
                            {list.data.data.map((job) => (
                                <AdminJobItem
                                    key={job.id}
                                    job={job}
                                    onRetry={(j) => setSelected(j)}
                                    retryDisabled={action.busy || action.uncertain}
                                />
                            ))}
                        </ul>
                    ) : (
                        <Empty className="empty-state px-5 py-16">
                            <EmptyHeader>
                                <EmptyTitle>
                                    <h2>Không có tác vụ phù hợp</h2>
                                </EmptyTitle>
                                <EmptyDescription>
                                    <p>Thử thay đổi bộ lọc trạng thái hoặc loại tác vụ khác.</p>
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

            {/* Hộp thoại xác nhận thử lại tác vụ */}
            {selected && (
                <ConfirmationDialog
                    description={
                        <div className="space-y-1">
                            <p className="font-medium text-foreground text-sm">
                                {jobTypeLabel[selected.type]}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Mã tác vụ:{' '}
                                <code className="font-mono text-foreground">{selected.id}</code>
                            </p>
                        </div>
                    }
                    title="Thử lại tác vụ này?"
                    busy={action.busy}
                    onClose={() => setSelected(null)}
                    className="admin-confirm max-h-[calc(100dvh_-_32px)] max-w-[min(480px,_calc(100%_-_32px))] overflow-y-auto"
                >
                    <div className="space-y-2.5 text-xs text-muted-foreground">
                        <p>
                            <strong className="text-foreground">
                                {targetLabel[selected.ref.type]}:
                            </strong>{' '}
                            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                                {selected.ref.id}
                            </code>
                        </p>
                        <p>
                            Máy chủ sẽ tạo tác vụ mới. Bản ghi lỗi cũ được giữ lại để đối chiếu. Yêu
                            cầu có thể bị từ chối nếu đối tượng đã thay đổi hoặc đang có tác vụ khác
                            xử lý.
                        </p>
                    </div>

                    <Feedback error={action.error} />

                    <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5">
                        <AlertDialogCancel variant="plain" asChild>
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={action.busy}
                                onClick={() => setSelected(null)}
                            >
                                Hủy bỏ
                            </Button>
                        </AlertDialogCancel>
                        <AlertDialogAction
                            variant="plain"
                            asChild
                            onClick={(event) => event.preventDefault()}
                        >
                            <Button
                                type="button"
                                size="sm"
                                disabled={action.busy || action.uncertain}
                                onClick={() =>
                                    void action.run(
                                        () => adminOperationsApi.retry(selected.id),
                                        (result) => {
                                            setAccepted({
                                                previous: selected.id,
                                                next: result.jobId,
                                            });
                                            setSelected(null);
                                            void cache.invalidateQueries({ queryKey: ['assets'] });
                                            void cache.invalidateQueries({ queryKey: ['books'] });
                                            void cache.invalidateQueries({
                                                queryKey: ['notifications', user?.id || ''],
                                            });
                                        },
                                    )
                                }
                            >
                                {action.busy ? 'Đang gửi…' : 'Xác nhận thử lại'}
                            </Button>
                        </AlertDialogAction>
                    </div>
                </ConfirmationDialog>
            )}
        </div>
    );
}
