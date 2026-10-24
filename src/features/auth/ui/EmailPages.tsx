import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { errorMessage } from '../../../shared/api/errors';
import { Feedback } from '../../../shared/ui/Feedback';
import { auth, useAuth } from '../model/session';

export function CheckEmail() {
    const { user } = useAuth();
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    async function resend() {
        setBusy(true);
        setError(null);
        setSuccess(null);
        try {
            await auth.resendVerification();
            setSuccess('Đã gửi yêu cầu. Hãy kiểm tra hộp thư và thư rác.');
        } catch (cause) {
            setError(errorMessage(cause));
        } finally {
            setBusy(false);
        }
    }
    return (
        <>
            <h1>{user?.emailVerified ? 'Email đã xác minh' : 'Kiểm tra email của bạn'}</h1>
            <p className="intro mx-0 mt-0 mb-8 text-muted-foreground">
                {user?.emailVerified ? (
                    'Tài khoản của bạn đã sẵn sàng cho bước xuất bản.'
                ) : (
                    <>
                        Mở liên kết xác minh gửi đến <strong>{user?.email}</strong>. Bạn vẫn có thể
                        vào Studio trước khi xác minh.
                    </>
                )}
            </p>
            <Feedback error={error} success={success} />
            {!user?.emailVerified && (
                <Button fullWidth aria-busy={busy} onClick={resend} disabled={busy}>
                    {busy && <Spinner data-icon="inline-start" aria-hidden="true" />}
                    {busy ? 'Đang gửi…' : 'Gửi lại email xác minh'}
                </Button>
            )}
            <Button variant="secondary" fullWidth asChild>
                <Link to="/books">Vào Studio</Link>
            </Button>
        </>
    );
}

export function VerifyEmail() {
    const [params] = useSearchParams();
    const token = params.get('token') || '';
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [busy, setBusy] = useState(false);
    async function verify() {
        setBusy(true);
        setError(null);
        try {
            await auth.verifyEmail(token);
            // Verification can belong to a different account; do not blindly set its flag locally.
            if (auth.store.getState().user) await auth.profile().catch(() => undefined);
            setSuccess(true);
        } catch (cause) {
            setError(errorMessage(cause));
        } finally {
            setBusy(false);
        }
    }
    return (
        <>
            <h1>{success ? 'Xác minh thành công' : 'Xác minh email'}</h1>
            <p className="intro mx-0 mt-0 mb-8 text-muted-foreground">
                {success
                    ? 'Email đã được xác nhận. Bạn có thể tiếp tục vào Studio.'
                    : 'Bấm xác minh để hoàn tất việc xác nhận email của bạn.'}
            </p>
            <Feedback
                error={error || (!token ? 'Liên kết thiếu mã xác minh. Hãy mở lại email.' : null)}
            />
            {!success && token && (
                <Button fullWidth aria-busy={busy} onClick={verify} disabled={busy}>
                    {busy && <Spinner data-icon="inline-start" aria-hidden="true" />}
                    {busy ? 'Đang xác minh…' : 'Xác minh email'}
                </Button>
            )}
            <Button variant="secondary" fullWidth asChild>
                <Link to={success ? '/books' : '/check-email'}>
                    {success ? 'Tiếp tục vào Studio' : 'Gửi lại email xác minh'}
                </Link>
            </Button>
        </>
    );
}
