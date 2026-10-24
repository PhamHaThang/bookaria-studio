import { useQuery } from '@tanstack/react-query';
import { FolderOpen, Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/shared/ui/primitives/empty';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { NativeSelect } from '@/shared/ui/primitives/native-select';
import {
    AssetThumbnail,
    assetKeys,
    assetStatusLabels,
    assetsApi,
    assetTypeLabels,
    readAssetSearch,
    updateAssetSearch,
} from '../features/assets';
import { useAuth } from '../features/auth';
import { errorMessage } from '../shared/api/errors';
import type { ListAssetsQuery } from '../shared/contracts/api/assets.schema';
import type { AssetCategory } from '../shared/contracts/dto.schema';
import { formatBytes } from '../shared/lib/format';
import { Badge } from '../shared/ui/Badge';
import { Button, buttonStyles } from '../shared/ui/Button';
import { Feedback } from '../shared/ui/Feedback';

function AssetFilters({
    query,
    categories,
    change,
    filtered,
}: {
    query: ListAssetsQuery;
    categories?: AssetCategory[];
    change: (changes: Record<string, string | undefined>) => void;
    filtered: boolean;
}) {
    const [categoryId, setCategoryId] = useState(query.categoryId || '');
    return (
        <form
            className="asset-filters mb-8 grid grid-cols-[minmax(220px,_2fr)_minmax(140px,_1fr)_minmax(140px,_1fr)_minmax(_130px,_1fr_)] gap-4 max-[1100px]:grid-cols-[repeat(2,_minmax(0,_1fr))] max-[540px]:grid-cols-[minmax(0,_1fr)] [&_label]:m-0"
            onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                change({
                    q: String(form.get('q') || '').trim(),
                    type: String(form.get('type') || ''),
                    categoryId: String(form.get('categoryId') || ''),
                    tag: String(form.get('tag') || '').trim(),
                    hasAnimation: form.get('hasAnimation') === 'on' ? 'true' : undefined,
                });
            }}
        >
            <FieldGroup className="contents">
                <Field orientation="contents">
                    <FieldLabel className="asset-search-label" htmlFor="asset-search">
                        Tìm tài nguyên
                        <span className="search-field flex flex-[1] items-center gap-3 rounded-[var(--radius-md)] border border-input border-solid bg-surface px-3 py-0 max-[760px]:col-[1_/_-1] [&_input:not([type=checkbox])]:m-0 [&_input:not([type=checkbox])]:min-w-0 [&_input:not([type=checkbox])]:border-0 [&_input:not([type=checkbox])]:border-[transparent] [&_input:not([type=checkbox])]:border-solid [&_input:not([type=checkbox])]:bg-[transparent] [&_input:not([type=checkbox])]:px-0 [&_input:not([type=checkbox])]:py-3 [&_svg]:shrink-0 [&_svg]:text-muted-foreground [.asset-filters_&]:mt-2 [.asset-filters_&_input:not([type=checkbox])]:min-h-[calc(var(--control-height)_-_2_*_var(--border-width))] [.asset-filters_&_input:not([type=checkbox])]:py-2 [.books-toolbar_&]:border-0 [.books-toolbar_&]:border-[transparent] [.books-toolbar_&]:border-solid">
                            <Search size={18} aria-hidden="true" />
                            <Input
                                id="asset-search"
                                name="q"
                                type="search"
                                defaultValue={query.q || ''}
                                maxLength={100}
                                placeholder="Tìm theo tên tài nguyên"
                            />
                        </span>
                    </FieldLabel>
                </Field>
                <div>
                    <Field orientation="contents">
                        <FieldLabel htmlFor="asset-type">Loại tài nguyên</FieldLabel>
                    </Field>
                    <NativeSelect id="asset-type" name="type" defaultValue={query.type || ''}>
                        <option value="">Tất cả loại</option>
                        {Object.entries(assetTypeLabels).map(([value, label]) => (
                            <option value={value} key={value}>
                                {label}
                            </option>
                        ))}
                    </NativeSelect>
                </div>
                <div>
                    <Field orientation="contents">
                        <FieldLabel htmlFor="asset-category">Danh mục</FieldLabel>
                    </Field>
                    <NativeSelect
                        id="asset-category"
                        name="categoryId"
                        value={categoryId}
                        onChange={(event) => setCategoryId(event.target.value)}
                    >
                        <option value="">Tất cả danh mục</option>
                        {categoryId &&
                            !categories?.some((category) => category.id === categoryId) && (
                                <option value={categoryId}>Danh mục đang chọn</option>
                            )}
                        {categories?.map((category) => (
                            <option value={category.id} key={category.id}>
                                {category.name}
                            </option>
                        ))}
                    </NativeSelect>
                </div>
                <Field orientation="contents">
                    <FieldLabel htmlFor="asset-tag">
                        Nhãn
                        <Input
                            id="asset-tag"
                            name="tag"
                            defaultValue={query.tag || ''}
                            maxLength={30}
                            placeholder="Ví dụ: động vật"
                        />
                    </FieldLabel>
                </Field>
                <div className="asset-filter-actions col-[1_/_-1] flex flex-wrap items-center gap-4">
                    <Field orientation="contents">
                        <FieldLabel className="checkbox m-0 flex items-center gap-2 font-normal [.asset-filter-actions_&]:mr-auto [.scene-inspector_>_&]:my-3 [.scene-object-fields_label:not(&)]:grid [.scene-object-fields_label:not(&)]:gap-2 [.scene-object-fields_label:not(&)]:font-medium [.scene-settings-fields_label:not(&)]:grid [.scene-settings-fields_label:not(&)]:gap-2 [.scene-settings-fields_label:not(&)]:font-medium">
                            <input
                                type="checkbox"
                                name="hasAnimation"
                                defaultChecked={query.hasAnimation === true}
                            />
                            Có hoạt ảnh
                        </FieldLabel>
                    </Field>
                    <Button type="submit">Tìm tài nguyên</Button>
                    {filtered && (
                        <Button
                            variant="ghost"
                            onClick={() =>
                                change({
                                    q: undefined,
                                    type: undefined,
                                    categoryId: undefined,
                                    tag: undefined,
                                    hasAnimation: undefined,
                                })
                            }
                        >
                            Xóa bộ lọc
                        </Button>
                    )}
                </div>
            </FieldGroup>
        </form>
    );
}

export function AssetsPage() {
    const { user } = useAuth();
    const [params, setParams] = useSearchParams();
    const query = readAssetSearch(params);
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
        enabled: Boolean(user),
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
    function change(changes: Record<string, string | undefined>) {
        setParams((current) => updateAssetSearch(current, changes));
    }
    const filtered = Boolean(
        query.q || query.tag || query.type || query.categoryId || query.hasAnimation !== undefined,
    );
    return (
        <>
            <div className="page-heading [&_h1]:wrap-anywhere mx-0 mt-0 mb-7 flex items-center justify-between gap-6 max-[760px]:mb-6 max-[700px]:flex-wrap max-[700px]:items-start max-[760px]:items-start max-[700px]:gap-3 max-[760px]:gap-4 max-[700px]:[&_>_.button]:max-w-full max-[700px]:[&_>_.button]:flex-[0_0_auto] [&_>_div]:min-w-0 max-[700px]:[&_>_div]:flex-[1_1_180px] [&_h1]:font-semibold [&_h1]:text-[length:28px] [&_h1]:tracking-[-0.025em] max-[700px]:[&_h1]:text-[length:25px] max-[760px]:[&_h1]:text-[length:var(--text-2xl)] [&_p]:mx-0 [&_p]:mt-2 [&_p]:mb-0 [&_p]:max-w-[64ch] [&_p]:text-[length:13px] [&_p]:text-muted-foreground max-[760px]:[&_p]:text-[length:var(--text-sm)] [.page-editor-screen[data-mode=content]_>_&]:hidden [.studio-editing_&]:mb-2 [.studio-editing_&_h1]:ml-4 [.studio-editing_&_h1]:inline [.studio-editing_&_h1]:text-[length:21px] max-[700px]:[.studio-editing_&_h1]:mx-0 max-[700px]:[.studio-editing_&_h1]:mt-[6px] max-[700px]:[.studio-editing_&_h1]:mb-0 max-[700px]:[.studio-editing_&_h1]:block [.studio-editing_&_p]:ml-[14px] [.studio-editing_&_p]:inline [.studio-editing_&_p]:text-[length:11px] max-[700px]:[.studio-editing_&_p]:mx-0 max-[700px]:[.studio-editing_&_p]:my-1 max-[700px]:[.studio-editing_&_p]:block [:where(.studio-main_>_&)]:mx-auto [:where(.studio-main_>_&)]:max-w-375">
                <div>
                    <h1>Tài nguyên</h1>
                    <p>Quản lý hình ảnh, mô hình 3D, âm thanh và video của bạn.</p>
                </div>
                <Link to="/assets/upload" className={buttonStyles()}>
                    <Plus size={18} aria-hidden="true" />
                    Tải tài nguyên
                </Link>
            </div>
            <fieldset
                className={
                    'status-tabs mx-0 mt-0 mb-6 flex gap-7 border-b-[1px] border-b-border [border-bottom-style:solid] max-[760px]:gap-5 max-[760px]:overflow-x-auto max-[760px]:text-[length:var(--text-xs)] [&_button.selected]:border-b-primary [&_button.selected]:font-semibold [&_button.selected]:text-primary-hover [&_button]:min-h-11 [&_button]:whitespace-nowrap [&_button]:border-[transparent] [&_button]:border-t-[0] [&_button]:border-r-[0] [&_button]:border-b-[2px] [&_button]:border-l-[0] [&_button]:border-solid [&_button]:bg-[transparent] [&_button]:px-0 [&_button]:py-3 [&_button]:text-[length:12px] [&_button]:text-muted-foreground max-[540px]:[.page-heading:has(+_&[aria-label="Nguồn_tài_nguyên"])]:flex-wrap [:where(.studio-main_>_&)]:mx-auto [:where(.studio-main_>_&)]:max-w-375'
                }
                aria-label="Nguồn tài nguyên"
            >
                <button
                    type="button"
                    className={query.scope === 'mine' ? 'selected' : ''}
                    aria-pressed={query.scope === 'mine'}
                    onClick={() => change({ scope: undefined })}
                >
                    Của tôi
                </button>
                <button
                    type="button"
                    className={query.scope === 'library' ? 'selected' : ''}
                    aria-pressed={query.scope === 'library'}
                    onClick={() => change({ scope: 'library' })}
                >
                    Thư viện chung
                </button>
            </fieldset>
            {query.scope === 'library' && (
                <p className="asset-scope-note mx-0 mt-0 mb-6 max-w-[70ch] text-muted-foreground">
                    Tài nguyên dùng chung do nhóm quản trị cung cấp. Bạn có thể xem thông tin và
                    nguồn sử dụng tại đây.
                </p>
            )}
            <AssetFilters
                key={params.toString()}
                query={query}
                categories={categories.data}
                change={change}
                filtered={filtered}
            />
            {categories.isError && (
                <div className="asset-category-error mb-6 flex flex-wrap items-start gap-3 [&_.feedback]:m-0">
                    <Feedback error="Chưa tải được danh mục. Bạn vẫn có thể tìm tài nguyên." />
                    <Button
                        variant="ghost"
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
                <p className="list-state px-0 py-12" role="status">
                    Đang tải tài nguyên…
                </p>
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
                        {listing.isFetching ? ' · Đang cập nhật…' : ''}
                    </p>
                    {listing.data.data.length === 0 ? (
                        <Empty className="empty-state border-border border-t px-5 py-16 max-[760px]:px-3 max-[760px]:py-12">
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
                                    <Button
                                        variant="secondary"
                                        onClick={() =>
                                            change({
                                                q: undefined,
                                                type: undefined,
                                                categoryId: undefined,
                                                tag: undefined,
                                                hasAnimation: undefined,
                                            })
                                        }
                                    >
                                        Xóa bộ lọc
                                    </Button>
                                ) : (
                                    query.scope === 'mine' && (
                                        <Link className={buttonStyles()} to="/assets/upload">
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
                                            <Link to={`/assets/${asset.id}`}>{asset.name}</Link>
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
                        <nav
                            className="pagination mt-8 flex items-center justify-end gap-5 text-[length:var(--text-sm)] tabular-nums max-[760px]:justify-between max-[760px]:gap-2 max-[760px]:text-[length:var(--text-xs)] max-[760px]:[&_.button]:p-3 max-[760px]:[&_.button]:text-[length:var(--text-xs)]"
                            aria-label="Phân trang tài nguyên"
                        >
                            <Button
                                variant="secondary"
                                disabled={query.page <= 1 || listing.isFetching}
                                onClick={() => change({ page: String(query.page - 1) })}
                            >
                                Trang trước
                            </Button>
                            <span>
                                Trang {query.page} / {meta.totalPages}
                            </span>
                            <Button
                                variant="secondary"
                                disabled={query.page >= meta.totalPages || listing.isFetching}
                                onClick={() => change({ page: String(query.page + 1) })}
                            >
                                Trang sau
                            </Button>
                        </nav>
                    )}
                </>
            )}
        </>
    );
}
