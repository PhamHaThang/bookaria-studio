import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

/** Branded waiting state for app entry and route changes; local data keeps its skeletons. */
export function LoadingScreen({
    message = 'Đang mở Bookaria…',
    fullScreen = false,
    compact = false,
    children,
}: {
    message?: string;
    fullScreen?: boolean;
    compact?: boolean;
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
                compact && 'min-h-0 p-0',
            )}
        >
            <div aria-hidden="true" className="flex flex-col items-center gap-6">
                <img
                    src="/brand/bookaria-symbol.svg"
                    alt=""
                    width={96}
                    height={49}
                    className={cn(
                        'h-auto w-24 motion-safe:animate-[bookaria-loading-pulse_1.8s_ease-in-out_infinite]',
                        compact && 'w-30',
                    )}
                />
            </div>
            <div className="flex flex-col items-center gap-6">
                <p
                    className={cn(
                        'm-0 flex items-center justify-center gap-2 text-muted-foreground text-sm',
                        compact && 'min-h-11',
                    )}
                >
                    {message}
                </p>
                {children}
            </div>
        </div>
    );
}
