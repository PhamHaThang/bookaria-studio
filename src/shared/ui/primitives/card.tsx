import { Slot } from 'radix-ui';
import type * as React from 'react';
import { cn } from '@/shared/lib/cn';

function Card({
    className,
    size = 'default',
    variant = 'default',
    asChild = false,
    ...props
}: React.ComponentProps<'div'> & {
    size?: 'default' | 'sm';
    variant?: 'default' | 'collection';
    asChild?: boolean;
}) {
    const Comp = asChild ? Slot.Root : 'div';
    return (
        <Comp
            data-slot="card"
            data-size={size}
            className={cn(
                variant === 'collection'
                    ? 'group/card text-card-foreground [--card-spacing:1rem]'
                    : 'group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card py-(--card-spacing) text-card-foreground text-sm [--card-spacing:--spacing(4)] has-[>img:first-child]:pt-0 has-data-[slot=card-footer]:pb-0 data-[size=sm]:has-data-[slot=card-footer]:pb-0 data-[size=sm]:[--card-spacing:--spacing(3)] *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl',
                className,
            )}
            {...props}
        />
    );
}

function CardHeader({
    className,
    asChild = false,
    ...props
}: React.ComponentProps<'div'> & { asChild?: boolean }) {
    const Comp = asChild ? Slot.Root : 'div';
    return (
        <Comp
            data-slot="card-header"
            className={cn(
                'group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)',
                className,
            )}
            {...props}
        />
    );
}

function CardTitle({
    className,
    asChild = false,
    ...props
}: React.ComponentProps<'div'> & { asChild?: boolean }) {
    const Comp = asChild ? Slot.Root : 'div';
    return (
        <Comp
            data-slot="card-title"
            className={cn(
                'font-medium text-base leading-snug group-data-[size=sm]/card:text-sm',
                className,
            )}
            {...props}
        />
    );
}

function CardDescription({
    className,
    asChild = false,
    ...props
}: React.ComponentProps<'div'> & { asChild?: boolean }) {
    const Comp = asChild ? Slot.Root : 'div';
    return (
        <Comp
            data-slot="card-description"
            className={cn('text-muted-foreground text-sm', className)}
            {...props}
        />
    );
}

function CardAction({
    className,
    asChild = false,
    ...props
}: React.ComponentProps<'div'> & { asChild?: boolean }) {
    const Comp = asChild ? Slot.Root : 'div';
    return (
        <Comp
            data-slot="card-action"
            className={cn(
                'col-start-2 row-span-2 row-start-1 self-start justify-self-end',
                className,
            )}
            {...props}
        />
    );
}

function CardContent({
    className,
    asChild = false,
    ...props
}: React.ComponentProps<'div'> & { asChild?: boolean }) {
    const Comp = asChild ? Slot.Root : 'div';
    return (
        <Comp
            data-slot="card-content"
            className={cn('px-(--card-spacing)', className)}
            {...props}
        />
    );
}

function CardFooter({
    className,
    asChild = false,
    ...props
}: React.ComponentProps<'div'> & { asChild?: boolean }) {
    const Comp = asChild ? Slot.Root : 'div';
    return (
        <Comp data-slot="card-footer" className={cn('flex items-center', className)} {...props} />
    );
}

export { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
