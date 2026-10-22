import axios from 'axios';
import { ZodError } from 'zod';
import {
    ApiErrorSchema,
    RateLimitedDetailsSchema,
    ValidationIssueSchema,
} from '../contracts/error.schema';

export function errorMessage(error: unknown): string {
    if (error instanceof ZodError) return error.issues[0]?.message || 'Dữ liệu nhập chưa hợp lệ.';
    if (axios.isAxiosError(error)) {
        const parsed = ApiErrorSchema.safeParse(error.response?.data);
        if (parsed.success) {
            const body = parsed.data.error;
            if (body.code === 'VALIDATION_ERROR') {
                const details = ValidationIssueSchema.array().safeParse(body.details);
                if (details.success && details.data[0]) return details.data[0].message;
            }
            if (body.code === 'RATE_LIMITED') {
                const details = RateLimitedDetailsSchema.safeParse(body.details);
                return details.success
                    ? `Bạn thao tác quá nhanh. Hãy thử lại sau ${details.data.retryAfterSeconds} giây.`
                    : 'Bạn thao tác quá nhanh. Vui lòng chờ rồi thử lại.';
            }
            return body.message;
        }
        return !error.response
            ? 'Không kết nối được máy chủ. Kiểm tra mạng và thử lại.'
            : 'Máy chủ trả về lỗi không đúng định dạng. Vui lòng thử lại.';
    }
    return error instanceof Error ? error.message : 'Có lỗi xảy ra. Vui lòng thử lại.';
}
