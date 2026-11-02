import { useQuery } from '@tanstack/react-query';
import { FolderOpen, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, type NavigateOptions, useSearchParams } from 'react-router-dom';
import {
    AssetThumbnail,
    assetKeys,
    assetStatusLabels,
    assetsApi,
    assetTypeLabels,
    readAssetSearch,
    updateAssetSearch,
} from '@/features/assets';
import { AssetTypeTabs } from '@/features/assets/ui/AssetTypeTabs';
import { LibraryAssetPreview } from '@/features/assets/ui/LibraryAssetPreview';
import { useAuth } from '@/features/auth';
import { errorMessage } from '@/shared/api/errors';
import type { ListAssetsQuery } from '@/shared/contracts/api/assets.schema';
import type { Asset, AssetCategory } from '@/shared/contracts/dto.schema';
import { formatBytes } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button, buttonStyles } from '@/shared/ui/Button';
import { Feedback } from '@/shared/ui/Feedback';
import { FormSelect } from '@/shared/ui/FormSelect';
import { SearchFilter } from '@/shared/ui/LiveFilters';
import { LoadingState } from '@/shared/ui/LoadingState';
import { Pagination } from '@/shared/ui/Pagination';
import { Checkbox } from '@/shared/ui/primitives/checkbox';
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/shared/ui/primitives/empty';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';

function AssetFilters({
    query,
    categories,
    change,
    filtered,
    loading,
    clearFilters,
}: {
    query: ListAssetsQuery;
    categories?: AssetCategory[];
    change: (changes: Record<string, string | undefined>, options?: NavigateOptions) => void;
    filtered: boolean;
    loading: boolean;
    clearFilters: () => void;
}) {
    const library = query.scope === 'library';
    const categoryId = query.categoryId || '';
    function apply(changes: Record<string, string | undefined>) {
        change(changes);
    }
    return (
        <form
            aria-label="Bộ lọc tài nguyên"
            className="asset-filters mb-6 flex flex-wrap items-center gap-3 [&_[data-slot=field-label]]:m-0 [&_[data-slot=input]]:m-0 [&_[data-slot=select-trigger]]:m-0"
            onSubmit={(event) => event.preventDefault()}
        >
            <FieldGroup className="contents">
                <Field className="min-w-60 flex-1">
                    <FieldLabel htmlFor="asset-search" className="sr-only">
                        Tìm tài nguyên
                    </FieldLabel>
                    <SearchFilter
                        id="asset-search"
                        name="q"
                        value={query.q || ''}
                        loading={loading}
                        maxLength={100}
                        placeholder="Tìm theo tên tài nguyên"
                    />
                </Field>
                {library && (
                    <Field className="w-48 shrink-0">
                        <FieldLabel htmlFor="asset-category" className="sr-only">
                            Danh mục
                        </FieldLabel>
                        <FormSelect
                            id="asset-category"
                            name="categoryId"
                            value={categoryId}
                            onValueChange={(value) => apply({ categoryId: value })}
                            options={[
                                { value: '', label: 'Tất cả danh mục' },
                                ...(categoryId &&
                                !categories?.some((category) => category.id === categoryId)
                                    ? [{ value: categoryId, label: 'Danh mục đang chọn' }]
                                    : []),
                                ...(categories?.map((category) => ({
                                    value: category.id,
                                    label: category.name,
                                })) ?? []),
                            ]}
                        />
                    </Field>
                )}
                {query.type === 'MODEL' && (
                    <Field orientation="horizontal" className="w-auto shrink-0 gap-2">
                        <Checkbox
                            id="asset-has-animation"
                            name="hasAnimation"
                            checked={query.hasAnimation === true}
                            onCheckedChange={(checked) =>
                                apply({ hasAnimation: checked === true ? 'true' : undefined })
                            }
                        />
                        <FieldLabel htmlFor="asset-has-animation" className="whitespace-nowrap">
                            Có hoạt ảnh
                        </FieldLabel>
                    </Field>
                )}
                {filtered && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-[var(--control-height)]"
                        aria-label="Xóa bộ lọc"
                        title="Xóa bộ lọc"
                        onClick={clearFilters}
                    >
                        <RotateCcw aria-hidden="true" />
                    </Button>
                )}
            </FieldGroup>
        </form>
    );
}

export function AssetCatalog({ scope }: { scope: 'mine' | 'library' }) {
    const { user } = useAuth();
    const [params, setParams] = useSearchParams();
    const scoped = new URLSearchParams(params);
    scoped.set('scope', scope);
    const query = readAssetSearch(scoped);
    const [preview, setPreview] = useState<Asset | null>(null);
    const listing = useQuery({
        queryKey: assetKeys.list(user?.id || '', query),
        queryFn: ({ signal }) => assetsApi.list(query, signal),
        enabled: Boolean(user),
        refetchInterval: (state) =>
            !state.state.error &&
            state.state.data?.data.some((asset) => asset.status === 'PROCESSING')
                ? 3000
                : false,
    });
    const categories = useQuery({
        queryKey: assetKeys.categories(user?.id || ''),
        queryFn: ({ signal }) => assetsApi.categories(signal),
        enabled: Boolean(user) && query.scope === 'library',
    });
    const meta = listing.data?.meta;
    useEffect(() => {
        if (!listing.isFetching && meta && query.page > Math.max(1, meta.totalPages)) {
            setParams(
                (current) =>
                    updateAssetSearch(current, { page: String(Math.max(1, meta.totalPages)) }),
                { replace: true },
            );
        }
    }, [listing.isFetching, meta, query.page, setParams]);
    const change = useCallback(
        (changes: Record<string, string | undefined>, options?: NavigateOptions) => {
            setParams((current) => updateAssetSearch(current, changes), options);
        },
        [setParams],
    );
    const filtered = Boolean(query.q || query.categoryId || query.hasAnimation !== undefined);
    function clearFilters() {
        change(
            { q: undefined, categoryId: undefined, hasAnimation: undefined },
            { state: { resetFilters: true } },
        );
    }
    return (
        <>
            <AssetTypeTabs
                value={query.type}
                onValueChange={(type) => change({ type })}
                variant={scope === 'mine' ? 'line' : 'default'}
            >
                <AssetFilters
                    key={query.scope}
                    query={query}
                    categories={categories.data}
                    change={change}
                    filtered={filtered}
                    loading={listing.isFetching}
                    clearFilters={clearFilters}
                />
                {query.scope === 'library' && categories.isError && (
                    <div className="asset-category-error mb-6 flex flex-wrap items-start gap-3 [&_.feedback]:m-0">
                        <Feedback error="Chưa tải được danh mục. Bạn vẫn có thể tìm tài nguyên." />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                void categories.refetch();
                            }}
                        >
                            Tải lại danh mục
                        </Button>
                    </div>
                )}
                {listing.isPending ? (
                    <LoadingState layout="assets">Đang tải tài nguyên…</LoadingState>
                ) : listing.isError ? (
                    <div className="list-state px-0 py-12">
                        <Feedback error={errorMessage(listing.error)} />
                        <Button
                            onClick={() => {
                                void listing.refetch();
                            }}
                        >
                            Thử tải lại
                        </Button>
                    </div>
                ) : (
                    <>
                        <p
                            className="mx-0 mt-0 mb-3 flex list-summary justify-between gap-4 text-[length:12px] text-muted-foreground [:where(.studio-main_>_&)]:mx-auto [:where(.studio-main_>_&)]:max-w-375"
                            role="status"
                        >
                            {meta?.total} tài nguyên{query.q ? ` khớp “${query.q}”` : ''}
                            {listing.isFetching ? ' — Đang cập nhật…' : ''}
                        </p>
                        {listing.data.data.length === 0 ? (
                            <Empty className="empty-state px-5 py-16 max-[760px]:px-3 max-[760px]:py-12">
                                <EmptyHeader>
                                    <EmptyMedia>
                                        <FolderOpen size={38} aria-hidden="true" />
                                    </EmptyMedia>
                                    <EmptyTitle>
                                        <h2>
                                            {filtered
                                                ? 'Không tìm thấy tài nguyên phù hợp'
                                                : query.scope === 'library'
                                                  ? 'Thư viện chung chưa có tài nguyên'
                                                  : 'Chưa có tài nguyên'}
                                        </h2>
                                    </EmptyTitle>
                                    <EmptyDescription>
                                        <p>
                                            {filtered
                                                ? 'Thử từ khóa khác hoặc xóa bộ lọc.'
                                                : query.scope === 'library'
                                                  ? 'Các tài nguyên được chia sẻ sẽ xuất hiện ở đây.'
                                                  : 'Tải tệp đầu tiên để chuẩn bị cho nội dung sách của bạn.'}
                                        </p>
                                    </EmptyDescription>
                                </EmptyHeader>
                                <EmptyContent>
                                    {filtered ? (
                                        <Button variant="secondary" onClick={clearFilters}>
                                            Xóa bộ lọc
                                        </Button>
                                    ) : (
                                        query.scope === 'mine' && (
                                            <Link
                                                className={buttonStyles()}
                                                to={{
                                                    pathname: '/assets/upload',
                                                    search: params.toString(),
                                                }}
                                            >
                                                Tải tài nguyên đầu tiên
                                            </Link>
                                        )
                                    )}
                                </EmptyContent>
                            </Empty>
                        ) : (
                            <ul className="asset-list m-0 list-none border-t-[1px] border-t-border p-0 [border-top-style:solid]">
                                {listing.data.data.map((asset) => (
                                    <li
                                        key={asset.id}
                                        className="asset-row grid grid-cols-[64px_minmax(0,_1fr)_auto] items-center gap-5 border-b-[1px] border-b-border px-0 py-5 [border-bottom-style:solid] max-[540px]:grid-cols-[48px_minmax(0,_1fr)] max-[540px]:gap-[var(--space-2)_var(--space-4)] [&:hover]:bg-muted max-[540px]:[&_>_.badge]:col-[2]"
                                    >
                                        <AssetThumbnail asset={asset} />
                                        <div className="asset-row-info [&_h2]:wrap-anywhere min-w-0 [&_h2]:mx-0 [&_h2]:mt-0 [&_h2]:mb-1 [&_h2]:text-[length:var(--text-md)] max-[540px]:[&_h2]:text-[length:var(--text-sm)] [&_h2_a:hover]:text-primary [&_h2_a:hover]:underline [&_h2_a]:text-[inherit] [&_h2_a]:no-underline [&_p]:m-0 [&_p]:text-[length:var(--text-xs)] [&_p]:text-muted-foreground">
                                            <h2>
                                                {scope === 'library' ? (
                                                    <button
                                                        type="button"
                                                        className="text-left underline-offset-4 hover:underline"
                                                        onClick={() => setPreview(asset)}
                                                    >
                                                        {asset.name}
                                                    </button>
                                                ) : (
                                                    <Link to={`/assets/${asset.id}`}>
                                                        {asset.name}
                                                    </Link>
                                                )}
                                            </h2>
                                            <p>
                                                {assetTypeLabels[asset.type]} ·{' '}
                                                {formatBytes(asset.sizeBytes)}
                                                {asset.meta.animations?.length
                                                    ? ` · ${asset.meta.animations.length} hoạt ảnh`
                                                    : ''}
                                            </p>
                                            {asset.tags.length > 0 && (
                                                <p className="asset-tag-list wrap-anywhere flex flex-wrap gap-2">
                                                    {asset.tags.slice(0, 4).map((tag) => (
                                                        <span key={tag}>#{tag}</span>
                                                    ))}
                                                </p>
                                            )}
                                        </div>
                                        <Badge
                                            tone={
                                                asset.status === 'READY'
                                                    ? 'success'
                                                    : asset.status === 'FAILED'
                                                      ? 'danger'
                                                      : 'warning'
                                            }
                                        >
                                            {assetStatusLabels[asset.status]}
                                        </Badge>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {meta && meta.totalPages > 1 && (
                            <Pagination
                                page={query.page}
                                totalPages={meta.totalPages}
                                busy={listing.isFetching}
                                label="Phân trang tài nguyên"
                                onPage={(page) => change({ page: String(page) })}
                            />
                        )}
                    </>
                )}
            </AssetTypeTabs>
            {preview && <LibraryAssetPreview asset={preview} onClose={() => setPreview(null)} />}
        </>
    );
}
