import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { authLocation } from '@/features/auth/model/dialog';
import { validateNewPassword } from '@/features/auth/model/form';
import { auth, useAuth } from '@/features/auth/model/session';
import { Feedback } from '@/shared/ui/Feedback';
import { PasswordInput } from '@/shared/ui/PasswordInput';
import { Button } from '@/shared/ui/primitives/button';
import { Checkbox } from '@/shared/ui/primitives/checkbox';
import { DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/primitives/dialog';
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { AuthDialogLink } from './AuthDialogLink';
import { type AuthRequestProps, useAuthRequest } from './useAuthRequest';

type Mode = 'login' | 'register' | 'forgot' | 'reset';
type FieldIssue = { field: 'displayName' | 'password' | 'confirmation'; message: string };
const copy = {
    login: ['Chào mừng trở lại', 'Đăng nhập để tiếp tục với Bookaria.', 'Đăng nhập'],
    register: ['Tạo tài khoản', 'Bắt đầu không gian sáng tạo của riêng bạn.', 'Tạo tài khoản'],
    forgot: [
        'Quên mật khẩu?',
        'Nhập email đã dùng để đăng ký tài khoản Bookaria.',
        'Gửi liên kết đặt lại',
    ],
    reset: ['Đặt mật khẩu mới', 'Chọn mật khẩu mới cho tài khoản của bạn.', 'Lưu mật khẩu mới'],
};

export function AuthForm({
    mode,
    onComplete,
    ...requestProps
}: AuthRequestProps & { mode: Mode; onComplete: () => void }) {
    const [params] = useSearchParams();
    const token = params.get('token') || '';
    const [success, setSuccess] = useState<string | null>(null);
    const [fieldIssue, setFieldIssue] = useState<FieldIssue | null>(null);
    const navigate = useNavigate();
    const location = useLocation();
    const session = useAuth();
    const request = useAuthRequest(requestProps);
    const firstInput = useRef<HTMLInputElement>(null);
    useEffect(() => {
        firstInput.current?.focus();
    }, []);
    const [title, description, action] = copy[mode];
    const newPassword = mode === 'register' || mode === 'reset';
    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (request.disabled) return;
        const form = new FormData(event.currentTarget);
        const email = String(form.get('email') || '')
            .trim()
            .toLowerCase();
        const password = String(form.get('password') || '');
        const displayName = String(form.get('displayName') || '').trim();
        setSuccess(null);
        request.setError(null);
        setFieldIssue(null);
        if (newPassword) {
            const invalid = validateNewPassword(password, String(form.get('confirmation') || ''));
            if (invalid) {
                setFieldIssue({
                    field: validateNewPassword(password, password) ? 'password' : 'confirmation',
                    message: invalid,
                });
                return;
            }
        }
        if (mode === 'register' && !displayName) {
            setFieldIssue({ field: 'displayName', message: 'Vui lòng nhập họ tên.' });
            return;
        }
        await request.run(
            async () => {
                if (mode === 'login')
                    await auth.login({ email, password, remember: form.get('remember') === 'on' });
                else if (mode === 'register') await auth.register({ email, password, displayName });
                else if (mode === 'forgot') await auth.forgotPassword(email);
                else await auth.resetPassword(token, password);
            },
            () => {
                if (mode === 'login') onComplete();
                else if (mode === 'register')
                    navigate(authLocation(location, 'check-email'), {
                        replace: true,
                        state: location.state,
                    });
                else if (mode === 'forgot')
                    setSuccess(
                        'Nếu email có trong hệ thống, bạn sẽ nhận được liên kết đặt lại mật khẩu. Hãy kiểm tra cả thư rác.',
                    );
                else setSuccess('Đã đổi mật khẩu. Hãy đăng nhập lại bằng mật khẩu mới.');
            },
        );
    }
    if (mode === 'reset' && !token)
        return (
            <>
                <DialogHeader>
                    <DialogTitle size="lg" className="m-0">
                        Thiếu liên kết đặt lại
                    </DialogTitle>
                    <DialogDescription className="m-0">
                        Mở lại liên kết trong email hoặc yêu cầu một liên kết mới.
                    </DialogDescription>
                </DialogHeader>
                <Button asChild>
                    <AuthDialogLink mode="forgot">Yêu cầu liên kết mới</AuthDialogLink>
                </Button>
            </>
        );
    return (
        <>
            <DialogHeader>
                <DialogTitle size="lg" className="m-0">
                    {title}
                </DialogTitle>
                <DialogDescription className="m-0">{description}</DialogDescription>
            </DialogHeader>
            <Feedback
                error={request.error || (mode === 'login' ? session.message : null)}
                errorMode="toast"
                success={success}
            />
            {!(mode === 'reset' && success) && (
                <form
                    onSubmit={submit}
                    aria-busy={request.busy}
                    onChange={(event) => {
                        if (!fieldIssue || !(event.target instanceof HTMLInputElement)) return;
                        const { name } = event.target;
                        if (
                            name === fieldIssue.field ||
                            (name === 'password' && fieldIssue.field === 'confirmation')
                        )
                            setFieldIssue(null);
                    }}
                >
                    <fieldset disabled={request.disabled} className="m-0 min-w-0 border-0 p-0">
                        <FieldGroup className="gap-3 [&>[data-slot=field]]:gap-1.5">
                            {mode === 'register' && (
                                <Field>
                                    <FieldLabel className="mb-0" htmlFor="auth-name">
                                        Họ tên
                                    </FieldLabel>
                                    <Input
                                        className="mt-0"
                                        ref={firstInput}
                                        id="auth-name"
                                        name="displayName"
                                        autoComplete="name"
                                        maxLength={100}
                                        required
                                        aria-invalid={
                                            fieldIssue?.field === 'displayName' || undefined
                                        }
                                        aria-describedby={
                                            fieldIssue?.field === 'displayName'
                                                ? 'auth-name-error'
                                                : undefined
                                        }
                                    />
                                    {fieldIssue?.field === 'displayName' && (
                                        <FieldError id="auth-name-error">
                                            {fieldIssue.message}
                                        </FieldError>
                                    )}
                                </Field>
                            )}
                            {mode !== 'reset' && (
                                <Field>
                                    <FieldLabel className="mb-0" htmlFor="auth-email">
                                        Email
                                    </FieldLabel>
                                    <Input
                                        className="mt-0"
                                        ref={mode === 'register' ? undefined : firstInput}
                                        id="auth-email"
                                        name="email"
                                        type="email"
                                        autoComplete="email"
                                        required
                                    />
                                </Field>
                            )}
                            {mode !== 'forgot' && (
                                <Field>
                                    <FieldLabel className="mb-0" htmlFor="auth-password">
                                        {mode === 'reset' ? 'Mật khẩu mới' : 'Mật khẩu'}
                                    </FieldLabel>
                                    <PasswordInput
                                        className="mt-0"
                                        ref={mode === 'reset' ? firstInput : undefined}
                                        id="auth-password"
                                        name="password"
                                        autoComplete={
                                            newPassword ? 'new-password' : 'current-password'
                                        }
                                        minLength={newPassword ? 8 : 1}
                                        maxLength={72}
                                        required
                                        aria-invalid={fieldIssue?.field === 'password' || undefined}
                                        aria-describedby={
                                            fieldIssue?.field === 'password'
                                                ? 'auth-password-error'
                                                : newPassword
                                                  ? 'auth-password-help'
                                                  : undefined
                                        }
                                    />
                                    {fieldIssue?.field === 'password' ? (
                                        <FieldError id="auth-password-error">
                                            {fieldIssue.message}
                                        </FieldError>
                                    ) : (
                                        newPassword && (
                                            <FieldDescription id="auth-password-help">
                                                Mật khẩu phải có ít nhất 8 ký tự.
                                            </FieldDescription>
                                        )
                                    )}
                                </Field>
                            )}
                            {newPassword && (
                                <Field>
                                    <FieldLabel className="mb-0" htmlFor="auth-confirmation">
                                        Nhập lại mật khẩu
                                    </FieldLabel>
                                    <PasswordInput
                                        className="mt-0"
                                        id="auth-confirmation"
                                        name="confirmation"
                                        visibilityLabel="mật khẩu nhập lại"
                                        autoComplete="new-password"
                                        required
                                        aria-invalid={
                                            fieldIssue?.field === 'confirmation' || undefined
                                        }
                                        aria-describedby={
                                            fieldIssue?.field === 'confirmation'
                                                ? 'auth-confirmation-error'
                                                : undefined
                                        }
                                    />
                                    {fieldIssue?.field === 'confirmation' && (
                                        <FieldError id="auth-confirmation-error">
                                            {fieldIssue.message}
                                        </FieldError>
                                    )}
                                </Field>
                            )}
                            {mode === 'login' && (
                                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                    <Field orientation="horizontal" className="w-auto">
                                        <Checkbox id="auth-remember" name="remember" value="on" />
                                        <FieldLabel className="mb-0" htmlFor="auth-remember">
                                            Ghi nhớ đăng nhập
                                        </FieldLabel>
                                    </Field>
                                    <AuthDialogLink
                                        mode="forgot"
                                        disabled={request.disabled}
                                        className="underline-offset-4 hover:underline"
                                    >
                                        Quên mật khẩu?
                                    </AuthDialogLink>
                                </div>
                            )}
                            <Button type="submit" className="w-full" disabled={request.disabled}>
                                {request.busy && (
                                    <Spinner data-icon="inline-start" aria-hidden="true" />
                                )}
                                {request.busy ? 'Đang xử lý…' : action}
                            </Button>
                        </FieldGroup>
                    </fieldset>
                </form>
            )}
            <p className="m-0 text-center text-muted-foreground text-sm">
                {mode === 'login' ? (
                    <>
                        Chưa có tài khoản?{' '}
                        <AuthDialogLink
                            mode="register"
                            disabled={request.disabled}
                            className="font-semibold text-foreground underline-offset-4 hover:underline"
                        >
                            Tạo tài khoản
                        </AuthDialogLink>
                    </>
                ) : (
                    <AuthDialogLink
                        mode="login"
                        disabled={request.disabled}
                        className="font-semibold text-foreground underline-offset-4 hover:underline"
                    >
                        Quay lại đăng nhập
                    </AuthDialogLink>
                )}
            </p>
        </>
    );
}
