import { NewPasswordSchema } from '../../../shared/contracts/api/auth.schema';

export function validateNewPassword(password: string, confirmation: string): string | null {
    const parsed = NewPasswordSchema.safeParse(password);
    if (!parsed.success) return parsed.error.issues[0]?.message || 'Mật khẩu chưa hợp lệ.';
    return password === confirmation ? null : 'Mật khẩu nhập lại chưa khớp.';
}
export function safeReturnPath(value: unknown): string {
    return typeof value === 'string' &&
        /^\/(?:books|assets|profile)(?:[/?#]|$)/.test(value) &&
        !value.includes('\\')
        ? value
        : '/books';
}
