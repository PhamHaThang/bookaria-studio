import type { AxiosInstance } from 'axios';
import { z } from 'zod';
import { ContractError, expectStatus, readData, readPage } from '../../shared/api/contract';
import {
    AdminJobSchema,
    AdminJobsQuerySchema,
    AuditLogsQuerySchema,
} from '../../shared/contracts/api/admin.schema';
import { IdSchema } from '../../shared/contracts/common.schema';
import { AuditLogSchema } from '../../shared/contracts/dto.schema';

export const AuditIdSchema = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export function createAdminOperationsApi(http: AxiosInstance) {
    return {
        async jobs(input: z.input<typeof AdminJobsQuerySchema>, signal?: AbortSignal) {
            const res = await http.get('/admin/jobs', {
                params: AdminJobsQuerySchema.parse(input),
                signal,
            });
            expectStatus(res, 200);
            return readPage(res, AdminJobSchema);
        },
        async retry(id: string) {
            const res = await http.post(`/admin/jobs/${IdSchema.parse(id)}/retry`);
            expectStatus(res, 202);
            const result = readData(res, z.object({ jobId: IdSchema }));
            if (result.jobId.toLowerCase() === id.toLowerCase()) throw new ContractError();
            return result;
        },
        async audit(input: z.input<typeof AuditLogsQuerySchema>, signal?: AbortSignal) {
            const res = await http.get('/admin/audit-logs', {
                params: AuditLogsQuerySchema.parse(input),
                signal,
            });
            expectStatus(res, 200);
            return readPage(res, AuditLogSchema);
        },
        async auditLog(id: number, signal?: AbortSignal) {
            const parsed = AuditIdSchema.parse(id);
            const res = await http.get(`/admin/audit-logs/${parsed}`, { signal });
            expectStatus(res, 200);
            const log = readData(res, AuditLogSchema);
            if (log.id !== parsed) throw new ContractError();
            return log;
        },
    };
}
