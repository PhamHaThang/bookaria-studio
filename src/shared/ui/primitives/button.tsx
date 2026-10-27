import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/cn';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

const buttonVariants = cva(
    'button compact inline-flex shrink-0 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-transparent text-[length:var(--text-sm)] leading-[1.4] font-semibold no-underline transition-colors duration-150 focus-visible:outline-3 focus-visible:outline-ring focus-visible:outline-offset-3 disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground disabled:opacity-100 aria-busy:cursor-progress [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-[18px]',
    {
        variants: {
            variant: {
                default:
                    'primary bg-primary text-primary-foreground hover:not-disabled:bg-primary-hover',
                secondary:
                    'secondary border-primary bg-surface text-primary hover:not-disabled:bg-primary hover:not-disabled:text-primary-foreground',
                outline:
                    'ghost border-border bg-surface text-primary hover:not-disabled:bg-primary hover:not-disabled:text-primary-foreground',
                ghost: 'bg-transparent text-primary hover:not-disabled:bg-primary hover:not-disabled:text-primary-foreground disabled:border-transparent disabled:bg-transparent',
                destructive:
                    'danger bg-destructive text-destructive-foreground hover:not-disabled:bg-destructive-hover',
                link: 'bg-transparent text-primary underline-offset-4 hover:underline',
            },
            size: {
                default: 'min-h-[var(--control-height)] px-4 py-3',
                sm: 'button-sm min-h-[var(--control-height-sm)] px-3 py-2 text-[length:var(--text-xs)]',
                icon: 'size-10 p-2',
                'icon-sm': 'size-8 p-1.5',
                'icon-xs': 'size-7 p-1',
                xs: 'h-7 px-2 text-xs',
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
}: Omit<ComponentProps<'button'> & VariantProps<typeof buttonVariants>, 'variant'> & {
    variant?: VariantProps<typeof buttonVariants>['variant'] | 'plain';
    asChild?: boolean;
}) {
    const Comp = asChild ? Slot.Root : 'button';
    const element = (
        <Comp
            data-slot="button"
            type={asChild ? undefined : type}
            className={
                variant === 'plain'
                    ? cn(
                          'outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                          className,
                      )
                    : cn(buttonVariants({ variant, size }), className)
            }
            {...props}
            title={undefined}
        />
    );
    return props.title ? (
        <Tooltip>
            <TooltipTrigger asChild>{element}</TooltipTrigger>
            <TooltipContent>{props.title}</TooltipContent>
        </Tooltip>
    ) : (
        element
    );
}

export { Button, buttonVariants };
