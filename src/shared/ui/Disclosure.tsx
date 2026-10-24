import { createContext, type ReactNode, useContext, useId } from 'react';
import { cn } from '@/shared/lib/cn';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from './primitives/accordion';

const GroupContext = createContext<{ disabledContent: boolean } | null>(null);
export function DisclosureGroup({
    children,
    defaultValue,
    disabledContent = false,
}: {
    children: ReactNode;
    defaultValue: string;
    disabledContent?: boolean;
}) {
    return (
        <GroupContext.Provider value={{ disabledContent }}>
            <Accordion type="single" collapsible defaultValue={defaultValue}>
                {children}
            </Accordion>
        </GroupContext.Provider>
    );
}
export function Disclosure({
    title,
    children,
    value,
    defaultOpen = false,
    variant = 'default',
    className,
}: {
    title: ReactNode;
    children: ReactNode;
    value?: string;
    defaultOpen?: boolean;
    variant?: 'default' | 'panel';
    className?: string;
}) {
    const group = useContext(GroupContext);
    const generatedId = useId();
    const itemValue = value ?? generatedId;
    const item = (
        <AccordionItem
            value={itemValue}
            className={cn(
                className,
                variant === 'panel' && 'rounded-[var(--radius-lg)] border border-border px-4',
            )}
        >
            <AccordionTrigger>{title}</AccordionTrigger>
            <AccordionContent forceMount>
                <fieldset disabled={group?.disabledContent} className="contents">
                    {children}
                </fieldset>
            </AccordionContent>
        </AccordionItem>
    );
    return group ? (
        item
    ) : (
        <Accordion type="single" collapsible defaultValue={defaultOpen ? itemValue : undefined}>
            {item}
        </Accordion>
    );
}
