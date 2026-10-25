import { useEffect, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '../../../shared/ui/primitives/dialog';
import { Skeleton } from '../../../shared/ui/primitives/skeleton';

export function ImportPreviewDialog({
    file,
    opener,
    onClose,
}: {
    file: File;
    opener: HTMLElement | null;
    onClose: () => void;
}) {
    const [url, setUrl] = useState<string | null>(null);
    useEffect(() => {
        const next = URL.createObjectURL(file);
        setUrl(next);
        return () => URL.revokeObjectURL(next);
    }, [file]);
    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent
                className="flex max-h-[calc(100dvh-48px)] max-w-240 flex-col gap-4 p-5"
                onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    if (opener?.isConnected) opener.focus({ preventScroll: true });
                }}
            >
                <DialogHeader className="pr-10">
                    <DialogTitle className="wrap-anywhere leading-snug">{file.name}</DialogTitle>
                    <DialogDescription>
                        Ảnh gốc sẽ được đặt trọn trong khổ sách đã chọn.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex min-h-0 items-center justify-center overflow-auto rounded-lg bg-muted p-3">
                    {url ? (
                        <img
                            src={url}
                            alt={file.name}
                            className="max-h-[72dvh] max-w-full object-contain"
                        />
                    ) : (
                        <Skeleton className="h-96 w-full" />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
