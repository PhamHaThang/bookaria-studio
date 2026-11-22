import type { ReactNode } from 'react';

export function StudioPageHeader({
    title,
    description,
    actions,
}: {
    title: string;
    description: ReactNode;
    actions?: ReactNode;
}) {
    return (
        <header data-slot="studio-page-header" className="@container/studio-header mb-6 sm:mb-8">
            <div className="grid min-w-0 @min-[52rem]/studio-header:grid-cols-[minmax(0,1fr)_auto] @min-[52rem]/studio-header:items-start gap-4">
                <div className="min-w-0">
                    <h1 className="m-0 font-semibold @min-[40rem]/studio-header:text-3xl text-2xl leading-tight tracking-tight">
                        {title}
                    </h1>
                    <p className="m-0 mt-2 max-w-2xl text-muted-foreground text-sm leading-6">
                        {description}
                    </p>
                </div>
                {actions && (
                    <div
                        data-slot="studio-page-actions"
                        className="flex min-w-0 flex-wrap gap-2 *:min-h-11 *:min-w-0 *:flex-1 @min-[32rem]/studio-header:*:flex-none *:basis-36 @min-[32rem]/studio-header:*:basis-auto *:whitespace-nowrap"
                    >
                        {actions}
                    </div>
                )}
            </div>
        </header>
    );
}
