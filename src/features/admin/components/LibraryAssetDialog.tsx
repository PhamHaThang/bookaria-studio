import type { ReactNode } from 'react';
import { AssetThumbnail, assetTypeLabels } from '@/features/assets';
import type { Asset } from '@/shared/contracts/dto.schema';
import { cn } from '@/shared/lib/cn';
import { formatBytes } from '@/shared/lib/format';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/shared/ui/primitives/dialog';

export function LibraryAssetDialog({
    open,
    busy = false,
    title,
    description,
    onClose,
    children,
    className,
}: {
    open: boolean;
    busy?: boolean;
    title: string;
    description: string;
    onClose: () => void;
    children: ReactNode;
    className?: string;
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

export function LibraryAssetSummary({ asset }: { asset: Asset }) {
    return (
        <span className="flex min-w-0 flex-1 items-center gap-3">
            <AssetThumbnail
                asset={asset}
                className="size-11 shrink-0 rounded-lg border border-border bg-muted text-muted-foreground max-[540px]:size-11 [&_svg]:size-5"
            />
            <span className="grid min-w-0 gap-0.5 text-left">
                <span className="truncate font-medium text-foreground text-sm">{asset.name}</span>
                <span className="truncate text-muted-foreground text-xs">
                    {assetTypeLabels[asset.type]} · {formatBytes(asset.sizeBytes)}
                </span>
            </span>
        </span>
    );
}
