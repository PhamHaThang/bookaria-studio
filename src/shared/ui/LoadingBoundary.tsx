import {
    type ReactNode,
    useCallback,
    useContext,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import { LoadingScreen } from './LoadingScreen';
import { finishLoadingAnimation } from './loading-completion';
import { RouteLoadingContext } from './route-loading-context';

/** Keep the same mascot mounted across Suspense, session and data handoffs. */
export function LoadingBoundary({
    children,
    fullScreen = false,
    editor = false,
    compact = false,
    message,
}: {
    children: ReactNode;
    fullScreen?: boolean;
    editor?: boolean;
    compact?: boolean;
    message?: string;
}) {
    const parent = useContext(RouteLoadingContext);
    const boot = useRef(fullScreen ? document.getElementById('app-entry-loading') : null);
    const host = useRef<HTMLDivElement>(null);
    const claims = useRef(new Set<symbol>());
    const frame = useRef<number | null>(null);
    const completion = useRef<(() => void) | undefined>(undefined);
    const [loading, setLoading] = useState(Boolean(boot.current));
    const cancel = useCallback(() => {
        if (frame.current !== null) cancelAnimationFrame(frame.current);
        frame.current = null;
        completion.current?.();
        completion.current = undefined;
    }, []);
    const finish = useCallback(() => {
        cancel();
        // Redirects and Suspense can hand off on adjacent commits.
        frame.current = requestAnimationFrame(() => {
            frame.current = requestAnimationFrame(() => {
                frame.current = null;
                if (claims.current.size) return;
                completion.current = finishLoadingAnimation(boot.current || host.current, () => {
                    boot.current?.remove();
                    boot.current = null;
                    setLoading(false);
                });
            });
        });
    }, [cancel]);
    const claim = useCallback(() => {
        const token = Symbol('route-loading');
        const releaseBoot = parent?.booting ? parent.claim() : undefined;
        claims.current.add(token);
        cancel();
        setLoading(true);
        return () => {
            claims.current.delete(token);
            releaseBoot?.();
            finish();
        };
    }, [cancel, finish, parent]);
    useLayoutEffect(() => {
        if (!claims.current.size) finish();
        return cancel;
    }, [cancel, finish]);
    const booting = Boolean(boot.current);
    const owner = useMemo(
        () => ({ fullScreen, booting, claim, parent }),
        [fullScreen, booting, claim, parent],
    );
    return (
        <div
            className={
                fullScreen || compact
                    ? 'contents'
                    : loading
                      ? 'relative min-h-[50vh] w-full'
                      : 'relative w-full'
            }
        >
            <RouteLoadingContext.Provider value={owner}>
                <div className="contents" inert={loading} aria-hidden={loading || undefined}>
                    {children}
                </div>
            </RouteLoadingContext.Provider>
            {loading && !boot.current && (
                <div
                    ref={host}
                    className={
                        fullScreen
                            ? 'fixed inset-0 z-50 overflow-y-auto'
                            : compact
                              ? 'absolute inset-0 z-10 flex items-center justify-center bg-surface p-6'
                              : 'absolute inset-0 z-10 bg-background'
                    }
                    {...(editor ? { 'data-editor-loading': '' } : {})}
                >
                    <RouteLoadingContext.Provider value={null}>
                        <LoadingScreen
                            fullScreen={fullScreen}
                            compact={compact}
                            message={
                                message ?? (editor ? 'Đang mở editor…' : 'Đang tải tài nguyên…')
                            }
                        />
                    </RouteLoadingContext.Provider>
                </div>
            )}
        </div>
    );
}
