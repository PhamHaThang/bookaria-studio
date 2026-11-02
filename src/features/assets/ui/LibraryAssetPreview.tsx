import { AssetMediaPreview } from '@/features/scene/ui/AssetMediaPreview';
import type { Asset } from '@/shared/contracts/dto.schema';
import { formatBytes } from '@/shared/lib/format';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/shared/ui/primitives/dialog';
import { assetStatusLabels, assetTypeLabels } from '../model/assets';

export function LibraryAssetPreview({ asset, onClose }: { asset: Asset; onClose: () => void }) {
    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent className="max-h-[calc(100dvh-32px)] max-w-[min(960px,calc(100vw-32px))] gap-5 overflow-y-auto">
                <DialogHeader className="pr-8">
                    <DialogTitle>{asset.name}</DialogTitle>
                    <DialogDescription>
                        {assetTypeLabels[asset.type]} — {formatBytes(asset.sizeBytes)} —{' '}
                        {assetStatusLabels[asset.status]}
                    </DialogDescription>
                </DialogHeader>
                <div className="h-[min(55dvh,480px)] min-h-40 overflow-hidden rounded-xl border border-border bg-background">
                    {asset.status === 'READY' ? (
                        <AssetMediaPreview key={asset.id} type={asset.type} url={asset.url} />
                    ) : (
                        <p className="grid h-full place-items-center p-6 text-muted-foreground text-sm">
                            Tài nguyên chưa sẵn sàng để xem trước.
                        </p>
                    )}
                </div>
                {(asset.authorName || asset.license || asset.sourceUrl) && (
                    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-3 text-sm">
                        {asset.authorName && (
                            <>
                                <dt className="text-muted-foreground">Tác giả</dt>
                                <dd>{asset.authorName}</dd>
                            </>
                        )}
                        {asset.license && (
                            <>
                                <dt className="text-muted-foreground">Giấy phép</dt>
                                <dd>{asset.license}</dd>
                            </>
                        )}
                        {asset.sourceUrl && (
                            <>
                                <dt className="text-muted-foreground">Nguồn</dt>
                                <dd>
                                    <a
                                        className="break-all underline underline-offset-4"
                                        href={asset.sourceUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Xem nguồn tài nguyên
                                    </a>
                                </dd>
                            </>
                        )}
                    </dl>
                )}
            </DialogContent>
        </Dialog>
    );
}
