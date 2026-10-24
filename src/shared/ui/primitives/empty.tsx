import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/shared/lib/cn';

function Empty({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="empty"
            className={cn(
                'flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 text-balance rounded-xl border-dashed p-6 text-center',
                className,
            )}
            {...props}
        />
    );
}

function EmptyHeader({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="empty-header"
            className={cn('flex max-w-[50ch] flex-col items-center gap-3', className)}
            {...props}
        />
    );
}

const emptyMediaVariants = cva(
    'mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0',
    {
        variants: {
            variant: {
                default: 'bg-transparent',
                icon: "flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground [&_svg:not([class*='size-'])]:size-4",
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    },
);

function EmptyMedia({
    className,
    variant = 'default',
    ...props
}: React.ComponentProps<'div'> & VariantProps<typeof emptyMediaVariants>) {
    return (
        <div
            data-slot="empty-icon"
            data-variant={variant}
            className={cn(emptyMediaVariants({ variant, className }))}
            {...props}
        />
    );
}

function EmptyTitle({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="empty-title"
            className={cn(
                'font-semibold text-[length:var(--text-2xl)] text-foreground [&_h2]:m-0 [&_h2]:text-inherit [&_h3]:m-0 [&_h3]:text-inherit',
                className,
            )}
            {...props}
        />
    );
}

function EmptyDescription({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="empty-description"
            className={cn(
                'text-[length:var(--text-md)] text-muted-foreground leading-relaxed [&_a:hover]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_p]:m-0',
                className,
            )}
            {...props}
        />
    );
}

function EmptyContent({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="empty-content"
            className={cn(
                'flex w-full min-w-0 max-w-sm flex-col items-center gap-2.5 text-balance text-sm',
                className,
            )}
            {...props}
        />
    );
}

export { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle };
