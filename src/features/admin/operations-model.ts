import type { AdminJob } from '../../shared/contracts/api/admin.schema';
import {
    AdminJobsQuerySchema,
    AuditLogsQuerySchema,
} from '../../shared/contracts/api/admin.schema';
import type { AuditTargetType, JobStatus, JobType } from '../../shared/contracts/enums.schema';

function fields(params: URLSearchParams, names: string[]) {
    return Object.fromEntries(names.map((name) => [name, params.get(name) || undefined]));
}
export const readJobsSearch = (params: URLSearchParams) =>
    AdminJobsQuerySchema.safeParse({
        ...fields(params, ['status', 'type']),
        page: params.get('page') || 1,
        limit: 12,
    });
export const readAuditSearch = (params: URLSearchParams) =>
    AuditLogsQuerySchema.safeParse({
        ...fields(params, ['action', 'actorId', 'targetType', 'targetId']),
        page: params.get('page') || 1,
        limit: 12,
    });
export function formSearch(data: FormData, names: string[]) {
    const params = new URLSearchParams();
    for (const name of names) {
        const value = String(data.get(name) || '').trim();
        if (value) params.set(name, value);
    }
    return params;
}
export const operationsKeys = {
    jobs: (actor: string, query: unknown) => ['admin', actor, 'jobs', query] as const,
    audit: (actor: string, query: unknown) => ['admin', actor, 'audit', query] as const,
    auditLog: (actor: string, id: number | null) => ['admin', actor, 'audit-log', id] as const,
};
export const jobTypeLabel: Record<JobType, string> = {
    SCORE_MARKER: 'Chấm điểm marker',
    OPTIMIZE_ASSET: 'Tối ưu tài nguyên',
    BUILD_PREVIEW: 'Tạo bản xem thử',
    EXPORT_PDF: 'Xuất PDF',
    PUBLISH_BOOK: 'Xuất bản sách',
};
export const jobStatusLabel: Record<JobStatus, string> = {
    QUEUED: 'Đang chờ',
    RUNNING: 'Đang chạy',
    SUCCEEDED: 'Hoàn tất',
    FAILED: 'Thất bại',
};
export const targetLabel: Record<AuditTargetType | 'PAGE', string> = {
    USER: 'Người dùng',
    BOOK: 'Sách',
    ASSET: 'Tài nguyên',
    REPORT: 'Báo cáo',
    JOB: 'Tác vụ',
    CATEGORY: 'Danh mục',
    MARKER: 'Marker',
    PAGE: 'Trang sách',
};
export function auditTargetLink(type: AuditTargetType, id: string) {
    return `/admin/audit-logs?${new URLSearchParams({ targetType: type, targetId: id })}`;
}
// Eligibility also depends on target ownership/state and concurrent jobs, checked by the server.
export const canRetryJob = (job: AdminJob) => job.status === 'FAILED' && job.createdBy !== null;
