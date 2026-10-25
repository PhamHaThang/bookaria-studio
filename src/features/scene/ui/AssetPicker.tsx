import { useQuery } from '@tanstack/react-query';
import { Play, RefreshCw, Search, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FormSelect } from '@/shared/ui/FormSelect';
import { LoadingState } from '@/shared/ui/LoadingState';
import { Button as ActionButton } from '@/shared/ui/primitives/button';
import { Checkbox } from '@/shared/ui/primitives/checkbox';
import { Field, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
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
            className="scene-asset-picker w-[min(1160px,_calc(100vw_-_48px))] max-w-290 rounded-[20px] [&_[data-slot=select-trigger]]:m-0 [&_input]:m-0 [&_label]:m-0 [.confirm-dialog&[data-state=open]]:flex [.confirm-dialog&[data-state=open]]:max-h-[calc(100dvh_-_32px)] [.confirm-dialog&[data-state=open]]:w-[min(1160px,_calc(100vw_-_48px))] [.confirm-dialog&[data-state=open]]:max-w-290 [.confirm-dialog&[data-state=open]]:flex-col [.confirm-dialog&[data-state=open]]:overflow-hidden max-[760px]:[.confirm-dialog&[data-state=open]]:w-[calc(100vw_-_20px)] max-[760px]:[.confirm-dialog&[data-state=open]]:max-w-[calc(100vw_-_20px)] [.confirm-dialog&]:min-h-140 [.confirm-dialog&]:w-[min(1160px,_calc(100vw_-_48px))] [.confirm-dialog&]:max-w-290 [.confirm-dialog&]:rounded-[20px] [.confirm-dialog&]:p-[26px] max-[760px]:[.confirm-dialog&]:w-[calc(100vw_-_20px)] max-[600px]:[.confirm-dialog&]:p-5 max-[760px]:[.confirm-dialog&]:p-[18px]"
            title={`Chọn ${assetTypeLabels[type].charAt(0).toLowerCase()}${assetTypeLabels[type].slice(1)}`}
            busy={busy}
            onClose={onClose}
        >
            <Feedback error={error} />
            <div className="library-tools flex items-center justify-between gap-6 border-b-[1px] border-b-border px-0 pt-3 pb-5 [border-bottom-style:solid] max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-[14px]">
                <fieldset
                    className="library-sources flex gap-2 max-[760px]:justify-center max-[760px]:gap-0 [&_button[aria-pressed=true]]:bg-primary [&_button[aria-pressed=true]]:text-primary-foreground [&_button]:rounded-[10px] [&_button]:border-0 [&_button]:border-[transparent] [&_button]:border-solid [&_button]:bg-[transparent] [&_button]:px-4 [&_button]:py-3 [&_button]:text-[length:13px] [&_button]:text-muted-foreground max-[760px]:[&_button]:p-[10px] max-[760px]:[&_button]:text-[length:12px]"
                    aria-label="Nguồn tài nguyên"
                    disabled={busy}
                >
                    {(
                        [
                            ['library', 'Thư viện chung'],
                            ['mine', 'Tài nguyên của tôi'],
                        ] as const
                    ).map(([value, label]) => (
                        <ActionButton
                            variant="plain"
                            type="button"
                            key={value}
                            aria-pressed={scope === value}
                            onClick={() => {
                                setScope(value);
                                setPage(1);
                            }}
                        >
                            {label}
                        </ActionButton>
                    ))}
                </fieldset>
                <Field orientation="contents">
                    <FieldLabel className="library-search m-0 flex items-center gap-2 rounded-[10px] bg-muted px-3 py-0 [&_input]:m-0 [&_input]:border-0 [&_input]:border-[transparent] [&_input]:border-solid [&_input]:bg-[transparent] [&_input]:text-[length:13px]">
                        <Search size={17} />
                        <span className="sr-only [.editor-page-strip_a.strip-add-page_>_span:not(&)]:[position:static] [.editor-page-strip_a_>_span:not(&)]:absolute [.editor-page-strip_a_>_span:not(&)]:right-[-1px] [.editor-page-strip_a_>_span:not(&)]:bottom-[-1px] [.editor-page-strip_a_>_span:not(&)]:rounded-[3px] [.editor-page-strip_a_>_span:not(&)]:bg-surface [.editor-page-strip_a_>_span:not(&)]:px-[5px] [.editor-page-strip_a_>_span:not(&)]:py-0 [.editor-page-strip_a_>_span:not(&)]:text-[length:10px] [.editor-page-strip_a_>_span:not(&)]:text-foreground">
                            Tìm tài nguyên
                        </span>
                        <Input
                            type="search"
                            placeholder="Tìm tài nguyên…"
                            value={search}
                            maxLength={100}
                            disabled={busy}
                            onChange={(event) => setSearch(event.currentTarget.value)}
                        />
                    </FieldLabel>
                </Field>
            </div>
            <div className="library-options flex flex-wrap items-center gap-4 px-0 py-5 max-[760px]:gap-3 [&_[data-slot=select-trigger]]:min-h-9 [&_[data-slot=select-trigger]]:text-[length:12px] [&_label]:m-0 [&_label]:text-[length:12px]">
                <Field orientation="contents">
                    <FieldLabel>
                        Danh mục
                        <FormSelect
                            value={categoryId}
                            disabled={busy}
                            onValueChange={(value) => {
                                setCategoryId(value);
                                setPage(1);
                            }}
                            options={[
                                { value: '', label: 'Tất cả danh mục' },
                                ...(categories.data?.map((category) => ({
                                    value: category.id,
                                    label: category.name,
                                })) ?? []),
                            ]}
                        />
                    </FieldLabel>
                </Field>
                {type === 'MODEL' && (
                    <Field orientation="contents">
                        <FieldLabel className="checkbox m-0 flex items-center gap-2 font-normal [.asset-filter-actions_&]:mr-auto [.scene-inspector_>_&]:my-3 [.scene-object-fields_label:not(&)]:grid [.scene-object-fields_label:not(&)]:gap-2 [.scene-object-fields_label:not(&)]:font-medium [.scene-settings-fields_label:not(&)]:grid [.scene-settings-fields_label:not(&)]:gap-2 [.scene-settings-fields_label:not(&)]:font-medium">
                            <Checkbox
                                checked={hasAnimation}
                                disabled={busy}
                                onCheckedChange={(checked) => {
                                    setHasAnimation(checked === true);
                                    setPage(1);
                                }}
                            />
                            <Play size={16} />
                            Có animation
                        </FieldLabel>
                    </Field>
                )}
                <Link
                    className="library-upload ml-auto flex items-center gap-[9px] rounded-[12px] border border-primary border-solid px-[18px] py-[14px] text-[length:13px] no-underline max-[760px]:ml-0 max-[760px]:p-[10px] max-[760px]:text-[length:12px]"
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
                    <RefreshCw data-icon="inline-start" />
                </Button>
            </div>
            {categories.isError && (
                <p className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]">
                    Chưa tải được danh mục. Bạn vẫn có thể tìm và chọn tài nguyên.
                </p>
            )}
            {list.isPending && (
                <LoadingState layout="asset-picker">Đang tải tài nguyên…</LoadingState>
            )}
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
                    <ul className="scene-picker-list [&_li_>_div]:wrap-anywhere mx-0 my-4 max-h-[45vh] list-none overflow-auto p-0 [&_.button]:shrink-0 [&_li]:flex [&_li]:items-center [&_li]:gap-3 [&_li]:border-b-[1px] [&_li]:border-b-border [&_li]:px-0 [&_li]:py-3 [&_li]:[border-bottom-style:solid] [&_li_>_div]:min-w-0 [&_li_>_div]:flex-[1] [&_p]:mx-0 [&_p]:mt-1 [&_p]:mb-0 [&_p]:text-[length:var(--text-sm)] [&_p]:text-muted-foreground [.scene-asset-picker_&]:mx-0 [.scene-asset-picker_&]:my-3 [.scene-asset-picker_&]:grid [.scene-asset-picker_&]:max-h-none [.scene-asset-picker_&]:min-h-20 [.scene-asset-picker_&]:flex-[1_1_auto] [.scene-asset-picker_&]:grid-cols-[repeat(4,_minmax(0,_1fr))] [.scene-asset-picker_&]:gap-[22px] [.scene-asset-picker_&]:px-0 [.scene-asset-picker_&]:py-[18px] max-[760px]:[.scene-asset-picker_&]:grid-cols-[repeat(2,_minmax(0,_1fr))] max-[760px]:[.scene-asset-picker_&]:gap-4 [.scene-asset-picker_&_>_li]:relative [.scene-asset-picker_&_>_li]:flex [.scene-asset-picker_&_>_li]:min-w-0 [.scene-asset-picker_&_>_li]:flex-col [.scene-asset-picker_&_>_li]:items-stretch [.scene-asset-picker_&_>_li]:gap-2 [.scene-asset-picker_&_>_li]:border-0 [.scene-asset-picker_&_>_li]:border-[transparent] [.scene-asset-picker_&_>_li]:border-solid [.scene-asset-picker_&_>_li]:px-0 [.scene-asset-picker_&_>_li]:pt-0 [.scene-asset-picker_&_>_li]:pb-[46px] [.scene-asset-picker_&_>_li_.button]:absolute [.scene-asset-picker_&_>_li_.button]:bottom-0 [.scene-asset-picker_&_>_li_.button]:min-h-[34px] [.scene-asset-picker_&_>_li_.button]:w-full [.scene-asset-picker_&_>_li_.button]:text-[length:12px] [.scene-asset-picker_&_p]:mx-0 [.scene-asset-picker_&_p]:my-1 [.scene-asset-picker_&_p]:text-[length:11px] [.scene-asset-picker_&_strong]:text-[length:12px] [.scene-asset-picker_>_:not(&)]:shrink-0">
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
                    <div className="form-actions scene-picker-pagination mt-3 flex flex-wrap items-center gap-5 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-4 max-[760px]:[&_>_a]:text-center [&_span]:text-center [&_span]:text-[length:var(--text-sm)] [.confirm-dialog_&]:mt-6 [.confirm-dialog_&]:justify-end max-[760px]:[.confirm-dialog_&]:flex-row max-[760px]:[.confirm-dialog_&]:flex-wrap [.image-editor_&:empty]:hidden [.scene-asset-picker_&]:mb-3 [.scene-asset-picker_&]:grid [.scene-asset-picker_&]:grid-cols-[auto_minmax(0,_1fr)_auto] [.scene-asset-picker_&]:items-center [.scene-asset-picker_&]:gap-2 [.scene-object-asset_&]:gap-2">
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
            <div className="form-actions mt-3 flex flex-wrap items-center gap-5 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-4 max-[760px]:[&_>_a]:text-center [.confirm-dialog_&]:mt-6 [.confirm-dialog_&]:justify-end max-[760px]:[.confirm-dialog_&]:flex-row max-[760px]:[.confirm-dialog_&]:flex-wrap [.image-editor_&:empty]:hidden [.scene-object-asset_&]:gap-2">
                <Button variant="ghost" disabled={busy} onClick={onClose}>
                    Đóng chọn tài nguyên
                </Button>
            </div>
        </ConfirmDialog>
    );
}
