import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { ConfirmationDialog } from '@/shared/ui/ConfirmationDialog';
import { Disclosure } from '@/shared/ui/Disclosure';
import { FormSelect } from '@/shared/ui/FormSelect';
import { LoadingState } from '@/shared/ui/LoadingState';
import { AlertDialogAction, AlertDialogCancel } from '@/shared/ui/primitives/alert-dialog';
import { Checkbox } from '@/shared/ui/primitives/checkbox';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/shared/ui/primitives/empty';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { adminDate, adminOperationsApi } from '../features/admin';
import {
    auditTargetLink,
    canRetryJob,
    formSearch,
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
import { Feedback } from '../shared/ui/Feedback';

export function AdminJobsPage() {
    const { user } = useAuth(),
        [params, setParams] = useSearchParams(),
        cache = useQueryClient();
    const parsed = readJobsSearch(params),
        query = parsed.success ? parsed.data : null;
    const [monitor, setMonitor] = useState(false),
        [selected, setSelected] = useState<AdminJob | null>(null),
        [accepted, setAccepted] = useState<{ previous: string; next: string } | null>(null);
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
        <>
            <div className="page-heading insights-heading [&_h1]:wrap-anywhere mx-0 mt-0 mb-7 flex items-center justify-between gap-6 max-[760px]:mb-6 max-[640px]:flex-col max-[700px]:flex-wrap max-[640px]:items-start max-[700px]:items-start max-[760px]:items-start max-[700px]:gap-3 max-[760px]:gap-4 max-[700px]:[&_>_.button]:max-w-full max-[700px]:[&_>_.button]:flex-[0_0_auto] [&_>_div]:min-w-0 max-[640px]:[&_>_div]:w-full max-[700px]:[&_>_div]:flex-[1_1_180px] [&_h1]:font-semibold [&_h1]:text-[length:28px] [&_h1]:tracking-[-0.025em] max-[700px]:[&_h1]:text-[length:25px] max-[760px]:[&_h1]:text-[length:var(--text-2xl)] [&_p]:mx-0 [&_p]:mt-2 [&_p]:mb-0 [&_p]:max-w-[64ch] [&_p]:text-[length:13px] [&_p]:text-muted-foreground max-[760px]:[&_p]:text-[length:var(--text-sm)] [.page-editor-screen[data-mode=content]_>_&]:hidden [.studio-editing_&]:mb-2 [.studio-editing_&_h1]:ml-4 [.studio-editing_&_h1]:inline [.studio-editing_&_h1]:text-[length:21px] max-[700px]:[.studio-editing_&_h1]:mx-0 max-[700px]:[.studio-editing_&_h1]:mt-[6px] max-[700px]:[.studio-editing_&_h1]:mb-0 max-[700px]:[.studio-editing_&_h1]:block [.studio-editing_&_p]:ml-[14px] [.studio-editing_&_p]:inline [.studio-editing_&_p]:text-[length:11px] max-[700px]:[.studio-editing_&_p]:mx-0 max-[700px]:[.studio-editing_&_p]:my-1 max-[700px]:[.studio-editing_&_p]:block [:where(.studio-main_>_&)]:mx-auto [:where(.studio-main_>_&)]:max-w-375">
                <div>
                    <h1>Tác vụ hệ thống</h1>
                    <p>Theo dõi xử lý nền và thử lại tác vụ đã thất bại.</p>
                </div>
                {query && <AdminReload retry={() => void list.refetch()} busy={list.isFetching} />}
            </div>
            <form
                className="admin-filters mb-5 flex flex-wrap items-end gap-4 max-[640px]:flex-col max-[640px]:items-stretch [&_[data-slot=select-trigger]]:w-full [&_input]:w-full [&_label]:m-0 [&_label]:flex-[1_1_150px] max-[640px]:[&_label]:w-full max-[640px]:[&_label]:flex-[auto]"
                key={params.toString()}
                onSubmit={(event) => {
                    event.preventDefault();
                    setParams(formSearch(new FormData(event.currentTarget), ['status', 'type']));
                }}
            >
                <FieldGroup className="contents">
                    <Field orientation="contents">
                        <FieldLabel htmlFor="jobs-status">
                            Trạng thái
                            <FormSelect
                                id="jobs-status"
                                name="status"
                                defaultValue={params.get('status') || ''}
                                options={[
                                    { value: '', label: 'Tất cả trạng thái' },
                                    ...(JobStatusSchema.options.map((value) => ({
                                        value: value,
                                        label: jobStatusLabel[value],
                                    })) ?? []),
                                ]}
                            />
                        </FieldLabel>
                    </Field>
                    <Field orientation="contents">
                        <FieldLabel htmlFor="jobs-type">
                            Loại tác vụ
                            <FormSelect
                                id="jobs-type"
                                name="type"
                                defaultValue={params.get('type') || ''}
                                options={[
                                    { value: '', label: 'Tất cả loại' },
                                    ...(JobTypeSchema.options.map((value) => ({
                                        value: value,
                                        label: jobTypeLabel[value],
                                    })) ?? []),
                                ]}
                            />
                        </FieldLabel>
                    </Field>
                    <Button type="submit">Lọc tác vụ</Button>
                    <Link to="/admin/jobs">Xóa bộ lọc</Link>
                </FieldGroup>
            </form>
            <Field orientation="contents">
                <FieldLabel className="admin-monitor my-4 flex items-start gap-3 [&_>_input]:mt-1 [&_>_input]:shrink-0">
                    <Checkbox
                        checked={monitor}
                        onCheckedChange={(checked) => setMonitor(checked === true)}
                    />{' '}
                    Tự cập nhật mỗi 10 giây khi đang mở trang
                </FieldLabel>
            </Field>
            <p className="stats-note max-w-[75ch] text-[length:var(--text-sm)] text-muted-foreground [.admin-form_&]:mb-4">
                Số lần chạy là số lượt worker xử lý một tác vụ (tối đa 3). Thử lại thủ công tạo mã
                mới; máy chủ kiểm tra điều kiện trước khi nhận.
            </p>
            {!parsed.success && (
                <Feedback error="Bộ lọc trong URL không hợp lệ. Chọn lại bộ lọc hoặc xóa bộ lọc để tiếp tục." />
            )}
            <Feedback error={action.error} />
            {action.uncertain && (
                <Button type="button" variant="secondary" onClick={() => window.location.reload()}>
                    Tải lại trang để đối chiếu
                </Button>
            )}
            {accepted && (
                <section className="admin-section mt-8" aria-label="Tác vụ vừa được nhận">
                    <Feedback success="Máy chủ đã nhận yêu cầu thử lại. Tác vụ mới chưa được xác nhận hoàn tất." />
                    <p>
                        Mã mới: <code className="admin-id wrap-anywhere">{accepted.next}</code>
                    </p>
                    <p>
                        Tác vụ cũ:{' '}
                        <code className="admin-id wrap-anywhere">{accepted.previous}</code>
                    </p>
                    <div className="admin-actions flex flex-wrap items-center gap-3 max-[640px]:flex-col max-[640px]:items-stretch [.admin-confirm_&]:mt-5">
                        <Link to="/admin/jobs">Xem danh sách mới nhất</Link>
                        <Link to={auditTargetLink('JOB', accepted.previous)}>
                            Xem nhật ký thử lại
                        </Link>
                    </div>
                </section>
            )}
            {query && list.isPending && <LoadingState>Đang tải tác vụ…</LoadingState>}
            {query && list.isError && (
                <Feedback
                    error={`${errorMessage(list.error)} Theo dõi tự động đã dừng; hãy tải lại dữ liệu.`}
                />
            )}
            {query && list.isSuccess && (
                <>
                    <p role="status">{list.data.meta.total} tác vụ phù hợp</p>
                    {list.data.data.length ? (
                        <ul className="admin-rows admin-job-rows [&_>_li]:wrap-anywhere mx-0 my-4 list-none p-0 [&_>_li]:flex [&_>_li]:items-start [&_>_li]:justify-between [&_>_li]:gap-5 [&_>_li]:border-b-[1px] [&_>_li]:border-b-border [&_>_li]:py-5 [&_>_li]:[border-bottom-style:solid] max-[640px]:[&_>_li]:flex-col max-[640px]:[&_>_li]:gap-3 [&_h2]:mx-0 [&_h2]:mt-0 [&_h2]:mb-2 [&_h2]:text-[length:var(--text-md)] [&_h3]:mx-0 [&_h3]:mt-0 [&_h3]:mb-2 [&_h3]:text-[length:var(--text-md)] [&_p]:mx-0 [&_p]:my-2">
                            {list.data.data.map((job) => (
                                <li key={job.id}>
                                    <div className="admin-job-main min-w-0 flex-[1] [&_[data-slot=accordion-trigger]]:cursor-pointer [&_[data-slot=accordion-trigger]]:underline [&_[data-slot=accordion-trigger]]:underline-offset-[0.2em] [&_details]:mt-4">
                                        <h2>{jobTypeLabel[job.type]}</h2>
                                        <p>
                                            <code className="admin-id wrap-anywhere">{job.id}</code>
                                        </p>
                                        <div className="admin-metadata flex flex-wrap items-center gap-3 text-[length:var(--text-sm)] text-muted-foreground">
                                            <Badge
                                                tone={
                                                    job.status === 'FAILED'
                                                        ? 'danger'
                                                        : job.status === 'SUCCEEDED'
                                                          ? 'success'
                                                          : 'warning'
                                                }
                                            >
                                                {jobStatusLabel[job.status]}
                                            </Badge>
                                            <span>Tiến độ {job.progress}%</span>
                                            <span>{job.attempts}/3 lượt worker</span>
                                        </div>
                                        <p>
                                            Người tạo: <AdminActor actor={job.createdBy} />
                                        </p>
                                        <p>
                                            {targetLabel[job.ref.type]}:{' '}
                                            <code className="admin-id wrap-anywhere">
                                                {job.ref.id}
                                            </code>
                                        </p>
                                        <p className="admin-metadata flex flex-wrap items-center gap-3 text-[length:var(--text-sm)] text-muted-foreground">
                                            Tạo: {adminDate(job.createdAt)} · Kết thúc:{' '}
                                            {adminDate(job.finishedAt)}
                                        </p>
                                        {job.error && (
                                            <p className="admin-prose wrap-anywhere [white-space:pre-wrap]">
                                                Lỗi {job.error.code}: {job.error.message}
                                            </p>
                                        )}
                                        <Disclosure title={<> Kết quả và mã tham chiếu </>}>
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
                                    </div>
                                    <div className="admin-row-detail flex flex-col gap-2 text-[length:var(--text-sm)]">
                                        <Link to={auditTargetLink('JOB', job.id)}>
                                            Nhật ký tác vụ
                                            <span className="sr-only [.editor-page-strip_a.strip-add-page_>_span:not(&)]:[position:static] [.editor-page-strip_a_>_span:not(&)]:absolute [.editor-page-strip_a_>_span:not(&)]:right-[-1px] [.editor-page-strip_a_>_span:not(&)]:bottom-[-1px] [.editor-page-strip_a_>_span:not(&)]:rounded-[3px] [.editor-page-strip_a_>_span:not(&)]:bg-surface [.editor-page-strip_a_>_span:not(&)]:px-[5px] [.editor-page-strip_a_>_span:not(&)]:py-0 [.editor-page-strip_a_>_span:not(&)]:text-[length:10px] [.editor-page-strip_a_>_span:not(&)]:text-foreground">
                                                {' '}
                                                {job.id}
                                            </span>
                                        </Link>
                                        {canRetryJob(job) && (
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                disabled={action.busy || action.uncertain}
                                                onClick={() => setSelected(job)}
                                            >
                                                Thử lại
                                                <span className="sr-only [.editor-page-strip_a.strip-add-page_>_span:not(&)]:[position:static] [.editor-page-strip_a_>_span:not(&)]:absolute [.editor-page-strip_a_>_span:not(&)]:right-[-1px] [.editor-page-strip_a_>_span:not(&)]:bottom-[-1px] [.editor-page-strip_a_>_span:not(&)]:rounded-[3px] [.editor-page-strip_a_>_span:not(&)]:bg-surface [.editor-page-strip_a_>_span:not(&)]:px-[5px] [.editor-page-strip_a_>_span:not(&)]:py-0 [.editor-page-strip_a_>_span:not(&)]:text-[length:10px] [.editor-page-strip_a_>_span:not(&)]:text-foreground">
                                                    {' '}
                                                    {job.id}
                                                </span>
                                            </Button>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <Empty className="empty-state border-border border-t px-5 py-16 max-[760px]:px-3 max-[760px]:py-12">
                            <EmptyHeader>
                                <EmptyTitle>
                                    <h2>Không có tác vụ phù hợp</h2>
                                </EmptyTitle>
                                <EmptyDescription>
                                    <p>Thử trạng thái hoặc loại tác vụ khác.</p>
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    )}
                    <AdminPager page={query.page} meta={list.data.meta} />
                </>
            )}
            {selected && (
                <ConfirmationDialog
                    description={
                        <>
                            {jobTypeLabel[selected.type]} —{' '}
                            <code className="admin-id wrap-anywhere">{selected.id}</code>
                        </>
                    }
                    title="Thử lại tác vụ này?"
                    busy={action.busy}
                    onClose={() => setSelected(null)}
                    className="admin-confirm [&_p]:wrap-anywhere max-h-[calc(100dvh_-_32px)] max-w-[min(480px,_calc(100%_-_32px))] overflow-y-auto [&_p]:[white-space:pre-wrap]"
                >
                    <p>
                        {targetLabel[selected.ref.type]}:{' '}
                        <code className="admin-id wrap-anywhere">{selected.ref.id}</code>
                    </p>
                    <p>
                        Máy chủ sẽ tạo tác vụ mới. Bản ghi lỗi cũ được giữ lại. Yêu cầu có thể bị từ
                        chối nếu đối tượng đã thay đổi hoặc đang có tác vụ khác xử lý.
                    </p>
                    <Feedback error={action.error} />
                    <div className="admin-actions flex flex-wrap items-center gap-3 max-[640px]:flex-col max-[640px]:items-stretch [.admin-confirm_&]:mt-5">
                        <AlertDialogCancel variant="plain" asChild>
                            <Button
                                type="button"
                                variant="secondary"
                                fullWidth
                                disabled={action.busy}
                                onClick={() => setSelected(null)}
                            >
                                Hủy
                            </Button>
                        </AlertDialogCancel>
                        <AlertDialogAction
                            variant="plain"
                            asChild
                            onClick={(event) => event.preventDefault()}
                        >
                            <Button
                                type="button"
                                fullWidth
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
        </>
    );
}
