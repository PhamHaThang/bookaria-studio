'use client';

import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Select as SelectPrimitive } from 'radix-ui';
import type * as React from 'react';
import { cn } from '@/shared/lib/cn';

function Select({ ...props }: React.ComponentProps<typeof SelectPrimitive.Root>) {
    return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectGroup({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Group>) {
    return (
        <SelectPrimitive.Group
            data-slot="select-group"
            className={cn('scroll-my-1 p-1', className)}
            {...props}
        />
    );
}

function SelectValue({ ...props }: React.ComponentProps<typeof SelectPrimitive.Value>) {
    return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectTrigger({
    className,
    size = 'default',
    children,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
    size?: 'sm' | 'default';
}) {
    return (
        <SelectPrimitive.Trigger
            data-slot="select-trigger"
            data-size={size}
            className={cn(
                "mt-2 flex w-full min-w-0 items-center justify-between gap-2 rounded-[var(--radius-md)] border border-input bg-surface px-3 py-2 text-left font-normal text-[length:var(--text-md)] text-foreground outline-none transition-colors hover:border-[var(--border-input-hover)] focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-inset disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted-foreground aria-invalid:border-danger-foreground aria-invalid:focus-visible:ring-danger-foreground data-[size=default]:min-h-[var(--control-height)] data-[size=sm]:min-h-[var(--control-height-sm)] data-placeholder:text-muted-foreground [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:flex-1 [&_[data-slot=select-value]]:truncate [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
                className,
            )}
            {...props}
        >
            {children}
            <SelectPrimitive.Icon asChild>
                <ChevronDown
                    className="pointer-events-none size-4 text-muted-foreground"
                    aria-hidden="true"
                />
            </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
    );
}

function SelectContent({
    className,
    children,
    position = 'popper',
    align = 'start',
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
    return (
        <SelectPrimitive.Portal>
            <SelectPrimitive.Content
                data-slot="select-content"
                data-align-trigger={position === 'item-aligned'}
                className={cn(
                    'data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 relative z-50 max-h-[min(320px,var(--radix-select-content-available-height))] min-w-36 max-w-[calc(100vw-16px)] origin-(--radix-select-content-transform-origin) overflow-hidden rounded-[var(--radius-md)] bg-popover text-popover-foreground shadow-[var(--shadow-popover)] outline-none duration-100 data-[state=closed]:animate-out data-[state=open]:animate-in motion-reduce:animate-none',
                    position === 'popper' &&
                        'data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
                    className,
                )}
                position={position}
                align={align}
                {...props}
            >
                <SelectScrollUpButton />
                <SelectPrimitive.Viewport
                    data-position={position}
                    className={cn(
                        'data-[position=popper]:w-full data-[position=popper]:min-w-(--radix-select-trigger-width)',
                        position === 'popper' && 'w-[var(--radix-select-trigger-width)]',
                    )}
                >
                    {children}
                </SelectPrimitive.Viewport>
                <SelectScrollDownButton />
            </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
    );
}

function SelectLabel({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.Label>) {
    return (
        <SelectPrimitive.Label
            data-slot="select-label"
            className={cn('px-1.5 py-1 text-muted-foreground text-xs', className)}
            {...props}
        />
    );
}

function SelectItem({
    className,
    children,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
    return (
        <SelectPrimitive.Item
            data-slot="select-item"
            className={cn(
                "[&_[data-slot=select-item-text]]:wrap-anywhere relative flex min-h-9 w-full cursor-default select-none items-center gap-2 rounded-[var(--radius-sm)] py-2 pr-8 pl-2 text-sm leading-normal outline-none data-disabled:pointer-events-none data-[highlighted]:bg-hover data-[state=checked]:bg-selected data-[state=checked]:font-medium data-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
                className,
            )}
            {...props}
        >
            <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center">
                <SelectPrimitive.ItemIndicator>
                    <Check className="pointer-events-none" aria-hidden="true" />
                </SelectPrimitive.ItemIndicator>
            </span>
            <SelectPrimitive.ItemText data-slot="select-item-text">
                {children}
            </SelectPrimitive.ItemText>
        </SelectPrimitive.Item>
    );
}

function SelectSeparator({
    className,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
    return (
        <SelectPrimitive.Separator
            data-slot="select-separator"
            className={cn('pointer-events-none -mx-1 my-1 h-px bg-border', className)}
            {...props}
        />
    );
}

function SelectScrollUpButton({
    className,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
    return (
        <SelectPrimitive.ScrollUpButton
            data-slot="select-scroll-up-button"
            className={cn(
                "z-10 flex cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
                className,
            )}
            {...props}
        >
            <ChevronUp aria-hidden="true" />
        </SelectPrimitive.ScrollUpButton>
    );
}

function SelectScrollDownButton({
    className,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
    return (
        <SelectPrimitive.ScrollDownButton
            data-slot="select-scroll-down-button"
            className={cn(
                "z-10 flex cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4",
                className,
            )}
            {...props}
        >
            <ChevronDown aria-hidden="true" />
        </SelectPrimitive.ScrollDownButton>
    );
}

export {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectScrollDownButton,
    SelectScrollUpButton,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
};
