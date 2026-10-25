import { Skeleton } from './primitives/skeleton';

export type SkeletonLayout =
    | 'books'
    | 'assets'
    | 'rows'
    | 'pages'
    | 'public-books'
    | 'profile'
    | 'author'
    | 'detail'
    | 'stats'
    | 'editor'
    | 'asset-picker'
    | 'page-strip'
    | 'notifications';

const items = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

function TextLines() {
    return (
        <div className="flex min-w-0 flex-1 flex-col gap-3">
            <Skeleton className="h-4 w-3/5 max-w-64" />
            <Skeleton className="h-3 w-4/5 max-w-80" />
            <Skeleton className="h-3 w-2/5 max-w-40" />
        </div>
    );
}

function FormFields() {
    return (
        <div className="flex max-w-180 flex-col gap-6 rounded-[var(--radius-lg)] border border-border bg-surface p-8">
            {items.slice(0, 3).map((id) => (
                <div key={id} className="flex flex-col gap-2">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className={id === 'third' ? 'h-24 w-full' : 'h-11 w-full'} />
                </div>
            ))}
            <Skeleton className="h-11 w-32" />
        </div>
    );
}

function Rows({ layout }: { layout: 'assets' | 'rows' | 'pages' | 'public-books' }) {
    return (
        <div className="flex flex-col border-border border-t">
            {items.slice(0, 4).map((id) => (
                <div key={id} className="flex items-center gap-5 border-border border-b py-5">
                    {layout === 'assets' && <Skeleton className="size-16 shrink-0" />}
                    {layout === 'pages' && <Skeleton className="h-22 w-16 shrink-0" />}
                    {layout === 'public-books' && (
                        <Skeleton className="h-[66px] w-[50px] shrink-0" />
                    )}
                    <TextLines />
                    <Skeleton className="h-8 w-20 shrink-0" />
                </div>
            ))}
        </div>
    );
}

/** Decorative shapes only: LoadingState supplies the single accessible loading message. */
export function ContentSkeleton({ layout }: { layout: SkeletonLayout }) {
    if (layout === 'books')
        return (
            <div className="mx-auto max-w-375">
                <Skeleton className="mb-3 h-3 w-24" />
                <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-[22px]">
                    {items.map((id) => (
                        <div
                            key={id}
                            className="flex min-h-[350px] flex-col gap-3 rounded-xl border border-border bg-surface p-3"
                        >
                            <Skeleton className="h-[190px] w-full rounded-[7px]" />
                            <Skeleton className="mt-2 h-4 w-4/5" />
                            <Skeleton className="h-3 w-3/5" />
                            <div className="mt-auto flex items-center justify-between">
                                <Skeleton className="h-6 w-18" />
                                <Skeleton className="size-5" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    if (layout === 'assets' || layout === 'rows' || layout === 'pages' || layout === 'public-books')
        return (
            <div>
                {(layout === 'assets' || layout === 'public-books') && (
                    <Skeleton className="mb-3 h-3 w-24" />
                )}
                <Rows layout={layout} />
            </div>
        );
    if (layout === 'profile')
        return (
            <div className="flex flex-col gap-8">
                <div className="flex items-center gap-5">
                    <Skeleton className="size-24 shrink-0 rounded-full" />
                    <div className="flex flex-col gap-3">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-10 w-40" />
                    </div>
                </div>
                <FormFields />
            </div>
        );
    if (layout === 'author')
        return (
            <div className="flex flex-col gap-8 py-8">
                <div className="flex items-center gap-4">
                    <Skeleton className="size-16 shrink-0 rounded-full" />
                    <TextLines />
                </div>
                <Skeleton className="h-4 w-4/5 max-w-180" />
                <Rows layout="public-books" />
            </div>
        );
    if (layout === 'detail')
        return (
            <div className="flex flex-col gap-8">
                <div className="flex flex-col gap-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-2/5" />
                    <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-40 w-56" />
                <FormFields />
            </div>
        );
    if (layout === 'stats')
        return (
            <div className="flex flex-col gap-8">
                <div className="grid grid-cols-4 gap-5 border-border border-y py-5">
                    {items.slice(0, 4).map((id) => (
                        <div key={id} className="flex flex-col gap-3">
                            <Skeleton className="h-3 w-24" />
                            <Skeleton className="h-8 w-20" />
                        </div>
                    ))}
                </div>
                <Skeleton className="h-5 w-56" />
                <Skeleton className="h-64 w-full" />
                <Rows layout="rows" />
            </div>
        );
    if (layout === 'asset-picker')
        return (
            <div className="grid grid-cols-4 gap-[22px] py-[18px]">
                {items.slice(0, 4).map((id) => (
                    <div key={id} className="flex min-w-0 flex-col gap-3">
                        <Skeleton className="h-[135px] w-full rounded-[10px]" />
                        <Skeleton className="h-3 w-4/5" />
                        <Skeleton className="h-3 w-3/5" />
                        <Skeleton className="h-[34px] w-full" />
                    </div>
                ))}
            </div>
        );
    if (layout === 'page-strip')
        return (
            <div className="flex items-center justify-center gap-3">
                {items.slice(0, 4).map((id) => (
                    <Skeleton key={id} className="h-18 w-[58px] shrink-0" />
                ))}
            </div>
        );
    if (layout === 'notifications')
        return (
            <div className="flex flex-col divide-y divide-border">
                {items.slice(0, 3).map((id) => (
                    <div key={id} className="flex flex-col gap-3 p-4">
                        <Skeleton className="h-4 w-4/5" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-24" />
                    </div>
                ))}
            </div>
        );
    return (
        <div className="flex min-h-dvh flex-col bg-surface">
            <div className="flex h-19 items-center justify-between gap-6 border-border border-b px-5">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-10 w-72" />
            </div>
            <div className="grid min-h-125 flex-1 grid-cols-[72px_minmax(0,1fr)_340px]">
                <div className="flex flex-col items-center gap-5 border-border border-r py-5">
                    {items.map((id) => (
                        <Skeleton key={id} className="size-9" />
                    ))}
                </div>
                <div className="flex items-center justify-center p-8">
                    <Skeleton className="h-[min(66vh,620px)] w-[min(70%,440px)] rounded-sm" />
                </div>
                <div className="flex flex-col gap-6 border-border border-l p-5">
                    <Skeleton className="h-6 w-32" />
                    <div>
                        <TextLines />
                    </div>
                    <Skeleton className="h-11 w-full" />
                    <Skeleton className="h-24 w-full" />
                </div>
            </div>
            <div className="flex min-h-25 items-center justify-center border-border border-t py-3">
                <ContentSkeleton layout="page-strip" />
            </div>
        </div>
    );
}
