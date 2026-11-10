import { useQuery } from '@tanstack/react-query';
import {
    Box,
    Calendar,
    ExternalLink,
    Eye,
    FileImage,
    FileText,
    Film,
    HardDrive,
    Music2,
    Pencil,
    Plus,
    Tag,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    adminDate,
    LibraryAssetCreateModal,
    LibraryAssetDeleteModal,
    LibraryAssetDetailModal,
    LibraryAssetEditModal,
    libraryKeys,
    readLibrarySearch,
} from '@/features/admin';
import { libraryApi } from '@/features/admin/library-ui';
import { AdminPager, AdminReload } from '@/features/admin/ui';
import { AssetThumbnail, assetKeys, assetsApi, assetTypeLabels } from '@/features/assets';
import { useAuth } from '@/features/auth';
import { errorMessage } from '@/shared/api/errors';
import type { Asset } from '@/shared/contracts/dto.schema';
import { cn } from '@/shared/lib/cn';
import { formatBytes } from '@/shared/lib/format';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Feedback } from '@/shared/ui/Feedback';
import { SearchFilter, SelectFilter } from '@/shared/ui/LiveFilters';
import { LoadingState } from '@/shared/ui/LoadingState';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/shared/ui/primitives/empty';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';

const typeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    IMAGE: FileImage,
    AUDIO: Music2,
    MODEL: Box,
    VIDEO: Film,
};

interface AdminLibraryItemProps {
    asset: Asset;
    categoryName?: string;
    onViewDetails: (asset: Asset) => void;
    onEdit: (asset: Asset) => void;
    onDelete: (asset: Asset) => void;
}

/**
 * Thẻ hiển thị một tài nguyên trong thư viện dùng chung.
 * Đồng bộ phong cách thẻ dữ liệu với trang /admin/users và /admin/books.
 */
function AdminLibraryItem({
    asset,
    categoryName,
    onViewDetails,
    onEdit,
    onDelete,
}: AdminLibraryItemProps) {
    const TypeIcon = asset.type ? typeIcons[asset.type] || FileText : FileText;

    return (
        <li className="group rounded-[var(--radius-lg)] border border-border bg-surface p-5 transition-all hover:border-primary/40 hover:shadow-sm">
            {/* Hàng trên: Thumbnail + Tên + Badges + Cụm Action Buttons */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                    {/* Thumbnail click để xem chi tiết */}
                    <button
                        type="button"
                        onClick={() => onViewDetails(asset)}
                        className="relative shrink-0 rounded-[var(--radius-md)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        title="Xem chi tiết tài nguyên"
                    >
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-border bg-muted/40 shadow-xs">
                            <AssetThumbnail asset={asset} variant="compact" />
                        </div>
                        {/* Chấm trạng thái nhỏ */}
                        <span
                            className={cn(
                                'absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-surface shadow-xs',
                                asset.status === 'READY'
                                    ? 'bg-emerald-500'
                                    : asset.status === 'PROCESSING'
                                      ? 'bg-amber-500'
                                      : 'bg-destructive',
                            )}
                            title={`Trạng thái: ${asset.status}`}
                        />
                    </button>

                    <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <button
                                type="button"
                                onClick={() => onViewDetails(asset)}
                                className="truncate text-left font-semibold text-base text-foreground transition-colors hover:text-primary focus-visible:underline focus-visible:outline-none"
                            >
                                {asset.name}
                            </button>

                            <Badge
                                tone="neutral"
                                className="h-5 justify-center gap-1 px-2 text-center font-normal text-[11px] leading-none"
                            >
                                <TypeIcon className="h-2.5 w-2.5" />
                                {assetTypeLabels[asset.type] || asset.type}
                            </Badge>

                            {categoryName && (
                                <Badge
                                    tone="success"
                                    className="h-5 justify-center gap-1 px-2 text-center font-normal text-[11px] leading-none"
                                >
                                    {categoryName}
                                </Badge>
                            )}

                            <Badge
                                tone="info"
                                className="h-5 justify-center px-1.5 text-center font-normal text-[11px] leading-none"
                            >
                                .{asset.format.toUpperCase()}
                            </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
                            <span>
                                Tác giả:{' '}
                                <strong className="font-medium text-foreground/90">
                                    {asset.authorName || 'Chưa rõ'}
                                </strong>
                            </span>
                            <span>•</span>
                            <span>
                                Giấy phép:{' '}
                                <span className="font-medium text-foreground/80">
                                    {asset.license || 'Chưa có'}
                                </span>
                            </span>
                            <span>•</span>
                            <span>{formatBytes(asset.sizeBytes)}</span>
                        </div>
                    </div>
                </div>

                {/* Cụm 4 nút hành động tinh tế chuẩn A11y & Design tokens */}
                <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
                    {/* 1. Xem chi tiết */}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground transition-colors hover:bg-hover hover:text-foreground active:bg-selected"
                        onClick={() => onViewDetails(asset)}
                        title="Xem chi tiết tài nguyên"
                        aria-label="Xem chi tiết tài nguyên"
                    >
                        <Eye className="size-4" />
                    </Button>

                    {/* 2. Sửa thông tin */}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground transition-colors hover:bg-hover hover:text-foreground active:bg-selected"
                        onClick={() => onEdit(asset)}
                        title="Chỉnh sửa thông tin"
                        aria-label="Chỉnh sửa thông tin"
                    >
                        <Pencil className="size-4" />
                    </Button>

                    {/* 3. Mở tệp gốc ngoài tab mới */}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground transition-colors hover:bg-hover hover:text-foreground active:bg-selected"
                        asChild
                        title="Mở tệp gốc ngoài tab mới"
                        aria-label="Mở tệp gốc ngoài tab mới"
                    >
                        <a href={asset.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="size-4" />
                        </a>
                    </Button>

                    {/* 4. Xóa khỏi thư viện */}
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => onDelete(asset)}
                        title="Xóa khỏi thư viện dùng chung"
                        aria-label="Xóa khỏi thư viện dùng chung"
                    >
                        <Trash2 className="size-4" />
                    </Button>
                </div>
            </div>

            {/* Hàng dưới: Metadata & Tags chi tiết */}
            <div className="mt-4 flex flex-col gap-3.5 border-border/70 border-t pt-3.5 text-muted-foreground text-xs sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
                    <span className="inline-flex items-center gap-1.5">
                        <HardDrive className="h-3.5 w-3.5 text-muted-foreground/80" />
                        <span>{formatBytes(asset.sizeBytes)}</span>
                    </span>

                    <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground/80" />
                        <span>
                            Thêm ngày:{' '}
                            <strong className="font-medium text-foreground/90">
                                {adminDate(asset.createdAt)}
                            </strong>
                        </span>
                    </span>

                    {asset.sourceUrl && (
                        <a
                            href={asset.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-[200px] items-center gap-1 truncate text-primary hover:underline"
                            title={asset.sourceUrl}
                        >
                            <span className="truncate">Nguồn gốc</span>
                            <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                    )}
                </div>

                {/* Tags */}
                {asset.tags && asset.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                        <Tag className="h-3 w-3 text-muted-foreground/70" />
                        {asset.tags.slice(0, 3).map((tag) => (
                            <span
                                key={tag}
                                className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] text-foreground/70"
                            >
                                {tag}
                            </span>
                        ))}
                        {asset.tags.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">
                                +{asset.tags.length - 3}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </li>
    );
}

type ModalType = 'none' | 'create' | 'detail' | 'edit' | 'delete';

export function AdminLibraryPage() {
    const { user } = useAuth();
    const [params] = useSearchParams();
    const query = readLibrarySearch(params);

    const [modalState, setModalState] = useState<{
        type: ModalType;
        asset?: Asset | null;
        assetId?: string | null;
    }>({ type: 'none' });

    const list = useQuery({
        queryKey: libraryKeys.list(user?.id || '', query),
        queryFn: ({ signal }) => libraryApi.library(query, signal),
    });

    const categories = useQuery({
        queryKey: assetKeys.categories(user?.id || ''),
        queryFn: ({ signal }) => assetsApi.categories(signal),
    });

    const handleViewDetails = (asset: Asset) => {
        setModalState({ type: 'detail', asset, assetId: asset.id });
    };

    const handleEdit = (asset: Asset) => {
        setModalState({ type: 'edit', asset, assetId: asset.id });
    };

    const handleDelete = (asset: Asset) => {
        setModalState({ type: 'delete', asset, assetId: asset.id });
    };

    const closeModal = () => {
        setModalState({ type: 'none' });
    };

    const categoryMap = new Map((categories.data || []).map((c) => [c.id, c.name]));

    return (
        <div className="mx-auto max-w-6xl space-y-6 p-6">
            {/* Header: Tiêu đề & Nút Thêm mới */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="font-semibold text-2xl text-foreground tracking-tight">
                        Thư viện dùng chung
                    </h1>
                    <p className="mt-1 text-muted-foreground text-sm">
                        Tài nguyên được phê duyệt để tất cả các tác giả có thể chèn vào các trang
                        sách AR.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        type="button"
                        onClick={() => setModalState({ type: 'create' })}
                        className="gap-2"
                    >
                        <Plus className="h-4 w-4" data-icon="inline-start" />
                        Thêm vào thư viện
                    </Button>
                </div>
            </div>

            {/* Thanh Bộ lọc & Tìm kiếm đồng bộ với AdminUsersPage */}
            <form
                className="rounded-[var(--radius-lg)] border border-border bg-surface p-4"
                onSubmit={(event) => event.preventDefault()}
            >
                <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {/* 1. Tìm kiếm theo tên */}
                    <Field>
                        <FieldLabel htmlFor="library-q" className="font-medium text-xs">
                            Tên tài nguyên
                        </FieldLabel>
                        <SearchFilter
                            id="library-q"
                            name="q"
                            placeholder="Tìm kiếm tài nguyên..."
                            maxLength={100}
                            value={query.q}
                        />
                    </Field>

                    {/* 2. Lọc theo Loại */}
                    <Field>
                        <FieldLabel htmlFor="library-type" className="font-medium text-xs">
                            Loại tài nguyên
                        </FieldLabel>
                        <SelectFilter
                            id="library-type"
                            name="type"
                            value={query.type || ''}
                            options={[
                                { value: '', label: 'Tất cả loại' },
                                ...Object.entries(assetTypeLabels).map(([value, label]) => ({
                                    value,
                                    label,
                                })),
                            ]}
                        />
                    </Field>

                    {/* 3. Lọc theo Danh mục */}
                    <Field>
                        <FieldLabel htmlFor="library-category" className="font-medium text-xs">
                            Danh mục
                        </FieldLabel>
                        <SelectFilter
                            id="library-category"
                            name="categoryId"
                            value={query.categoryId || ''}
                            options={[
                                { value: '', label: 'Tất cả danh mục' },
                                ...(categories.data?.map((cat) => ({
                                    value: cat.id,
                                    label: cat.name,
                                })) ?? []),
                            ]}
                        />
                    </Field>

                    {/* 4. Hiển thị / trang */}
                    <Field>
                        <FieldLabel htmlFor="library-limit" className="font-medium text-xs">
                            Hiển thị
                        </FieldLabel>
                        <SelectFilter
                            id="library-limit"
                            name="limit"
                            value={String(query.limit)}
                            options={[
                                { value: '5', label: '5 tài nguyên / trang' },
                                { value: '10', label: '10 tài nguyên / trang' },
                                { value: '12', label: '12 tài nguyên / trang' },
                                { value: '20', label: '20 tài nguyên / trang' },
                            ]}
                        />
                    </Field>
                </FieldGroup>

                {/* Footer bar của filter: thông tin & Đặt lại bộ lọc */}
                <div className="mt-3 flex items-center justify-between border-border border-t pt-3 text-xs">
                    <span className="text-muted-foreground">
                        Lọc theo tên, loại tài nguyên và danh mục để quản lý thư viện dùng chung.
                    </span>
                    <Link
                        to="/admin/library"
                        state={{ resetFilters: true }}
                        className="font-medium text-primary hover:underline"
                    >
                        Đặt lại bộ lọc
                    </Link>
                </div>
            </form>

            {/* Trạng thái tải & Báo lỗi */}
            {categories.isError && <Feedback error={errorMessage(categories.error)} />}
            {list.isPending && <LoadingState layout="rows">Đang tải thư viện…</LoadingState>}
            {list.isError && <Feedback error={errorMessage(list.error)} />}

            {/* Danh sách tài nguyên */}
            {list.isSuccess && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between text-muted-foreground text-xs">
                        <span>
                            Hiển thị{' '}
                            <strong className="text-foreground">{list.data.data.length}</strong>{' '}
                            trên <strong className="text-foreground">{list.data.meta.total}</strong>{' '}
                            tài nguyên
                        </span>
                        <AdminReload
                            retry={() => {
                                void list.refetch();
                                void categories.refetch();
                            }}
                            busy={list.isFetching || categories.isFetching}
                        />
                    </div>

                    {list.data.data.length ? (
                        <ul className="list-none space-y-3 p-0">
                            {list.data.data.map((asset) => (
                                <AdminLibraryItem
                                    key={asset.id}
                                    asset={asset}
                                    categoryName={
                                        asset.categoryId
                                            ? categoryMap.get(asset.categoryId)
                                            : undefined
                                    }
                                    onViewDetails={handleViewDetails}
                                    onEdit={handleEdit}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </ul>
                    ) : (
                        <Empty className="empty-state px-5 py-16">
                            <EmptyHeader>
                                <EmptyTitle>
                                    <h2>Không có tài nguyên phù hợp</h2>
                                </EmptyTitle>
                                <EmptyDescription>
                                    <p>
                                        Đổi bộ lọc tìm kiếm hoặc chọn tài nguyên cá nhân để đưa vào
                                        thư viện.
                                    </p>
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    )}

                    <div className="pt-2">
                        <AdminPager
                            page={query.page}
                            meta={list.data.meta}
                            busy={list.isFetching}
                        />
                    </div>
                </div>
            )}

            {/* Modal thêm tài nguyên mới vào thư viện */}
            <LibraryAssetCreateModal
                isOpen={modalState.type === 'create'}
                onClose={closeModal}
                onSuccess={() => void list.refetch()}
            />

            {/* Modal xem chi tiết tài nguyên */}
            <LibraryAssetDetailModal
                assetId={modalState.assetId ?? null}
                isOpen={modalState.type === 'detail'}
                onClose={closeModal}
                onEdit={handleEdit}
                onDelete={handleDelete}
            />

            {/* Modal chỉnh sửa tài nguyên */}
            <LibraryAssetEditModal
                asset={modalState.asset ?? null}
                isOpen={modalState.type === 'edit'}
                onClose={closeModal}
                onSuccess={() => void list.refetch()}
            />

            {/* Modal xóa tài nguyên khỏi thư viện */}
            <LibraryAssetDeleteModal
                asset={modalState.asset ?? null}
                isOpen={modalState.type === 'delete'}
                onClose={closeModal}
                onSuccess={() => void list.refetch()}
            />
        </div>
    );
}
