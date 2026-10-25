import { useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/shared/ui/ConfirmationDialog';
import { Feedback } from '@/shared/ui/Feedback';
import { AlertDialogAction, AlertDialogCancel } from '@/shared/ui/primitives/alert-dialog';
import { Button } from '@/shared/ui/primitives/button';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { errorMessage } from '../../../shared/api/errors';
import type { AssetUsage } from '../../../shared/contracts/asset.schema';
import type { Asset } from '../../../shared/contracts/dto.schema';
import { assetKeys, assetsApi } from '../../assets';
import { type AssetPagesCache, removeAssetFromCache } from '../../assets/model/asset-pages';
import { assetInUse } from '../../assets/model/errors';
import { useAuth } from '../../auth';
import { bookKeys } from '../../books';
import { profileKey } from '../../profile';

export function AssetDeleteDialog({
    asset,
    onClose,
    onRemoved,
    returnFocus,
}: {
    asset: Asset;
    onClose: () => void;
    onRemoved: () => void;
    returnFocus: HTMLElement | null;
}) {
    const cache = useQueryClient(),
        { user } = useAuth();
    const [busy, setBusy] = useState(false),
        [error, setError] = useState<string | null>(null),
        [usages, setUsages] = useState<AssetUsage[]>([]);
    const pending = useRef(false);
    async function remove() {
        if (pending.current) return;
        pending.current = true;
        setBusy(true);
        setError(null);
        setUsages([]);
        try {
            const fresh = await assetsApi.detail(asset.id);
            if (fresh.status === 'PROCESSING')
                throw new Error('Tài nguyên chưa sẵn sàng. Hãy chờ xử lý xong rồi thử lại.');
            if (fresh.scope !== 'mine' || fresh.type !== asset.type)
                throw new Error('Không thể xóa tài nguyên này khỏi thư viện cá nhân.');
            await assetsApi.remove(asset.id);
            await cache.cancelQueries({ queryKey: assetKeys.lists(user?.id || '') });
            cache.setQueriesData<AssetPagesCache>(
                { queryKey: assetKeys.lists(user?.id || '') },
                (current) => removeAssetFromCache(current, asset.id),
            );
            cache.removeQueries({
                queryKey: assetKeys.detail(user?.id || '', asset.id),
                exact: true,
            });
            void cache.invalidateQueries({ queryKey: assetKeys.all });
            void cache.invalidateQueries({ queryKey: bookKeys.all });
            void cache.invalidateQueries({ queryKey: profileKey(user?.id || '') });
            toast.success(asset.type === 'MODEL' ? 'Đã xóa mô hình.' : 'Đã xóa tài nguyên.');
            onRemoved();
        } catch (cause) {
            setError(errorMessage(cause));
            setUsages(assetInUse(cause));
        } finally {
            pending.current = false;
            setBusy(false);
        }
    }
    return (
        <ConfirmationDialog
            title={asset.type === 'MODEL' ? 'Xóa mô hình 3D?' : 'Xóa tài nguyên?'}
            description={
                <>
                    Bạn muốn xóa “{asset.name}” khỏi tài nguyên của mình? Tài nguyên đang được sách
                    sử dụng sẽ không thể xóa.
                </>
            }
            busy={busy}
            onClose={onClose}
            returnFocus={returnFocus}
            className="[&_[data-slot=alert]]:mb-0"
        >
            <Feedback error={error} />
            {usages.length > 0 && (
                <div className="mt-3 text-muted-foreground text-sm">
                    <p>Đang được dùng tại:</p>
                    <ul className="mt-2 list-disc pl-5">
                        {usages.slice(0, 3).map((item) => (
                            <li key={item.pageId}>
                                {item.bookTitle} · Trang {item.pageNumber}
                            </li>
                        ))}
                    </ul>
                    {usages.length > 3 && (
                        <p className="mt-2">Và {usages.length - 3} trang khác.</p>
                    )}
                </div>
            )}
            <div className="mt-6 flex justify-end gap-3">
                <AlertDialogCancel disabled={busy} onClick={onClose}>
                    Giữ lại
                </AlertDialogCancel>
                <AlertDialogAction
                    asChild
                    variant="plain"
                    onClick={(event) => event.preventDefault()}
                >
                    <Button
                        variant="destructive"
                        disabled={busy || asset.status === 'PROCESSING'}
                        aria-busy={busy}
                        onClick={() => void remove()}
                    >
                        {busy ? <Spinner /> : <Trash2 data-icon="inline-start" />}Xóa tài nguyên
                    </Button>
                </AlertDialogAction>
            </div>
        </ConfirmationDialog>
    );
}
