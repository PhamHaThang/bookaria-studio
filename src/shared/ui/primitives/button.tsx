import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/cn';

const buttonVariants = cva(
    'button compact inline-flex shrink-0 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-transparent text-[length:var(--text-sm)] leading-[1.4] font-semibold no-underline transition-colors duration-150 focus-visible:outline-3 focus-visible:outline-ring focus-visible:outline-offset-3 disabled:cursor-not-allowed disabled:opacity-[var(--opacity-disabled)] aria-busy:cursor-progress [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-[18px]',
    {
        variants: {
            variant: {
                default:
                    'primary bg-primary text-primary-foreground hover:not-disabled:bg-primary-hover',
                secondary:
                    'secondary bg-secondary text-secondary-foreground hover:not-disabled:bg-secondary-hover',
                outline:
                    'ghost border-border bg-transparent text-primary hover:not-disabled:bg-hover',
                ghost: 'bg-transparent text-primary hover:not-disabled:bg-hover',
                destructive:
                    'danger bg-destructive text-destructive-foreground hover:not-disabled:bg-destructive-hover',
                link: 'bg-transparent text-primary underline-offset-4 hover:underline',
            },
            size: {
                default: 'min-h-[var(--control-height)] px-4 py-3',
                sm: 'button-sm min-h-[var(--control-height-sm)] px-3 py-2 text-[length:var(--text-xs)]',
                icon: 'size-10 p-2',
            },
        },
        defaultVariants: { variant: 'default', size: 'default' },
    },
);

function Button({
    className,
    variant,
    size,
    asChild = false,
    type = 'button',
    ...props
}: ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
    const Comp = asChild ? Slot.Root : 'button';
    return (
        <Comp
            data-slot="button"
            type={asChild ? undefined : type}
            className={cn(buttonVariants({ variant, size }), className)}
            {...props}
        />
    );
}

export { Button, buttonVariants };
