import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { safeReturnPath, validateNewPassword } from '@/features/auth/model/form';
import { auth, useAuth } from '@/features/auth/model/session';
import { errorMessage } from '@/shared/api/errors';
import { Button } from '@/shared/ui/Button';
import { Feedback } from '@/shared/ui/Feedback';

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
                <Link className="button" to="/forgot-password">
                    Yêu cầu liên kết mới
                </Link>
            </>
        );
    return (
        <>
            <h1>{title}</h1>
            <p className="intro">{description}</p>
            <Feedback
                error={error || (mode === 'login' ? session.message : null)}
                success={success}
            />
            {!(mode === 'reset' && success) && (
                <form onSubmit={submit} aria-busy={busy}>
                    <fieldset disabled={busy}>
                        {mode === 'register' && (
                            <label htmlFor="displayName">
                                Họ tên
                                <input
                                    id="displayName"
                                    name="displayName"
                                    autoComplete="name"
                                    maxLength={100}
                                    required
                                />
                            </label>
                        )}
                        {mode !== 'reset' && (
                            <label htmlFor="email">
                                Email
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                />
                            </label>
                        )}
                        {hasPassword && (
                            <>
                                <label htmlFor="password">
                                    {mode === 'reset' ? 'Mật khẩu mới' : 'Mật khẩu'}
                                    <input
                                        id="password"
                                        name="password"
                                        type={visible ? 'text' : 'password'}
                                        autoComplete={
                                            newPassword ? 'new-password' : 'current-password'
                                        }
                                        minLength={newPassword ? 8 : 1}
                                        maxLength={72}
                                        required
                                        aria-describedby={newPassword ? 'password-help' : undefined}
                                    />
                                </label>
                                {newPassword && (
                                    <p className="hint" id="password-help">
                                        Ít nhất 8 ký tự, tối đa 72 byte.
                                    </p>
                                )}
                                <button
                                    className="password-toggle text-button"
                                    type="button"
                                    aria-pressed={visible}
                                    onClick={() => setVisible(!visible)}
                                >
                                    {visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                </button>
                            </>
                        )}
                        {newPassword && (
                            <label htmlFor="confirmation">
                                Nhập lại mật khẩu
                                <input
                                    id="confirmation"
                                    name="confirmation"
                                    type={visible ? 'text' : 'password'}
                                    autoComplete="new-password"
                                    required
                                />
                            </label>
                        )}
                        {mode === 'login' && (
                            <div className="form-options">
                                <label className="checkbox">
                                    <input type="checkbox" name="remember" />
                                    Ghi nhớ đăng nhập
                                </label>
                                <Link to="/forgot-password">Quên mật khẩu?</Link>
                            </div>
                        )}
                        <Button type="submit" loading={busy} fullWidth>
                            {busy ? 'Đang xử lý…' : action}
                        </Button>
                    </fieldset>
                </form>
            )}
            <p className="form-footer">
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
