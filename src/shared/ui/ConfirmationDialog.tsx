import { type ReactNode, useId, useLayoutEffect, useRef } from 'react';
import { cn } from '@/shared/lib/cn';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogHeader,
    AlertDialogTitle,
} from './primitives/alert-dialog';

export function ConfirmationDialog({
    title,
    description,
    children,
    busy,
    onClose,
    className,
    returnFocus,
}: {
    title: string;
    description?: ReactNode;
    children: ReactNode;
    busy: boolean;
    onClose: () => void;
    className?: string;
    returnFocus?: HTMLElement | null;
}) {
    const descriptionId = useId();
    const content = useRef<HTMLDivElement>(null);
    const opener = useRef<HTMLElement | null>(null);
    useLayoutEffect(() => {
        opener.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }, []);
    return (
        <AlertDialog
            open
            onOpenChange={(open) => {
                if (!open && !busy) onClose();
            }}
        >
            <AlertDialogContent
                ref={content}
                className={cn('confirm-dialog', className)}
                aria-describedby={description ? descriptionId : undefined}
                onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    const firstButton =
                        content.current?.querySelector<HTMLButtonElement>(
                            '[data-initial-focus]:not(:disabled)',
                        ) ??
                        content.current?.querySelector<HTMLButtonElement>('button:not(:disabled)');
                    (firstButton ?? content.current)?.focus();
                }}
                onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    const target = returnFocus ?? opener.current;
                    if (target?.isConnected && target !== document.body)
                        target.focus({ preventScroll: true });
                    else
                        document
                            .querySelector<HTMLElement>('header a[href="/"]')
                            ?.focus({ preventScroll: true });
                }}
                onEscapeKeyDown={(event) => {
                    if (busy) event.preventDefault();
                }}
            >
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    {description && (
                        <AlertDialogDescription asChild id={descriptionId}>
                            <div>{description}</div>
                        </AlertDialogDescription>
                    )}
                </AlertDialogHeader>
                {children}
            </AlertDialogContent>
        </AlertDialog>
    );
}
