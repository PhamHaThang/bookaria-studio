import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { Dialog, DialogContent, DialogTitle } from './primitives/dialog';

export function ConfirmDialog({
    title,
    children,
    busy,
    onClose,
    className,
}: {
    title: string;
    children: ReactNode;
    busy: boolean;
    onClose: () => void;
    className?: string;
}) {
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
