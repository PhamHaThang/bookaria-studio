import { useQuery } from '@tanstack/react-query';
import { FolderOpen, RotateCcw, SearchX } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, type NavigateOptions, useSearchParams } from 'react-router-dom';
import { assetKeys, assetsApi, readAssetSearch, updateAssetSearch } from '@/features/assets';
import { LibraryAssetPreview } from '@/features/assets/ui/LibraryAssetPreview';
import { useAuth } from '@/features/auth';
import { errorMessage } from '@/shared/api/errors';
import type { ListAssetsQuery } from '@/shared/contracts/api/assets.schema';
import type { Asset, AssetCategory } from '@/shared/contracts/dto.schema';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { Feedback } from '@/shared/ui/Feedback';
import { FilterBar } from '@/shared/ui/FilterBar';
import { FormSelect } from '@/shared/ui/FormSelect';
import { SearchFilter } from '@/shared/ui/LiveFilters';
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
import { AssetCardGrid, AssetCardGridSkeleton } from './AssetCardGrid';
import { PersonalAssetDialog } from './PersonalAssetDialog';

const assetTypes = [
    { value: 'IMAGE', label: 'Hình ảnh' },
    { value: 'AUDIO', label: 'Âm thanh' },
    { value: 'VIDEO', label: 'Video' },
    { value: 'MODEL', label: 'Mô hình 3D' },
];

function AssetFilters({
    query,
    categories,
    change,
    filtered,
    loading,
    clearFilters,
    searchInput,
}: {
    query: ListAssetsQuery;
    categories?: AssetCategory[];
    change: (changes: Record<string, string | undefined>, options?: NavigateOptions) => void;
    filtered: boolean;
    loading: boolean;
    clearFilters: () => void;
    searchInput: React.RefObject<HTMLInputElement | null>;
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
                <Field
                    className={
                        library
                            ? 'min-w-0 basis-full lg:w-auto lg:flex-1 lg:basis-0'
                            : 'min-w-48 flex-1'
                    }
                >
                    <FieldLabel htmlFor="asset-search" className="sr-only">
                        Tìm tài nguyên
                    </FieldLabel>
                    <SearchFilter
                        ref={searchInput}
                        id="asset-search"
                        name="q"
                        value={query.q || ''}
                        loading={loading}
                        maxLength={100}
                        placeholder="Tìm theo tên tài nguyên"
                    />
                </Field>
                {library && (
                    <Field className="min-w-0 flex-1 basis-32 lg:w-40 lg:flex-none">
                        <FieldLabel htmlFor="asset-type" className="sr-only">
                            Loại tài nguyên
                        </FieldLabel>
                        <FormSelect
                            id="asset-type"
                            value={query.type ?? ''}
                            onValueChange={(type) => apply({ type })}
                            options={[{ value: '', label: 'Tất cả loại' }, ...assetTypes]}
                        />
                    </Field>
                )}
                {library && (
                    <Field className="min-w-0 flex-1 basis-36 lg:w-48 lg:flex-none">
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
    const library = scope === 'library';
    const searchInput = useRef<HTMLInputElement>(null);
    const results = useRef<HTMLElement>(null);
    const [preview, setPreview] = useState<Asset | null>(null);
    const listing = useQuery({
        queryKey: assetKeys.list(user?.id || '', query),
        queryFn: ({ signal }) => assetsApi.list(query, signal),
        enabled: Boolean(user),
        placeholderData: library
            ? (previous, previousQuery) =>
                  previousQuery?.queryKey[1] === user?.id &&
                  (previousQuery?.queryKey[3] as ListAssetsQuery | undefined)?.type ===
                      query.type &&
                  previous?.data.length
                      ? previous
                      : undefined
            : undefined,
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
        if (
            !listing.isPlaceholderData &&
            !listing.isFetching &&
            meta &&
            query.page > Math.max(1, meta.totalPages)
        ) {
            setParams(
                (current) =>
                    updateAssetSearch(current, { page: String(Math.max(1, meta.totalPages)) }),
                { replace: true },
            );
        }
    }, [listing.isPlaceholderData, listing.isFetching, meta, query.page, setParams]);
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
            <AssetFilters
                key={query.scope}
                query={query}
                categories={categories.data}
                change={change}
                filtered={filtered}
                loading={listing.isFetching}
                clearFilters={clearFilters}
                searchInput={searchInput}
            />
            {!library && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <FilterBar
                        value={query.type || 'all'}
                        onValueChange={(type) =>
                            change({ type: type === 'all' ? undefined : type })
                        }
                        options={[{ value: 'all', label: 'Tất cả' }, ...assetTypes]}
                        label="Loại tài nguyên"
                        variant="pill"
                    />
                    <p
                        className="m-0 ml-auto text-right text-muted-foreground text-xs tabular-nums"
                        role="status"
                    >
                        {meta ? `${meta.total} tài nguyên` : listing.isPending ? 'Đang tải…' : null}
                    </p>
                </div>
            )}
            {query.scope === 'library' && categories.isError && (
                <div className="mb-6 flex flex-wrap items-start gap-3 [&_.feedback]:m-0">
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
                <AssetCardGridSkeleton scope={scope} />
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
                <section
                    ref={results}
                    tabIndex={library ? -1 : undefined}
                    aria-label={library ? 'Kết quả tài nguyên' : undefined}
                    className={library ? 'scroll-mt-24 outline-none' : undefined}
                >
                    {library && (
                        <p className="sr-only" role="status">
                            {listing.isFetching
                                ? 'Đang cập nhật…'
                                : `${meta?.total ?? 0} tài nguyên${query.q ? ` khớp “${query.q}”` : ''}`}
                        </p>
                    )}
                    {library && listing.data.data.length === 0 ? (
                        <Empty className="gap-5 px-4 py-9 sm:py-12">
                            <EmptyHeader className="gap-2">
                                <EmptyMedia
                                    variant="icon"
                                    className="mb-2 size-12 rounded-xl"
                                    aria-hidden="true"
                                >
                                    {filtered ? (
                                        <SearchX className="size-6" />
                                    ) : (
                                        <FolderOpen className="size-6" />
                                    )}
                                </EmptyMedia>
                                <EmptyTitle>
                                    <h2>
                                        {filtered
                                            ? 'Không tìm thấy tài nguyên phù hợp'
                                            : 'Chưa có tài nguyên ở đây'}
                                    </h2>
                                </EmptyTitle>
                                <EmptyDescription className="wrap-anywhere">
                                    {query.q ? (
                                        <>
                                            Không có kết quả cho <strong>“{query.q}”</strong>
                                            {query.categoryId || query.hasAnimation !== undefined
                                                ? ' với bộ lọc hiện tại.'
                                                : '.'}
                                        </>
                                    ) : filtered ? (
                                        'Thử bỏ bộ lọc để xem thêm tài nguyên.'
                                    ) : query.type ? (
                                        'Bạn có thể chọn loại tài nguyên khác hoặc xem tất cả.'
                                    ) : (
                                        'Tài nguyên dùng chung sẽ xuất hiện tại đây.'
                                    )}
                                </EmptyDescription>
                            </EmptyHeader>
                            {(filtered || query.type) && (
                                <EmptyContent className="flex-row flex-wrap justify-center">
                                    {query.q && (
                                        <Button
                                            variant="secondary"
                                            onClick={() => {
                                                searchInput.current?.focus();
                                                searchInput.current?.select();
                                            }}
                                        >
                                            Đổi từ khóa
                                        </Button>
                                    )}
                                    {(query.categoryId || query.hasAnimation !== undefined) && (
                                        <Button
                                            variant={query.q ? 'ghost' : 'secondary'}
                                            onClick={() => {
                                                change({
                                                    categoryId: undefined,
                                                    hasAnimation: undefined,
                                                });
                                                searchInput.current?.focus({
                                                    preventScroll: true,
                                                });
                                            }}
                                        >
                                            Bỏ bộ lọc
                                        </Button>
                                    )}
                                    {!filtered && query.type && (
                                        <Button
                                            variant="secondary"
                                            onClick={() => {
                                                change({ type: undefined });
                                                searchInput.current?.focus({
                                                    preventScroll: true,
                                                });
                                            }}
                                        >
                                            Xem tất cả tài nguyên
                                        </Button>
                                    )}
                                </EmptyContent>
                            )}
                        </Empty>
                    ) : library ? (
                        <div
                            className={cn(
                                !listing.isPlaceholderData &&
                                    'motion-safe:fade-in-60 motion-safe:animate-in motion-safe:duration-200',
                            )}
                        >
                            <AssetCardGrid
                                assets={listing.data.data}
                                busy={listing.isFetching}
                                onPreview={setPreview}
                            />
                        </div>
                    ) : listing.data.data.length === 0 ? (
                        <Empty className="empty-state px-5 py-16 max-[760px]:px-3 max-[760px]:py-12">
                            <EmptyHeader>
                                <EmptyMedia>
                                    <FolderOpen size={38} aria-hidden="true" />
                                </EmptyMedia>
                                <EmptyTitle>
                                    <h2>
                                        {filtered
                                            ? 'Không tìm thấy tài nguyên phù hợp'
                                            : query.type
                                              ? 'Chưa có tài nguyên thuộc loại này'
                                              : 'Chưa có tài nguyên'}
                                    </h2>
                                </EmptyTitle>
                                <EmptyDescription>
                                    <p>
                                        {filtered
                                            ? 'Thử từ khóa khác hoặc xóa bộ lọc.'
                                            : query.type
                                              ? 'Đổi loại tài nguyên hoặc tải thêm tệp.'
                                              : 'Tải tệp đầu tiên để chuẩn bị cho nội dung sách của bạn.'}
                                    </p>
                                </EmptyDescription>
                            </EmptyHeader>
                            <EmptyContent>
                                {filtered ? (
                                    <Button variant="secondary" onClick={clearFilters}>
                                        Xóa bộ lọc
                                    </Button>
                                ) : query.type ? (
                                    <Button
                                        variant="secondary"
                                        onClick={() => {
                                            change({ type: undefined });
                                            searchInput.current?.focus({ preventScroll: true });
                                        }}
                                    >
                                        Xem tất cả tài nguyên
                                    </Button>
                                ) : (
                                    <Button asChild>
                                        <Link
                                            to={{
                                                pathname: '/assets/upload',
                                                search: params.toString(),
                                            }}
                                            aria-haspopup="dialog"
                                        >
                                            Tải tài nguyên đầu tiên
                                        </Link>
                                    </Button>
                                )}
                            </EmptyContent>
                        </Empty>
                    ) : (
                        <AssetCardGrid
                            scope={scope}
                            assets={listing.data.data}
                            busy={listing.isFetching}
                            onPreview={setPreview}
                        />
                    )}
                    {meta && meta.totalPages > 1 && (
                        <Pagination
                            page={query.page}
                            totalPages={meta.totalPages}
                            busy={listing.isFetching}
                            label="Phân trang tài nguyên"
                            onPage={(page) => {
                                change(
                                    { page: String(page) },
                                    library ? { preventScrollReset: true } : undefined,
                                );
                                if (library) {
                                    results.current?.focus({ preventScroll: true });
                                    results.current?.scrollIntoView({ block: 'start' });
                                }
                            }}
                        />
                    )}
                </section>
            )}
            {preview &&
                (scope === 'mine' ? (
                    <PersonalAssetDialog asset={preview} onClose={() => setPreview(null)} />
                ) : (
                    <LibraryAssetPreview asset={preview} onClose={() => setPreview(null)} />
                ))}
        </>
    );
}
