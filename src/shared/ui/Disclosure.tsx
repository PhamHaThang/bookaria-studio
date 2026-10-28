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
    multiple = false,
}: {
    children: ReactNode;
    defaultValue: string | string[];
    multiple?: boolean;
    disabledContent?: boolean;
}) {
    return (
        <GroupContext.Provider value={{ disabledContent }}>
            {multiple ? (
                <Accordion
                    type="multiple"
                    defaultValue={Array.isArray(defaultValue) ? defaultValue : [defaultValue]}
                >
                    {children}
                </Accordion>
            ) : (
                <Accordion
                    type="single"
                    collapsible
                    defaultValue={Array.isArray(defaultValue) ? defaultValue[0] : defaultValue}
                >
                    {children}
                </Accordion>
            )}
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
                variant === 'panel' &&
                    'rounded-[var(--radius-lg)] border border-border px-4 [&>[data-slot=accordion-header]]:m-0!',
            )}
        >
            <AccordionTrigger
                className={variant === 'panel' ? 'min-h-12 items-center py-3' : undefined}
            >
                {title}
            </AccordionTrigger>
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
