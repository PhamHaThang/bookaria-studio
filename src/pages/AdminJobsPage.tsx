import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
import { ConfirmDialog } from '../shared/ui/ConfirmDialog';
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
            <div className="page-heading insights-heading">
                <div>
                    <h1>Tác vụ hệ thống</h1>
                    <p>Theo dõi xử lý nền và thử lại tác vụ đã thất bại.</p>
                </div>
                {query && <AdminReload retry={() => void list.refetch()} busy={list.isFetching} />}
            </div>
            <form
                className="admin-filters"
                key={params.toString()}
                onSubmit={(event) => {
                    event.preventDefault();
                    setParams(formSearch(new FormData(event.currentTarget), ['status', 'type']));
                }}
            >
                <label htmlFor="jobs-status">
                    Trạng thái
                    <select
                        id="jobs-status"
                        name="status"
                        defaultValue={params.get('status') || ''}
                    >
                        <option value="">Tất cả trạng thái</option>
                        {JobStatusSchema.options.map((value) => (
                            <option key={value} value={value}>
                                {jobStatusLabel[value]}
                            </option>
                        ))}
                    </select>
                </label>
                <label htmlFor="jobs-type">
                    Loại tác vụ
                    <select id="jobs-type" name="type" defaultValue={params.get('type') || ''}>
                        <option value="">Tất cả loại</option>
                        {JobTypeSchema.options.map((value) => (
                            <option key={value} value={value}>
                                {jobTypeLabel[value]}
                            </option>
                        ))}
                    </select>
                </label>
                <button type="submit" className="button compact">
                    Lọc tác vụ
                </button>
                <Link to="/admin/jobs">Xóa bộ lọc</Link>
            </form>
            <label className="admin-monitor">
                <input
                    type="checkbox"
                    checked={monitor}
                    onChange={(event) => setMonitor(event.target.checked)}
                />{' '}
                Tự cập nhật mỗi 10 giây khi đang mở trang
            </label>
            <p className="stats-note">
                Số lần chạy là số lượt worker xử lý một tác vụ (tối đa 3). Thử lại thủ công tạo mã
                mới; máy chủ kiểm tra điều kiện trước khi nhận.
            </p>
            {!parsed.success && (
                <Feedback error="Bộ lọc trong URL không hợp lệ. Chọn lại bộ lọc hoặc xóa bộ lọc để tiếp tục." />
            )}
            <Feedback error={action.error} />
            {action.uncertain && (
                <button
                    type="button"
                    className="button secondary compact"
                    onClick={() => window.location.reload()}
                >
                    Tải lại trang để đối chiếu
                </button>
            )}
            {accepted && (
                <section className="admin-section" aria-label="Tác vụ vừa được nhận">
                    <Feedback success="Máy chủ đã nhận yêu cầu thử lại. Tác vụ mới chưa được xác nhận hoàn tất." />
                    <p>
                        Mã mới: <code className="admin-id">{accepted.next}</code>
                    </p>
                    <p>
                        Tác vụ cũ: <code className="admin-id">{accepted.previous}</code>
                    </p>
                    <div className="admin-actions">
                        <Link to="/admin/jobs">Xem danh sách mới nhất</Link>
                        <Link to={auditTargetLink('JOB', accepted.previous)}>
                            Xem nhật ký thử lại
                        </Link>
                    </div>
                </section>
            )}
            {query && list.isPending && <p role="status">Đang tải tác vụ…</p>}
            {query && list.isError && (
                <Feedback
                    error={`${errorMessage(list.error)} Theo dõi tự động đã dừng; hãy tải lại dữ liệu.`}
                />
            )}
            {query && list.isSuccess && (
                <>
                    <p role="status">{list.data.meta.total} tác vụ phù hợp</p>
                    {list.data.data.length ? (
                        <ul className="admin-rows admin-job-rows">
                            {list.data.data.map((job) => (
                                <li key={job.id}>
                                    <div className="admin-job-main">
                                        <h2>{jobTypeLabel[job.type]}</h2>
                                        <p>
                                            <code className="admin-id">{job.id}</code>
                                        </p>
                                        <div className="admin-metadata">
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
                                            <code className="admin-id">{job.ref.id}</code>
                                        </p>
                                        <p className="admin-metadata">
                                            Tạo: {adminDate(job.createdAt)} · Kết thúc:{' '}
                                            {adminDate(job.finishedAt)}
                                        </p>
                                        {job.error && (
                                            <p className="admin-prose">
                                                Lỗi {job.error.code}: {job.error.message}
                                            </p>
                                        )}
                                        <details>
                                            <summary>Kết quả và mã tham chiếu</summary>
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
                                        </details>
                                    </div>
                                    <div className="admin-row-detail">
                                        <Link to={auditTargetLink('JOB', job.id)}>
                                            Nhật ký tác vụ<span className="sr-only"> {job.id}</span>
                                        </Link>
                                        {canRetryJob(job) && (
                                            <button
                                                type="button"
                                                className="button secondary compact"
                                                disabled={action.busy || action.uncertain}
                                                onClick={() => setSelected(job)}
                                            >
                                                Thử lại<span className="sr-only"> {job.id}</span>
                                            </button>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <section className="empty-state">
                            <h2>Không có tác vụ phù hợp</h2>
                            <p>Thử trạng thái hoặc loại tác vụ khác.</p>
                        </section>
                    )}
                    <AdminPager page={query.page} meta={list.data.meta} />
                </>
            )}
            {selected && (
                <ConfirmDialog
                    title="Thử lại tác vụ này?"
                    busy={action.busy}
                    onClose={() => setSelected(null)}
                    className="admin-confirm"
                >
                    <p>
                        {jobTypeLabel[selected.type]} —{' '}
                        <code className="admin-id">{selected.id}</code>
                    </p>
                    <p>
                        {targetLabel[selected.ref.type]}:{' '}
                        <code className="admin-id">{selected.ref.id}</code>
                    </p>
                    <p>
                        Máy chủ sẽ tạo tác vụ mới. Bản ghi lỗi cũ được giữ lại. Yêu cầu có thể bị từ
                        chối nếu đối tượng đã thay đổi hoặc đang có tác vụ khác xử lý.
                    </p>
                    <Feedback error={action.error} />
                    <div className="admin-actions">
                        <button
                            type="button"
                            className="button secondary"
                            disabled={action.busy}
                            onClick={() => setSelected(null)}
                        >
                            Hủy
                        </button>
                        <button
                            type="button"
                            className="button"
                            disabled={action.busy || action.uncertain}
                            onClick={() =>
                                void action.run(
                                    () => adminOperationsApi.retry(selected.id),
                                    (result) => {
                                        setAccepted({ previous: selected.id, next: result.jobId });
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
                        </button>
                    </div>
                </ConfirmDialog>
            )}
        </>
    );
}
