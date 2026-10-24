import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { ConfirmationDialog } from './ConfirmationDialog';
import { Dialog, DialogContent, DialogTitle } from './primitives/dialog';

export function ConfirmDialog({
    title,
    confirmation = false,
    children,
    busy,
    onClose,
    className,
    returnFocus,
}: {
    title: string;
    confirmation?: boolean;
    children: ReactNode;
    busy: boolean;
    onClose: () => void;
    className?: string;
    returnFocus?: HTMLElement | null;
}) {
    if (confirmation)
        return (
            <ConfirmationDialog
                title={title}
                busy={busy}
                onClose={onClose}
                className={className}
                returnFocus={returnFocus}
            >
                {children}
            </ConfirmationDialog>
        );
    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open && !busy) onClose();
            }}
        >
            <DialogContent
                className={cn('confirm-dialog', className)}
                showCloseButton={false}
                aria-describedby={undefined}
                onCloseAutoFocus={(event) => {
                    if (returnFocus?.isConnected) {
                        event.preventDefault();
                        returnFocus.focus({ preventScroll: true });
                    }
                }}
                onEscapeKeyDown={(event) => {
                    if (busy) event.preventDefault();
                }}
                onInteractOutside={(event) => event.preventDefault()}
            >
                <DialogTitle>{title}</DialogTitle>
                {children}
            </DialogContent>
        </Dialog>
    );
}
