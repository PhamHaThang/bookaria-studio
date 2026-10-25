import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Feedback } from '@/shared/ui/Feedback';
import { Button } from '@/shared/ui/primitives/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/primitives/dialog';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { auth, useAuth } from '../model/session';
import { AuthDialogLink } from './AuthDialogLink';
import { type AuthRequestProps, useAuthRequest } from './useAuthRequest';

type EmailDialogProps = AuthRequestProps & { onContinue: () => void; continueLabel: string };

export function CheckEmail({ onContinue, continueLabel, ...props }: EmailDialogProps) {
    const { user } = useAuth();
    const request = useAuthRequest(props);
    const [success, setSuccess] = useState<string | null>(null);
    return (
        <>
            <DialogHeader className="mb-6 pr-5">
                <DialogTitle size="lg" className="m-0">
                    {user?.emailVerified ? 'Email đã xác minh' : 'Kiểm tra email của bạn'}
                </DialogTitle>
                <DialogDescription className="m-0">
                    {user?.emailVerified ? (
                        'Tài khoản của bạn đã sẵn sàng cho bước xuất bản.'
                    ) : (
                        <>
                            Mở liên kết xác minh gửi đến <strong>{user?.email}</strong>. Bạn vẫn có
                            thể vào Studio trước khi xác minh.
                        </>
                    )}
                </DialogDescription>
            </DialogHeader>
            <Feedback error={request.error} success={success} successMode="inline" />
            <div className="flex flex-col gap-3">
                {!user?.emailVerified && (
                    <Button
                        disabled={request.disabled}
                        onClick={() => {
                            setSuccess(null);
                            void request.run(
                                () => auth.resendVerification(),
                                () =>
                                    setSuccess('Đã gửi yêu cầu. Hãy kiểm tra hộp thư và thư rác.'),
                            );
                        }}
                    >
                        {request.busy && <Spinner data-icon="inline-start" aria-hidden="true" />}
                        {request.busy ? 'Đang gửi…' : 'Gửi lại email xác minh'}
                    </Button>
                )}
                <Button variant="outline" disabled={request.disabled} onClick={onContinue}>
                    {continueLabel}
                </Button>
            </div>
        </>
    );
}

export function VerifyEmail({ onContinue, continueLabel, ...props }: EmailDialogProps) {
    const [params] = useSearchParams();
    const token = params.get('token') || '';
    const request = useAuthRequest(props);
    const [success, setSuccess] = useState(false);
    return (
        <>
            <DialogHeader className="mb-6 pr-5">
                <DialogTitle size="lg" className="m-0">
                    {success ? 'Xác minh thành công' : 'Xác minh email'}
                </DialogTitle>
                <DialogDescription className="m-0">
                    {success
                        ? 'Email đã được xác nhận. Bạn có thể tiếp tục vào Studio.'
                        : 'Bấm xác minh để hoàn tất việc xác nhận email của bạn.'}
                </DialogDescription>
            </DialogHeader>
            <Feedback
                error={
                    request.error ||
                    (!token ? 'Liên kết thiếu mã xác minh. Hãy mở lại email.' : null)
                }
            />
            <div className="flex flex-col gap-3">
                {!success && token && (
                    <Button
                        disabled={request.disabled}
                        onClick={() => {
                            void request.run(
                                async () => {
                                    await auth.verifyEmail(
                                        token,
                                    ); /* The token may belong to another account: reload the actual current profile. */
                                    if (auth.store.getState().user)
                                        await auth.profile().catch(() => undefined);
                                },
                                () => setSuccess(true),
                            );
                        }}
                    >
                        {request.busy && <Spinner data-icon="inline-start" aria-hidden="true" />}
                        {request.busy ? 'Đang xác minh…' : 'Xác minh email'}
                    </Button>
                )}
                {success ? (
                    <Button variant="outline" disabled={request.disabled} onClick={onContinue}>
                        {continueLabel}
                    </Button>
                ) : (
                    <Button variant="outline" asChild>
                        <AuthDialogLink mode="check-email" disabled={request.disabled}>
                            Gửi lại email xác minh
                        </AuthDialogLink>
                    </Button>
                )}
            </div>
        </>
    );
}
