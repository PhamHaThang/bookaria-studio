'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { Tabs as TabsPrimitive } from 'radix-ui';
import type * as React from 'react';
import { cn } from '@/shared/lib/cn';

function Tabs({
    className,
    orientation = 'horizontal',
    ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
    return (
        <TabsPrimitive.Root
            data-slot="tabs"
            orientation={orientation}
            data-orientation={orientation}
            className={cn(
                'group/tabs flex gap-2 data-[orientation=horizontal]:flex-col',
                className,
            )}
            {...props}
        />
    );
}

const tabsListVariants = cva(
    'group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-1 text-muted-foreground data-[variant=line]:w-full data-[variant=line]:justify-start data-[variant=line]:rounded-none data-[variant=line]:border-b data-[variant=line]:border-border data-[variant=line]:p-0',
    {
        variants: {
            variant: {
                default: 'bg-muted',
                line: 'gap-4 bg-transparent',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    },
);

function TabsList({
    className,
    variant = 'default',
    ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
    return (
        <TabsPrimitive.List
            data-slot="tabs-list"
            data-variant={variant}
            className={cn(tabsListVariants({ variant }), className)}
            {...props}
        />
    );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
    return (
        <TabsPrimitive.Trigger
            data-slot="tabs-trigger"
            className={cn(
                'inline-flex min-h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-2 font-medium text-muted-foreground text-sm outline-none transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 data-[state=active]:bg-surface data-[state=active]:text-primary',
                'group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:border-transparent group-data-[variant=line]/tabs-list:border-b-2 group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:px-0 group-data-[variant=line]/tabs-list:data-[state=active]:border-primary group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent',
                className,
            )}
            {...props}
        />
    );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
    return (
        <TabsPrimitive.Content
            data-slot="tabs-content"
            className={cn('flex-1 text-sm outline-none data-[state=inactive]:hidden', className)}
            {...props}
        />
    );
}

export { Tabs, TabsContent, TabsList, TabsTrigger, tabsListVariants };
