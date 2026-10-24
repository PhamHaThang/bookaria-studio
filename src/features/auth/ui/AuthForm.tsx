import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { safeReturnPath, validateNewPassword } from '@/features/auth/model/form';
import { auth, useAuth } from '@/features/auth/model/session';
import { errorMessage } from '@/shared/api/errors';
import { Button } from '@/shared/ui/Button';
import { Feedback } from '@/shared/ui/Feedback';
import { Checkbox } from '@/shared/ui/primitives/checkbox';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { Spinner } from '@/shared/ui/primitives/spinner';

type Mode = 'login' | 'register' | 'forgot' | 'reset';
const copy = {
    login: ['Chào mừng trở lại', 'Đăng nhập để tiếp tục làm việc với sách của bạn.', 'Đăng nhập'],
    register: ['Tạo tài khoản', 'Bắt đầu không gian sáng tạo của riêng bạn.', 'Tạo tài khoản'],
    forgot: [
        'Quên mật khẩu?',
        'Nhập email đã dùng để đăng ký tài khoản Bookaria.',
        'Gửi liên kết đặt lại',
    ],
    reset: ['Đặt mật khẩu mới', 'Chọn mật khẩu mới cho tài khoản của bạn.', 'Lưu mật khẩu mới'],
};

export function AuthForm({ mode }: { mode: Mode }) {
    const [params] = useSearchParams();
    const token = params.get('token') || '';
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [visible, setVisible] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const session = useAuth();
    const [title, description, action] = copy[mode];
    const hasPassword = mode !== 'forgot';
    const newPassword = mode === 'register' || mode === 'reset';

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (busy) return;
        const form = new FormData(event.currentTarget);
        const email = String(form.get('email') || '')
            .trim()
            .toLowerCase();
        const password = String(form.get('password') || '');
        const confirmation = String(form.get('confirmation') || '');
        setError(null);
        setSuccess(null);
        if (newPassword) {
            const invalid = validateNewPassword(password, confirmation);
            if (invalid) {
                setError(invalid);
                return;
            }
        }
        if (mode === 'register' && !String(form.get('displayName') || '').trim()) {
            setError('Vui lòng nhập họ tên.');
            return;
        }
        setBusy(true);
        try {
            if (mode === 'login') {
                await auth.login({ email, password, remember: form.get('remember') === 'on' });
                navigate(safeReturnPath(location.state?.from), { replace: true });
            } else if (mode === 'register') {
                await auth.register({
                    email,
                    password,
                    displayName: String(form.get('displayName')).trim(),
                });
                navigate('/check-email', { replace: true });
            } else if (mode === 'forgot') {
                await auth.forgotPassword(email);
                setSuccess(
                    'Nếu email có trong hệ thống, bạn sẽ nhận được liên kết đặt lại mật khẩu. Hãy kiểm tra cả thư rác.',
                );
            } else {
                await auth.resetPassword(token, password);
                setSuccess('Đã đổi mật khẩu. Hãy đăng nhập lại bằng mật khẩu mới.');
            }
        } catch (cause) {
            setError(errorMessage(cause));
        } finally {
            setBusy(false);
        }
    }
    if (mode === 'reset' && !token)
        return (
            <>
                <h1>Thiếu liên kết đặt lại</h1>
                <p>Mở lại liên kết trong email hoặc yêu cầu một liên kết mới.</p>
                <Button fullWidth asChild>
                    <Link to="/forgot-password">Yêu cầu liên kết mới</Link>
                </Button>
            </>
        );
    return (
        <>
            <h1>{title}</h1>
            <p className="intro mx-0 mt-0 mb-8 text-muted-foreground">{description}</p>
            <Feedback
                error={error || (mode === 'login' ? session.message : null)}
                success={success}
            />
            {!(mode === 'reset' && success) && (
                <form onSubmit={submit} aria-busy={busy}>
                    <FieldGroup className="contents">
                        <fieldset disabled={busy}>
                            {mode === 'register' && (
                                <Field orientation="contents">
                                    <FieldLabel htmlFor="displayName">
                                        Họ tên
                                        <Input
                                            id="displayName"
                                            name="displayName"
                                            autoComplete="name"
                                            maxLength={100}
                                            required
                                        />
                                    </FieldLabel>
                                </Field>
                            )}
                            {mode !== 'reset' && (
                                <Field orientation="contents">
                                    <FieldLabel htmlFor="email">
                                        Email
                                        <Input
                                            id="email"
                                            name="email"
                                            type="email"
                                            autoComplete="email"
                                            required
                                        />
                                    </FieldLabel>
                                </Field>
                            )}
                            {hasPassword && (
                                <>
                                    <Field orientation="contents">
                                        <FieldLabel htmlFor="password">
                                            {mode === 'reset' ? 'Mật khẩu mới' : 'Mật khẩu'}
                                            <Input
                                                id="password"
                                                name="password"
                                                type={visible ? 'text' : 'password'}
                                                autoComplete={
                                                    newPassword
                                                        ? 'new-password'
                                                        : 'current-password'
                                                }
                                                minLength={newPassword ? 8 : 1}
                                                maxLength={72}
                                                required
                                                aria-describedby={
                                                    newPassword ? 'password-help' : undefined
                                                }
                                            />
                                        </FieldLabel>
                                    </Field>
                                    {newPassword && (
                                        <p
                                            className="hint block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.auth-panel_&]:mx-0 [.auth-panel_&]:mt-[calc(-1_*_var(--space-3))] [.auth-panel_&]:mb-4"
                                            id="password-help"
                                        >
                                            Ít nhất 8 ký tự, tối đa 72 byte.
                                        </p>
                                    )}
                                    <button
                                        className="password-toggle mx-0 mt-[calc(-1_*_var(--space-3))] mb-5 inline-flex min-h-11 items-center gap-2 border-0 border-[transparent] border-solid bg-[transparent] px-0 py-1 font-semibold text-[length:var(--text-xs)] text-button text-primary [&:hover:not(:disabled)]:underline [&:hover:not(:disabled)]:underline-offset-1 [.account-actions_&]:text-[length:12px] max-[700px]:[.account-actions_>_&]:min-w-[30px] max-[700px]:[.account-actions_>_&]:flex-[0_0_30px] max-[700px]:[.account-actions_>_&]:gap-0 max-[700px]:[.account-actions_>_&]:p-[5px] max-[700px]:[.account-actions_>_&]:text-[length:0] max-[700px]:[.account-actions_>_&_svg]:w-[18px] [.book-gallery_.book-actions_&]:min-h-7 [.book-gallery_.book-actions_&]:p-[3px]"
                                        type="button"
                                        aria-pressed={visible}
                                        onClick={() => setVisible(!visible)}
                                    >
                                        {visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                    </button>
                                </>
                            )}
                            {newPassword && (
                                <Field orientation="contents">
                                    <FieldLabel htmlFor="confirmation">
                                        Nhập lại mật khẩu
                                        <Input
                                            id="confirmation"
                                            name="confirmation"
                                            type={visible ? 'text' : 'password'}
                                            autoComplete="new-password"
                                            required
                                        />
                                    </FieldLabel>
                                </Field>
                            )}
                            {mode === 'login' && (
                                <div className="form-options mx-0 mt-0 mb-6 flex flex-wrap items-center justify-between gap-3 text-[length:var(--text-xs)]">
                                    <Field orientation="contents">
                                        <FieldLabel className="checkbox m-0 flex items-center gap-2 font-normal [.asset-filter-actions_&]:mr-auto [.scene-inspector_>_&]:my-3 [.scene-object-fields_label:not(&)]:grid [.scene-object-fields_label:not(&)]:gap-2 [.scene-object-fields_label:not(&)]:font-medium [.scene-settings-fields_label:not(&)]:grid [.scene-settings-fields_label:not(&)]:gap-2 [.scene-settings-fields_label:not(&)]:font-medium">
                                            <Checkbox name="remember" value="on" />
                                            Ghi nhớ đăng nhập
                                        </FieldLabel>
                                    </Field>
                                    <Link to="/forgot-password">Quên mật khẩu?</Link>
                                </div>
                            )}
                            <Button type="submit" aria-busy={busy} fullWidth disabled={busy}>
                                {busy && <Spinner data-icon="inline-start" aria-hidden="true" />}
                                {busy ? 'Đang xử lý…' : action}
                            </Button>
                        </fieldset>
                    </FieldGroup>
                </form>
            )}
            <p className="form-footer mx-0 mt-6 mb-0 text-center text-[length:var(--text-sm)] text-muted-foreground">
                {mode === 'login' ? (
                    <>
                        Chưa có tài khoản? <Link to="/register">Tạo tài khoản</Link>
                    </>
                ) : (
                    <Link to="/login">Quay lại đăng nhập</Link>
                )}
            </p>
        </>
    );
}
