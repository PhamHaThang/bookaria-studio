import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

/** Branded waiting state for app entry and route changes; local data keeps its skeletons. */
export function LoadingScreen({
    message = 'Đang mở Bookaria…',
    fullScreen = false,
    children,
}: {
    message?: string;
    fullScreen?: boolean;
    children?: ReactNode;
}) {
    return (
        <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            data-loading-screen={fullScreen ? 'full' : 'content'}
            className={cn(
                'flex w-full flex-col items-center justify-center gap-8 px-6 py-12 text-center',
                fullScreen ? 'min-h-dvh bg-surface' : 'min-h-[50vh]',
            )}
        >
            <div aria-hidden="true" className="flex flex-col items-center gap-6">
                <img
                    src="/brand/bookaria-symbol.svg"
                    alt=""
                    width={96}
                    height={49}
                    className="h-auto w-24 motion-safe:animate-[bookaria-loading-pulse_1.8s_ease-in-out_infinite]"
                />
            </div>
            <div className="flex flex-col items-center gap-6">
                <p className="m-0 flex items-center justify-center gap-2 text-muted-foreground text-sm">
                    {message}
                </p>
                {children}
            </div>
        </div>
    );
}
