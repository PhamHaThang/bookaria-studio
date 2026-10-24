import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/cn';

const alertVariants = cva(
    'feedback mb-6 rounded-[var(--radius-md)] px-4 py-3 text-[length:var(--text-sm)] wrap-anywhere',
    {
        variants: {
            variant: {
                default: 'bg-info text-info-foreground',
                destructive: 'bg-danger text-danger-foreground',
                success: 'bg-success text-success-foreground',
                warning: 'bg-warning text-warning-foreground',
            },
        },
        defaultVariants: { variant: 'default' },
    },
);
function Alert({
    className,
    variant,
    ...props
}: ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
    return (
        <div
            data-slot="alert"
            role="alert"
            className={cn(alertVariants({ variant }), className)}
            {...props}
        />
    );
}
function AlertTitle({ className, ...props }: ComponentProps<'div'>) {
    return <div data-slot="alert-title" className={cn('font-semibold', className)} {...props} />;
}
function AlertDescription({ className, ...props }: ComponentProps<'div'>) {
    return (
        <div data-slot="alert-description" className={cn('leading-normal', className)} {...props} />
    );
}

export { Alert, AlertDescription, AlertTitle };
