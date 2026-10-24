import { NewPasswordSchema } from '../../../shared/contracts/api/auth.schema';
import { LIMITS } from '../../../shared/contracts/common.schema';

const utf8 = new TextEncoder();

export function validateNewPassword(password: string, confirmation: string): string | null {
    const parsed = NewPasswordSchema.safeParse(password);
    if (!parsed.success) {
        if (utf8.encode(password).length > LIMITS.passwordMaxLength)
            return 'Mật khẩu quá dài, vui lòng rút ngắn lại.';
        return parsed.error.issues[0]?.message || 'Mật khẩu chưa hợp lệ.';
    }
    return password === confirmation ? null : 'Mật khẩu nhập lại chưa khớp.';
}
export function safeReturnPath(value: unknown): string {
    return typeof value === 'string' &&
        /^\/(?:books|assets|profile|change-password|admin|stats|notifications|check-email)(?:[/?#]|$)/.test(
            value,
        ) &&
        !value.includes('\\')
        ? value
        : '/books';
}
