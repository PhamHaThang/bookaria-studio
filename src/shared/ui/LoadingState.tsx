import type { ReactNode } from 'react';
import { ContentSkeleton, type SkeletonLayout } from './ContentSkeleton';
import { Skeleton } from './primitives/skeleton';
import { Spinner } from './primitives/spinner';

export function LoadingState({
    children,
    layout,
}: {
    children: ReactNode;
    layout?: SkeletonLayout;
}) {
    if (layout)
        return (
            <div
                role="status"
                aria-busy="true"
                data-loading-layout={layout}
                className="w-full min-w-0"
            >
                <span className="sr-only">{children}</span>
                <div aria-hidden="true">
                    <ContentSkeleton layout={layout} />
                </div>
            </div>
        );
    return (
        <div role="status" className="flex flex-col gap-4 py-6">
            <p className="m-0 flex items-center gap-2 text-muted-foreground text-sm">
                <Spinner aria-hidden="true" />
                {children}
            </p>
            <Skeleton aria-hidden="true" className="h-4 w-3/5" />
            <Skeleton aria-hidden="true" className="h-4 w-2/5" />
        </div>
    );
}
