import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/shared/ui/primitives/dialog';

export function AdminDialog({
    open,
    busy = false,
    title,
    description,
    onClose,
    children,
    className,
    onOpenAutoFocus,
}: {
    open: boolean;
    busy?: boolean;
    title: string;
    description: string;
    onClose: () => void;
    children: ReactNode;
    className?: string;
    onOpenAutoFocus?: ComponentProps<typeof DialogContent>['onOpenAutoFocus'];
}) {
    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next && !busy) onClose();
            }}
        >
            <DialogContent
                showCloseButton={!busy}
                onOpenAutoFocus={onOpenAutoFocus}
                className={cn(
                    'flex max-h-[calc(100dvh-32px)] max-w-[min(600px,calc(100vw-32px))] flex-col gap-4 overflow-hidden p-5 sm:p-6',
                    className,
                )}
            >
                <DialogHeader className="shrink-0">
                    <DialogTitle className="pr-8">{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                {children}
            </DialogContent>
        </Dialog>
    );
}
