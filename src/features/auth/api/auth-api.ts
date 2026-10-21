import type { AxiosInstance } from 'axios';
import { z } from 'zod';
import { expectStatus, readData } from '../../../shared/api/contract';
import {
    AuthResponseSchema,
    ForgotPasswordBodySchema,
    type LoginBody,
    LoginBodySchema,
    RefreshTokenResultSchema,
    type RegisterBody,
    RegisterBodySchema,
    ResetPasswordBodySchema,
    VerifyEmailBodySchema,
} from '../../../shared/contracts/api/auth.schema';
import { MeSchema } from '../../../shared/contracts/dto.schema';

const VerifyEmailResultSchema = z.object({ emailVerified: z.literal(true) });
const ForgotPasswordResultSchema = z.object({ sent: z.literal(true) });

export function createAuthApi(raw: AxiosInstance, api: AxiosInstance) {
    return {
        async login(body: LoginBody) {
            return readData(
                await raw.post('/auth/login', LoginBodySchema.parse(body)),
                AuthResponseSchema,
            );
        },
        async register(body: RegisterBody) {
            return readData(
                await raw.post('/auth/register', RegisterBodySchema.parse(body)),
                AuthResponseSchema,
            );
        },
        async refresh() {
            return readData(await raw.post('/auth/refresh'), RefreshTokenResultSchema);
        },
        async profile() {
            return readData(await api.get('/me'), MeSchema);
        },
        async logout() {
            expectStatus(await raw.post('/auth/logout'), 204);
        },
        async verifyEmail(token: string) {
            const response = await raw.post(
                '/auth/verify-email',
                VerifyEmailBodySchema.parse({ token }),
            );
            expectStatus(response, 200);
            readData(response, VerifyEmailResultSchema);
        },
        async forgotPassword(email: string) {
            const response = await raw.post(
                '/auth/forgot-password',
                ForgotPasswordBodySchema.parse({ email }),
            );
            expectStatus(response, 200);
            readData(response, ForgotPasswordResultSchema);
        },
        async resetPassword(token: string, newPassword: string) {
            expectStatus(
                await raw.post(
                    '/auth/reset-password',
                    ResetPasswordBodySchema.parse({ token, newPassword }),
                ),
                204,
            );
        },
        async resendVerification() {
            expectStatus(await api.post('/auth/resend-verification'), 204);
        },
    };
}
