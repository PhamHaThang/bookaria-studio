import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '../../../shared/api/errors';
import type { Asset } from '../../../shared/contracts/dto.schema';
import type { AssetType } from '../../../shared/contracts/enums.schema';
import { formatBytes } from '../../../shared/lib/format';
import { Button } from '../../../shared/ui/Button';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { Feedback } from '../../../shared/ui/Feedback';
import {
    AssetThumbnail,
    assetKeys,
    assetStatusLabels,
    assetsApi,
    assetTypeLabels,
} from '../../assets';
import { useAuth } from '../../auth';

export function AssetPicker({
    type,
    onChoose,
    onClose,
}: {
    type: AssetType;
    onChoose: (asset: Asset) => void;
    onClose: () => void;
}) {
    const { user } = useAuth();
    const [scope, setScope] = useState<'mine' | 'library'>('mine'),
        [search, setSearch] = useState(''),
        [query, setQuery] = useState(''),
        [page, setPage] = useState(1);
    const [busy, setBusy] = useState(false),
        [error, setError] = useState<string | null>(null);
    const controller = useRef<AbortController | null>(null);
    useEffect(() => () => controller.current?.abort(), []);
    useEffect(() => {
        const timeout = setTimeout(() => {
            setQuery(search.trim());
            setPage(1);
        }, 300);
        return () => clearTimeout(timeout);
    }, [search]);
    const input = { scope, type, q: query || undefined, page, limit: 8 };
    const list = useQuery({
        queryKey: assetKeys.list(user?.id || '', input),
        queryFn: ({ signal }) => assetsApi.list(input, signal),
        refetchOnWindowFocus: false,
    });
    return (
        <ConfirmDialog
            className="scene-asset-picker"
            title={`Chọn ${assetTypeLabels[type].charAt(0).toLowerCase()}${assetTypeLabels[type].slice(1)}`}
            busy={busy}
            onClose={onClose}
        >
            <p>Chọn tài nguyên của bạn hoặc thư viện chung. Chỉ tệp sẵn sàng mới dùng được.</p>
            <Feedback error={error} />
            <fieldset className="asset-picker-filters" disabled={busy}>
                <label htmlFor="picker-scope">
                    Nguồn
                    <select
                        id="picker-scope"
                        value={scope}
                        onChange={(event) => {
                            setScope(event.currentTarget.value as typeof scope);
                            setPage(1);
                        }}
                    >
                        <option value="mine">Tài nguyên của tôi</option>
                        <option value="library">Thư viện chung</option>
                    </select>
                </label>
                <label htmlFor="picker-search">
                    Tìm tài nguyên
                    <input
                        id="picker-search"
                        type="search"
                        value={search}
                        maxLength={100}
                        onChange={(event) => setSearch(event.currentTarget.value)}
                    />
                </label>
            </fieldset>
            {list.isPending && <p role="status">Đang tải tài nguyên…</p>}
            {list.isError && (
                <>
                    <Feedback error={errorMessage(list.error)} />
                    <Button
                        variant="secondary"
                        onClick={() => {
                            void list.refetch();
                        }}
                    >
                        Thử tải lại tài nguyên
                    </Button>
                </>
            )}
            {list.data && (
                <>
                    <ul className="scene-picker-list">
                        {list.data.data.map((asset) => (
                            <li key={asset.id}>
                                <AssetThumbnail asset={asset} />
                                <div>
                                    <strong>{asset.name}</strong>
                                    <p>
                                        {formatBytes(asset.sizeBytes)} ·{' '}
                                        {assetStatusLabels[asset.status]}
                                    </p>
                                </div>
                                <Button
                                    variant="secondary"
                                    disabled={busy || asset.status !== 'READY'}
                                    onClick={async () => {
                                        if (controller.current) return;
                                        const active = new AbortController();
                                        controller.current = active;
                                        setBusy(true);
                                        setError(null);
                                        try {
                                            const fresh = await assetsApi.detail(
                                                asset.id,
                                                active.signal,
                                            );
                                            active.signal.throwIfAborted();
                                            if (fresh.type !== type || fresh.status !== 'READY')
                                                throw new Error(
                                                    'Tài nguyên chưa sẵn sàng. Hãy chọn tệp khác.',
                                                );
                                            onChoose(fresh);
                                        } catch (cause) {
                                            if (!active.signal.aborted)
                                                setError(errorMessage(cause));
                                        } finally {
                                            controller.current = null;
                                            setBusy(false);
                                        }
                                    }}
                                    aria-label={`Chọn ${asset.name}`}
                                >
                                    Chọn
                                </Button>
                            </li>
                        ))}
                    </ul>
                    {list.data.data.length === 0 && (
                        <p>
                            Không có tài nguyên phù hợp. Bạn có thể tải tệp tại mục Tài nguyên rồi
                            quay lại.
                        </p>
                    )}
                    <div className="form-actions scene-picker-pagination">
                        <Button
                            variant="ghost"
                            disabled={busy || page <= 1}
                            onClick={() => setPage((value) => value - 1)}
                        >
                            Trước
                        </Button>
                        <span>
                            Trang {page} / {Math.max(1, list.data.meta.totalPages)}
                        </span>
                        <Button
                            variant="ghost"
                            disabled={busy || page >= list.data.meta.totalPages}
                            onClick={() => setPage((value) => value + 1)}
                        >
                            Sau
                        </Button>
                    </div>
                </>
            )}
            <div className="form-actions">
                <Button variant="ghost" disabled={busy} onClick={onClose}>
                    Đóng chọn tài nguyên
                </Button>
            </div>
        </ConfirmDialog>
    );
}
