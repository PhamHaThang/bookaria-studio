import { z } from 'zod';
import { IdSchema } from '../../../shared/contracts/common.schema';
import { type Job, JobResultsSchema } from '../../../shared/contracts/dto.schema';
import { ApiErrorSchema } from '../../../shared/contracts/error.schema';

export const TaskSchema = z.object({
    type: z.enum(['PUBLISH_BOOK', 'EXPORT_PDF']),
    jobId: IdSchema.nullable(),
    versionNo: z.int().positive().nullable(),
});
export type Task = z.infer<typeof TaskSchema>;
export function existingJob(cause: unknown) {
    const response =
        typeof cause === 'object' && cause !== null && 'response' in cause
            ? (cause as { response?: { data?: unknown } }).response
            : undefined;
    const parsed = ApiErrorSchema.safeParse(response?.data);
    if (!parsed.success || parsed.data.error.code !== 'JOB_IN_PROGRESS') return null;
    const id = IdSchema.safeParse(
        (parsed.data.error.details as Record<string, unknown> | undefined)?.jobId,
    );
    return id.success ? id.data : null;
}
export function uncertainRequest(cause: unknown) {
    if (typeof cause !== 'object' || cause === null || !('response' in cause)) return true;
    const response = (cause as { response?: { status?: number } }).response;
    return !response || (response.status ?? 500) >= 500;
}
export function jobOutcome(task: Task, bookId: string, job: Job) {
    if (
        job.id !== task.jobId ||
        job.type !== task.type ||
        job.ref.type !== 'BOOK' ||
        job.ref.id !== bookId
    )
        throw new Error('Tác vụ không khớp loại công việc và sách này.');
    if (job.status !== 'SUCCEEDED') return null;
    return task.type === 'PUBLISH_BOOK'
        ? { type: 'PUBLISH_BOOK' as const, ...JobResultsSchema.PUBLISH_BOOK.parse(job.result) }
        : {
              type: 'EXPORT_PDF' as const,
              ...JobResultsSchema.EXPORT_PDF.parse(job.result),
              versionNo: task.versionNo,
          };
}
export type Outcome = NonNullable<ReturnType<typeof jobOutcome>>;
export function taskKey(userId: string, bookId: string) {
    return `bookaria:publication:${userId}:${bookId}`;
}
export function readTask(key: string): Task | null {
    try {
        return TaskSchema.parse(JSON.parse(sessionStorage.getItem(key) || 'null'));
    } catch {
        return null;
    }
}
export function storeTask(key: string, task: Task | null) {
    try {
        if (task) sessionStorage.setItem(key, JSON.stringify(task));
        else sessionStorage.removeItem(key);
    } catch {
        /* Polling still works when browser storage is unavailable. */
    }
}
