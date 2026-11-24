import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Feedback } from '@/shared/ui/Feedback';
import { Button } from '@/shared/ui/primitives/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/primitives/dialog';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { auth, useAuth } from '../model/session';
import { AuthDialogLink } from './AuthDialogLink';
import { type AuthRequestProps, useAuthRequest } from './useAuthRequest';

type EmailSignOutProps = {
    signOut: ReturnType<typeof useAuthRequest>;
    onSignOut: () => void;
};

function EmailSignOut({ signOut, onSignOut }: EmailSignOutProps) {
    return (
        <Button
            variant="plain"
            className="justify-self-center font-semibold text-foreground text-sm underline-offset-4 hover:underline"
            disabled={signOut.disabled}
            onClick={() => void signOut.run(() => auth.logout(), onSignOut)}
        >
            {signOut.busy ? 'Đang đăng xuất…' : 'Đăng xuất'}
        </Button>
    );
}

function ResendEmail({ notice, ...props }: AuthRequestProps & { notice?: string }) {
    const request = useAuthRequest(props);
    const { verificationResendAt } = useAuth();
    const [attempted, setAttempted] = useState(false);
    const [now, setNow] = useState(Date.now);
    useEffect(() => {
        const tick = () => setNow(Date.now());
        tick();
        if (verificationResendAt <= Date.now()) return;
        const timer = window.setInterval(() => {
            tick();
            if (Date.now() >= verificationResendAt) window.clearInterval(timer);
        }, 1000);
        return () => window.clearInterval(timer);
    }, [verificationResendAt]);
    const seconds = Math.max(0, Math.ceil((verificationResendAt - now) / 1000));
    return (
        <>
            <Feedback error={request.error || (!attempted && notice) || null} errorMode="toast" />
            <Button
                disabled={request.disabled || seconds > 0}
                onClick={() => {
                    setAttempted(true);
                    void request.run(auth.resendVerification, () =>
                        toast.success('Đã gửi email xác minh.'),
                    );
                }}
            >
                {request.busy && <Spinner data-icon="inline-start" aria-hidden="true" />}
                {request.busy
                    ? 'Đang gửi…'
                    : seconds
                      ? `Gửi lại sau ${seconds} giây`
                      : 'Gửi lại email'}
            </Button>
        </>
    );
}

export function CheckEmail({
    signOut,
    onSignOut,
    purpose,
    ...props
}: AuthRequestProps & EmailSignOutProps & { purpose: string }) {
    const { user, verificationEmailFailed } = useAuth();
    return (
        <>
            <DialogHeader>
                <DialogTitle size="lg" className="m-0">
                    {user?.emailVerified ? 'Email đã xác minh' : 'Kiểm tra email của bạn'}
                </DialogTitle>
                <DialogDescription className="m-0">
                    {user?.emailVerified ? (
                        <>Bạn có thể tiếp tục {purpose}.</>
                    ) : verificationEmailFailed ? (
                        <>
                            Gửi lại email đến <strong>{user?.email}</strong> để xác minh tài khoản.
                        </>
                    ) : (
                        <>
                            Mở liên kết xác minh gửi đến <strong>{user?.email}</strong> để {purpose}
                            . Hãy kiểm tra cả hộp thư rác.
                        </>
                    )}
                </DialogDescription>
            </DialogHeader>
            <Feedback error={signOut.error} errorMode="toast" />
            {user && !user.emailVerified && (
                <ResendEmail
                    {...props}
                    notice={
                        verificationEmailFailed
                            ? 'Chưa gửi được email xác minh. Bạn có thể yêu cầu gửi lại bên dưới.'
                            : undefined
                    }
                />
            )}
            {user && !user.emailVerified && (
                <EmailSignOut signOut={signOut} onSignOut={onSignOut} />
            )}
        </>
    );
}

export function VerifyEmail({
    onContinue,
    signOut,
    onSignOut,
    ...props
}: AuthRequestProps & EmailSignOutProps & { onContinue: () => void }) {
    const [params] = useSearchParams();
    const { user } = useAuth();
    const token = params.get('token') || '';
    const request = useAuthRequest(props);
    const started = useRef(false);
    const verify = useEffectEvent((code: string) => {
        void request.run(
            async () => {
                await auth.verifyEmail(code);
                // The link may belong to another account. Reload the actual session.
                if (auth.store.getState().user) await auth.profile().catch(() => undefined);
            },
            () => {
                toast.success('Đã xác minh email.');
                onContinue();
            },
        );
    });
    useEffect(() => {
        if (!token || props.locked || started.current) return;
        started.current = true;
        verify(token);
    }, [token, props.locked]);
    const error =
        request.error || (!token ? 'Liên kết thiếu mã xác minh. Hãy mở lại email.' : null);
    return (
        <>
            <DialogHeader>
                <DialogTitle size="lg" className="m-0">
                    {error ? 'Chưa xác minh được email' : 'Đang xác minh email'}
                </DialogTitle>
                <DialogDescription className="m-0">
                    {error
                        ? 'Hãy mở lại liên kết trong email hoặc yêu cầu một email xác minh mới.'
                        : 'Vui lòng đợi trong giây lát.'}
                </DialogDescription>
            </DialogHeader>
            <Feedback errorMode="toast" error={signOut.error || error} />
            {!error && <Spinner aria-hidden="true" />}
            {error && user && !user.emailVerified && <ResendEmail {...props} />}
            {error && user?.emailVerified && <Button onClick={onContinue}>Tiếp tục</Button>}
            {error && !user && (
                <Button asChild>
                    <AuthDialogLink mode="check-email" disabled={request.disabled}>
                        Đăng nhập để gửi lại email
                    </AuthDialogLink>
                </Button>
            )}
            {error && user && <EmailSignOut signOut={signOut} onSignOut={onSignOut} />}
        </>
    );
}
