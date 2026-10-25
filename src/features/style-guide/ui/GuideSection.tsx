import type { ReactNode } from 'react';

export function GuideSection({
    id,
    title,
    description,
    children,
}: {
    id: string;
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <section
            id={id}
            aria-labelledby={`${id}-title`}
            className="scroll-mt-8 border-border border-b py-10 first:pt-0"
        >
            <h2 id={`${id}-title`} className="m-0 text-2xl">
                {title}
            </h2>
            <p className="mt-3 mb-6 max-w-[70ch] text-muted-foreground text-sm">{description}</p>
            {children}
        </section>
    );
}

export function Sample({
    title,
    source,
    children,
}: {
    title: string;
    source: string;
    children: ReactNode;
}) {
    return (
        <div className="flex min-w-0 flex-col gap-4">
            <div>
                <h3 className="m-0 font-semibold text-base">{title}</h3>
                <code className="mt-1 block break-words text-muted-foreground text-xs">
                    {source}
                </code>
            </div>
            {children}
        </div>
    );
}
