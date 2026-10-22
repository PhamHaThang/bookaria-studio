import type { AxiosInstance } from 'axios';
import { z } from 'zod';
import { ContractError, expectStatus, readData, readPage } from '../../shared/api/contract';
import {
    AdminBookDetailSchema,
    AdminBookItemSchema,
    AdminBooksQuerySchema,
    AdminCreateUserBodySchema,
    AdminDashboardSchema,
    AdminUpdateUserBodySchema,
    AdminUpdateUserResultSchema,
    AdminUserDetailsSchema,
    AdminUsersQuerySchema,
    DismissReportsResultSchema,
    ModerationNoteBodySchema,
    TakedownBodySchema,
    TakedownResultSchema,
} from '../../shared/contracts/api/admin.schema';
import { IdSchema, PaginationQuerySchema } from '../../shared/contracts/common.schema';
import {
    AdminUserSchema,
    BookSummarySchema,
    ModerationItemSchema,
} from '../../shared/contracts/dto.schema';

export function createAdminApi(http: AxiosInstance) {
    async function get<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal) {
        const res = await http.get(`/admin${path}`, { signal });
        expectStatus(res, 200);
        return readData(res, schema);
    }
    async function list<T>(
        path: string,
        schema: z.ZodType<T>,
        params: unknown,
        signal?: AbortSignal,
    ) {
        const res = await http.get(`/admin${path}`, { params, signal });
        expectStatus(res, 200);
        return readPage(res, schema);
    }
    async function bookAction<T>(id: string, action: string, body: unknown, schema: z.ZodType<T>) {
        const res = await http.post(`/admin/books/${IdSchema.parse(id)}/${action}`, body);
        expectStatus(res, 200);
        return readData(res, schema);
    }
    function matching<T extends { id: string }>(value: T, id: string): T {
        if (value.id.toLowerCase() !== id.toLowerCase()) throw new ContractError();
        return value;
    }
    return {
        dashboard: async (signal?: AbortSignal) => get('/dashboard', AdminDashboardSchema, signal),
        users: async (input: z.input<typeof AdminUsersQuerySchema>, signal?: AbortSignal) =>
            list('/users', AdminUserSchema, AdminUsersQuerySchema.parse(input), signal),
        user: async (id: string, signal?: AbortSignal) =>
            matching(await get(`/users/${IdSchema.parse(id)}`, AdminUserDetailsSchema, signal), id),
        async createUser(input: z.input<typeof AdminCreateUserBodySchema>) {
            const res = await http.post('/admin/users', AdminCreateUserBodySchema.parse(input));
            expectStatus(res, 201);
            return readData(res, AdminUserSchema);
        },
        async updateUser(id: string, input: z.input<typeof AdminUpdateUserBodySchema>) {
            const res = await http.patch(
                `/admin/users/${IdSchema.parse(id)}`,
                AdminUpdateUserBodySchema.parse(input),
            );
            expectStatus(res, 200);
            const result = readData(res, AdminUpdateUserResultSchema);
            matching(result.user, id);
            return result;
        },
        moderation: async (input: z.input<typeof PaginationQuerySchema>, signal?: AbortSignal) =>
            list('/moderation', ModerationItemSchema, PaginationQuerySchema.parse(input), signal),
        books: async (input: z.input<typeof AdminBooksQuerySchema>, signal?: AbortSignal) =>
            list('/books', AdminBookItemSchema, AdminBooksQuerySchema.parse(input), signal),
        book: async (id: string, signal?: AbortSignal) =>
            get(`/books/${IdSchema.parse(id)}`, AdminBookDetailSchema, signal),
        takedown: async (id: string, input: z.input<typeof TakedownBodySchema>) =>
            bookAction(id, 'takedown', TakedownBodySchema.parse(input), TakedownResultSchema),
        reinstate: async (id: string, input: z.input<typeof ModerationNoteBodySchema>) =>
            bookAction(
                id,
                'reinstate',
                ModerationNoteBodySchema.parse(input),
                z.object({ book: BookSummarySchema }),
            ),
        dismiss: async (id: string, input: z.input<typeof ModerationNoteBodySchema>) =>
            bookAction(
                id,
                'reports/dismiss',
                ModerationNoteBodySchema.parse(input),
                DismissReportsResultSchema,
            ),
    };
}
