'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/shared/lib/cn';

import { Button } from '@/shared/ui/primitives/button';
import { Input } from '@/shared/ui/primitives/input';
import { Textarea } from '@/shared/ui/primitives/textarea';

function InputGroup({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="input-group"
            className={cn(
                'group/input-group relative flex min-h-[var(--control-height)] w-full min-w-0 items-center rounded-[var(--radius-md)] border border-input bg-surface outline-none transition-colors hover:border-[var(--border-input-hover)] has-[>textarea]:h-auto has-[>[data-align=block-end]]:flex-col has-[>[data-align=block-start]]:flex-col has-[[data-slot=input-group-control]:focus-visible]:border-primary has-[[data-slot][aria-invalid=true]]:border-danger-foreground has-disabled:bg-background has-[[data-slot=input-group-control]:focus-visible]:ring-1 has-[[data-slot=input-group-control]:focus-visible]:ring-primary has-[[data-slot][aria-invalid=true]]:ring-danger-foreground has-[[data-slot=input-group-control]:focus-visible]:ring-inset has-[>[data-align=inline-end]]:[&>input]:pr-1.5 has-[>[data-align=inline-start]]:[&>input]:pl-1.5',
                className,
            )}
            {...props}
        />
    );
}

const inputGroupAddonVariants = cva(
    "flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm font-medium text-muted-foreground select-none group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-[var(--radius-sm)] [&>svg:not([class*='size-'])]:size-4",
    {
        variants: {
            align: {
                'inline-start': 'order-first py-0 pl-1',
                'inline-end': 'order-last py-0 pr-1',
                'block-start':
                    'order-first w-full justify-start px-2.5 pt-2 group-has-[>input]/input-group:pt-2 [.border-b]:pb-2',
                'block-end':
                    'order-last w-full justify-start px-2.5 pb-2 group-has-[>input]/input-group:pb-2 [.border-t]:pt-2',
            },
        },
        defaultVariants: {
            align: 'inline-start',
        },
    },
);

function InputGroupAddon({
    className,
    align = 'inline-start',
    ...props
}: React.ComponentProps<'div'> & VariantProps<typeof inputGroupAddonVariants>) {
    return (
        <div
            data-slot="input-group-addon"
            data-align={align}
            className={cn(inputGroupAddonVariants({ align }), className)}
            {...props}
        />
    );
}

const inputGroupButtonVariants = cva('flex items-center gap-2 text-sm shadow-none', {
    variants: {
        size: {
            xs: "h-6 gap-1 rounded-[var(--radius-sm)] px-1.5 [&>svg:not([class*='size-'])]:size-3.5",
            sm: '',
            'icon-xs': 'size-6 rounded-[var(--radius-sm)] p-0 has-[>svg]:p-0',
            'icon-sm': 'size-10 p-0 has-[>svg]:p-0',
        },
    },
    defaultVariants: {
        size: 'xs',
    },
});

function InputGroupButton({
    className,
    type = 'button',
    variant = 'ghost',
    size = 'xs',
    ...props
}: Omit<React.ComponentProps<typeof Button>, 'size'> &
    VariantProps<typeof inputGroupButtonVariants>) {
    return (
        <Button
            type={type}
            size={size === 'sm' ? 'sm' : 'icon'}
            data-size={size}
            variant={variant}
            className={cn(inputGroupButtonVariants({ size }), className)}
            {...props}
        />
    );
}

function InputGroupText({ className, ...props }: React.ComponentProps<'span'>) {
    return (
        <span
            className={cn(
                "flex items-center gap-2 text-muted-foreground text-sm [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none",
                className,
            )}
            {...props}
        />
    );
}

function InputGroupInput({ className, ...props }: React.ComponentProps<'input'>) {
    return (
        <Input
            data-slot="input-group-control"
            className={cn(
                'm-0 h-[calc(var(--control-height)-2px)] min-h-0 flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0',
                className,
            )}
            {...props}
        />
    );
}

function InputGroupTextarea({ className, ...props }: React.ComponentProps<'textarea'>) {
    return (
        <Textarea
            data-slot="input-group-control"
            className={cn(
                'm-0 flex-1 resize-none rounded-none border-0 bg-transparent py-2 shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0',
                className,
            )}
            {...props}
        />
    );
}

export {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
    InputGroupText,
    InputGroupTextarea,
};
