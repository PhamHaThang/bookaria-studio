import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/cn';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

const buttonVariants = cva(
    'button compact inline-flex shrink-0 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-transparent text-[length:var(--text-sm)] leading-[1.4] font-medium no-underline transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-[var(--opacity-disabled)] disabled:shadow-none aria-busy:cursor-progress motion-reduce:transition-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-[18px]',
    {
        variants: {
            variant: {
                default:
                    'primary border-primary bg-primary text-primary-foreground shadow-[var(--shadow-button)] hover:not-disabled:bg-primary-hover active:not-disabled:bg-primary-hover active:not-disabled:shadow-[var(--shadow-button-pressed)]',
                secondary:
                    'secondary bg-secondary text-foreground hover:not-disabled:bg-secondary-hover active:not-disabled:bg-secondary-hover',
                outline:
                    'ghost border-[var(--border-button)] bg-[var(--action-outline)] text-foreground hover:not-disabled:bg-[var(--action-outline-hover)] active:not-disabled:bg-[var(--action-outline-hover)]',
                utility:
                    'rounded-full border-[var(--border-button)] bg-surface text-foreground hover:not-disabled:border-[var(--border-button-hover)] hover:not-disabled:bg-hover active:not-disabled:border-[var(--border-input-hover)] active:not-disabled:bg-selected data-[state=open]:border-[var(--border-input-hover)] data-[state=open]:bg-selected data-[state=open]:hover:not-disabled:border-[var(--border-input-hover)] data-[state=open]:hover:not-disabled:bg-selected',
                ghost: 'bg-transparent text-foreground hover:not-disabled:bg-hover active:not-disabled:bg-hover disabled:border-transparent disabled:bg-transparent',
                destructive:
                    'danger bg-destructive text-destructive-foreground hover:not-disabled:bg-destructive-hover active:not-disabled:bg-destructive-hover',
                'destructive-ghost':
                    'bg-transparent text-destructive hover:not-disabled:bg-destructive/10 hover:not-disabled:text-destructive-hover disabled:border-transparent disabled:bg-transparent',
                link: 'bg-transparent text-link underline-offset-4 hover:not-disabled:underline',
            },
            size: {
                default: 'min-h-10 px-4 py-2',
                hero: 'min-h-12 px-6 py-3 text-base font-medium',
                sm: 'button-sm min-h-[var(--control-height-sm)] px-3 py-1.5 text-[length:var(--text-sm)]',
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
