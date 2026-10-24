import { useQuery } from '@tanstack/react-query';
import { Play, RefreshCw, Search, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
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
    const [scope, setScope] = useState<'mine' | 'library'>('library'),
        [search, setSearch] = useState(''),
        [query, setQuery] = useState(''),
        [page, setPage] = useState(1);
    const [categoryId, setCategoryId] = useState(''),
        [hasAnimation, setHasAnimation] = useState(false);
    const categories = useQuery({
        queryKey: assetKeys.categories(user?.id || ''),
        queryFn: ({ signal }) => assetsApi.categories(signal),
    });
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
    const input = {
        scope,
        type,
        q: query || undefined,
        categoryId: categoryId || undefined,
        hasAnimation: type === 'MODEL' && hasAnimation ? true : undefined,
        page,
        limit: 12,
    };
    const list = useQuery({
        queryKey: assetKeys.list(user?.id || '', input),
        queryFn: ({ signal }) => assetsApi.list(input, signal),
        refetchOnWindowFocus: true,
    });
    return (
        <ConfirmDialog
            className="scene-asset-picker"
            title={`Chọn ${assetTypeLabels[type].charAt(0).toLowerCase()}${assetTypeLabels[type].slice(1)}`}
            busy={busy}
            onClose={onClose}
        >
            <Feedback error={error} />
            <div className="library-tools">
                <fieldset className="library-sources" aria-label="Nguồn tài nguyên" disabled={busy}>
                    {(
                        [
                            ['library', 'Thư viện chung'],
                            ['mine', 'Tài nguyên của tôi'],
                        ] as const
                    ).map(([value, label]) => (
                        <button
                            type="button"
                            key={value}
                            aria-pressed={scope === value}
                            onClick={() => {
                                setScope(value);
                                setPage(1);
                            }}
                        >
                            {label}
                        </button>
                    ))}
                </fieldset>
                <label className="library-search">
                    <Search size={17} />
                    <span className="sr-only">Tìm tài nguyên</span>
                    <input
                        type="search"
                        placeholder="Tìm tài nguyên…"
                        value={search}
                        maxLength={100}
                        disabled={busy}
                        onChange={(event) => setSearch(event.currentTarget.value)}
                    />
                </label>
            </div>
            <div className="library-options">
                <label>
                    Danh mục
                    <select
                        value={categoryId}
                        disabled={busy}
                        onChange={(event) => {
                            setCategoryId(event.currentTarget.value);
                            setPage(1);
                        }}
                    >
                        <option value="">Tất cả danh mục</option>
                        {categories.data?.map((category) => (
                            <option value={category.id} key={category.id}>
                                {category.name}
                            </option>
                        ))}
                    </select>
                </label>
                {type === 'MODEL' && (
                    <label className="checkbox">
                        <input
                            type="checkbox"
                            checked={hasAnimation}
                            disabled={busy}
                            onChange={(event) => {
                                setHasAnimation(event.currentTarget.checked);
                                setPage(1);
                            }}
                        />
                        <Play size={16} />
                        Có animation
                    </label>
                )}
                <Link
                    className="library-upload"
                    to="/assets/upload"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <Upload size={18} />
                    Tải tài nguyên lên
                </Link>
                <Button
                    variant="ghost"
                    aria-label="Làm mới thư viện"
                    disabled={busy || list.isFetching}
                    onClick={() => void list.refetch()}
                >
                    <RefreshCw size={17} />
                </Button>
            </div>
            {categories.isError && (
                <p className="field-hint">
                    Chưa tải được danh mục. Bạn vẫn có thể tìm và chọn tài nguyên.
                </p>
            )}
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
                            <li key={asset.id} data-asset-id={asset.id}>
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
