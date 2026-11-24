import { X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/shared/ui/primitives/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/shared/ui/primitives/dialog';
import { Spinner } from '@/shared/ui/primitives/spinner';
import {
    type AuthMode,
    authLocation,
    legacyAuthLocation,
    readAuthMode,
    withoutAuth,
} from '../model/dialog';
import { safeReturnPath } from '../model/form';
import { auth, useAuth } from '../model/session';
import { AuthForm } from './AuthForm';
import { CheckEmail, VerifyEmail } from './EmailPages';
import { useAuthRequest } from './useAuthRequest';

export function LegacyAuthRoute({ mode }: { mode: AuthMode }) {
    const location = useLocation();
    return <Navigate to={legacyAuthLocation(location, mode, location.state?.from)} replace />;
}

export function AuthDialog() {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, status } = useAuth();
    const mode = readAuthMode(location.search);
    const params = new URLSearchParams(location.search);
    const next = params.get('next');
    const verificationPath = (next ?? location.pathname).split(/[?#]/, 1)[0] ?? '';
    const verificationPurpose =
        verificationPath === '/profile'
            ? 'tải ảnh đại diện'
            : verificationPath === '/resources'
              ? 'xem thư viện'
              : verificationPath.startsWith('/admin/')
                ? 'quản lý tài nguyên'
                : 'vào Studio';
    const [pending, setPending] = useState(0);
    const [destination, setDestination] = useState<string | null>(null);
    const origin = useRef<HTMLElement | null>(null);
    const wasOpen = useRef(false);
    useLayoutEffect(() => {
        if (mode && !wasOpen.current)
            origin.current =
                document.activeElement instanceof HTMLElement &&
                document.activeElement !== document.body
                    ? document.activeElement
                    : null;
        wasOpen.current = mode !== null;
    }, [mode]);
    const onPending = useCallback(
        (delta: number) => setPending((value) => Math.max(0, value + delta)),
        [],
    );
    const busy = pending > 0;
    const close = useCallback(() => {
        if (location.state?.authDialogBackground) navigate(-1);
        else navigate(withoutAuth(location), { replace: true, state: null });
    }, [location, navigate]);
    // Close authentication before a path change can open the editor's discard dialog.
    const routeAfterAuth = useCallback(
        (target: string) => {
            setDestination(target);
            navigate(withoutAuth(location), { replace: true, state: null });
        },
        [location, navigate],
    );
    useEffect(() => {
        if (mode || !destination) return;
        setDestination(null);
        navigate(destination, { replace: true, state: null });
    }, [destination, mode, navigate]);
    const complete = () => {
        const currentUser = auth.store.getState().user;
        if (currentUser && !currentUser.emailVerified) {
            navigate(authLocation(location, 'check-email'), {
                replace: true,
                state: location.state,
            });
            return;
        }
        if (next) routeAfterAuth(safeReturnPath(next));
        else close();
    };
    const continueInPlace = !next && safeReturnPath(location.pathname) === location.pathname;
    const continueWorkspace = useCallback(() => {
        if (continueInPlace) close();
        else routeAfterAuth(safeReturnPath(next));
    }, [continueInPlace, close, next, routeAfterAuth]);
    const waitingForEmail = mode === 'check-email' && user?.emailVerified === false;
    useEffect(() => {
        if (!waitingForEmail) return;
        let checking = false;
        const recheck = () => {
            if (checking || document.hidden) return;
            checking = true;
            void auth
                .profile()
                .catch(() => undefined)
                .finally(() => {
                    checking = false;
                });
        };
        window.addEventListener('focus', recheck);
        document.addEventListener('visibilitychange', recheck);
        recheck();
        return () => {
            window.removeEventListener('focus', recheck);
            document.removeEventListener('visibilitychange', recheck);
        };
    }, [waitingForEmail]);
    useEffect(() => {
        if (mode === 'check-email' && user?.emailVerified && !busy) continueWorkspace();
    }, [mode, user?.emailVerified, busy, continueWorkspace]);
    useEffect(() => {
        if (mode && auth.store.getState().status === 'loading') void auth.restore();
    }, [mode]);
    useEffect(() => {
        if (user && next && !busy && (mode === 'login' || mode === 'register')) {
            if (user.emailVerified) routeAfterAuth(safeReturnPath(next));
            else
                navigate(authLocation(location, 'check-email'), {
                    replace: true,
                    state: location.state,
                });
        }
    }, [user, next, busy, mode, routeAfterAuth, location, navigate]);
    const requestProps = { locked: busy, onPending };
    // Keep the logout request mounted when clearing the session replaces CheckEmail.
    const signOut = useAuthRequest(requestProps);
    const { setError: setSignOutError } = signOut;
    useEffect(() => {
        if (!mode) setSignOutError(null);
    }, [mode, setSignOutError]);
    const formMode = mode === 'check-email' && !user ? 'login' : mode;
    return (
        <Dialog
            open={mode !== null}
            onOpenChange={(open) => {
                if (!open && !busy) close();
            }}
        >
            <DialogContent
                showCloseButton={false}
                className="max-h-[calc(100dvh-48px)] max-w-[min(416px,calc(100vw-32px))] gap-y-4 overflow-y-auto p-5 sm:p-6 [&>[data-slot=dialog-header]]:gap-1 [&>[data-slot=dialog-header]]:pr-7 [&_.button]:min-h-11"
                onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    if (origin.current?.isConnected) origin.current.focus({ preventScroll: true });
                    else
                        document
                            .querySelector<HTMLElement>('header a[href="/"]')
                            ?.focus({ preventScroll: true });
                }}
                onEscapeKeyDown={(event) => {
                    if (busy) event.preventDefault();
                }}
                onInteractOutside={(event) => {
                    if (busy) event.preventDefault();
                }}
            >
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2"
                    aria-label="Đóng"
                    disabled={busy}
                    onClick={close}
                >
                    <X />
                </Button>
                {status === 'loading' ? (
                    <DialogHeader>
                        <DialogTitle size="lg" className="m-0">
                            Đang kiểm tra đăng nhập
                        </DialogTitle>
                        <DialogDescription className="m-0 flex items-center gap-2">
                            <Spinner className="shrink-0" aria-hidden="true" />
                            Vui lòng đợi trong giây lát.
                        </DialogDescription>
                    </DialogHeader>
                ) : user && !busy && (mode === 'login' || mode === 'register') ? (
                    <>
                        <DialogHeader>
                            <DialogTitle size="lg" className="m-0">
                                Bạn đã đăng nhập
                            </DialogTitle>
                            <DialogDescription className="m-0">
                                Chào {user.displayName}. Tiếp tục xem trang hoặc mở không gian sáng
                                tạo của bạn.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="flex flex-col gap-2">
                            <Button disabled={busy} onClick={complete}>
                                Tiếp tục xem trang
                            </Button>
                            <Button
                                variant="outline"
                                disabled={busy}
                                onClick={() => routeAfterAuth('/books')}
                            >
                                Mở Studio
                            </Button>
                        </div>
                    </>
                ) : formMode === 'login' ||
                  formMode === 'register' ||
                  formMode === 'forgot' ||
                  formMode === 'reset' ? (
                    <AuthForm
                        key={`${formMode}:${params.get('token') || ''}`}
                        mode={formMode}
                        {...requestProps}
                        onComplete={complete}
                    />
                ) : mode === 'check-email' ? (
                    <CheckEmail
                        key={user?.id}
                        {...requestProps}
                        signOut={signOut}
                        onSignOut={close}
                        purpose={verificationPurpose}
                    />
                ) : mode === 'verify' ? (
                    <VerifyEmail
                        key={params.get('token') || ''}
                        {...requestProps}
                        onContinue={continueWorkspace}
                        signOut={signOut}
                        onSignOut={close}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    );
}
