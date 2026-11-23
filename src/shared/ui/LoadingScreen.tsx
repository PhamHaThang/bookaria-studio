import { type ReactNode, useContext, useEffect, useLayoutEffect, useState } from 'react';
import { cn } from '../lib/cn';
import { Boki } from './Boki';
import { RouteLoadingContext } from './route-loading-context';

/** Branded waiting state for app entry and route changes; local data keeps its skeletons. */
export function LoadingScreen({
    message = 'Đang tải tài nguyên…',
    fullScreen = false,
    compact = false,
    children,
}: {
    message?: string;
    fullScreen?: boolean;
    compact?: boolean;
    children?: ReactNode;
}) {
    let owner = useContext(RouteLoadingContext);
    while (owner && owner.fullScreen !== fullScreen) owner = owner.parent;
    const delegate = owner?.claim;
    useLayoutEffect(() => delegate?.(), [delegate]);
    const [showMascot, setShowMascot] = useState(false);
    useEffect(() => {
        if (delegate) return;
        const timer = setTimeout(() => setShowMascot(true), 200);
        return () => clearTimeout(timer);
    }, [delegate]);
    if (delegate) return null;
    const mascotSize = 80;
    return (
        <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            data-loading-screen={fullScreen ? 'full' : 'content'}
            className={cn(
                'flex w-full flex-col items-center justify-center gap-3 px-6 py-6 text-center',
                fullScreen ? 'min-h-dvh bg-surface' : 'min-h-[50vh]',
                compact && 'min-h-0 p-0',
            )}
        >
            <div
                aria-hidden="true"
                className="flex shrink-0 items-center justify-center"
                style={{ width: mascotSize, height: mascotSize }}
            >
                {showMascot && <Boki state="loading" size={mascotSize} animate />}
            </div>
            <div className="flex max-w-md flex-col items-center gap-4">
                <p className="m-0 text-balance text-muted-foreground text-sm leading-[22px]">
                    {message}
                </p>
                {children}
            </div>
        </div>
    );
}
