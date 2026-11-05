import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    ArrowLeft,
    ExternalLink,
    Plus,
    Search,
    Share2,
    UploadCloud,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
    AssetThumbnail,
    assetKeys,
    assetStatusLabels,
    assetsApi,
    assetTypeLabels,
} from '@/features/assets';
import { useAuth } from '@/features/auth';
import { errorMessage } from '@/shared/api/errors';
import {
    type CreateLibraryAssetBody,
    CreateLibraryAssetBodySchema,
} from '@/shared/contracts/api/admin.schema';
import type { Asset } from '@/shared/contracts/dto.schema';
import { formatBytes } from '@/shared/lib/format';
import { AUDIO_TAG_OPTIONS, audioKindFromTags } from '@/shared/scene/audio-kind';
import { Alert } from '@/shared/ui/Alert';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { FormSelect } from '@/shared/ui/FormSelect';
import { LoadingState } from '@/shared/ui/LoadingState';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/shared/ui/primitives/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/shared/ui/primitives/empty';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { libraryApi } from '../library-ui';

export interface LibraryAssetCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (createdAssetId?: string) => void;
}

export function LibraryAssetCreateModal({
    isOpen,
    onClose,
    onSuccess,
}: LibraryAssetCreateModalProps) {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // Bước 1: Chọn tài nguyên cá nhân
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);

    // Bước 2: Form cấu hình metadata
    const [name, setName] = useState('');
    const [categoryId, setCategoryId] = useState<string>('');
    const [license, setLicense] = useState('');
    const [authorName, setAuthorName] = useState('');
    const [sourceUrl, setSourceUrl] = useState('');
    const [tags, setTags] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [apiError, setApiError] = useState<string | null>(null);

    // Lấy danh sách danh mục thư viện
    const categoriesQuery = useQuery({
        queryKey: assetKeys.categories(user?.id || ''),
        queryFn: ({ signal }) => assetsApi.categories(signal),
        enabled: isOpen,
    });

    // Lấy danh sách tài nguyên cá nhân của người dùng
    const mineAssetsQuery = useQuery({
        queryKey: assetKeys.list(user?.id || '', {
            q: searchQuery.trim() || undefined,
            page,
            limit: 6,
            scope: 'mine',
        }),
        queryFn: ({ signal }) =>
            assetsApi.list(
                {
                    q: searchQuery.trim() || undefined,
                    page,
                    limit: 6,
                    scope: 'mine',
                },
                signal,
            ),
        enabled: isOpen && !selectedAsset,
    });

    // Đặt lại state khi đóng modal
    const handleClose = () => {
        setSelectedAsset(null);
        setSearchQuery('');
        setPage(1);
        setName('');
        setCategoryId('');
        setLicense('');
        setAuthorName('');
        setSourceUrl('');
        setTags('');
        setFieldErrors({});
        setApiError(null);
        onClose();
    };

    // Khi chọn một tài nguyên cá nhân để cấu hình
    const handleSelectAsset = (asset: Asset) => {
        if (asset.status !== 'READY') return;
        setSelectedAsset(asset);
        setName(asset.name || '');
        setCategoryId(asset.categoryId || '');
        setLicense(asset.license || '');
        setAuthorName(asset.authorName || user?.displayName || '');
        setSourceUrl(asset.sourceUrl || '');
        if (asset.type === 'AUDIO') {
            setTags(audioKindFromTags(asset.tags).toLowerCase());
        } else {
            setTags(asset.tags?.join(', ') || '');
        }
        setFieldErrors({});
        setApiError(null);
    };

    // Đổi sang chọn tài nguyên khác
    const handleBackToSelect = () => {
        setSelectedAsset(null);
        setFieldErrors({});
        setApiError(null);
    };

    // Mutation thực hiện promote tài nguyên vào thư viện
    const promoteMutation = useMutation({
        mutationFn: async () => {
            if (!selectedAsset) throw new Error('Vui lòng chọn một tài nguyên cá nhân');

            const errors: Record<string, string> = {};
            const trimmedName = name.trim();
            const trimmedLicense = license.trim();
            const trimmedAuthor = authorName.trim();
            const trimmedSource = sourceUrl.trim();

            if (!trimmedName) errors.name = 'Tên tài nguyên không được để trống';
            if (!trimmedLicense) errors.license = 'Giấy phép không được để trống';
            if (!trimmedAuthor) errors.authorName = 'Tác giả gốc không được để trống';

            if (Object.keys(errors).length > 0) {
                setFieldErrors(errors);
                throw new Error('Vui lòng kiểm tra lại các trường thông tin');
            }

            const rawTags =
                selectedAsset.type === 'AUDIO'
                    ? [tags.trim()]
                    : tags
                          .split(',')
                          .map((t) => t.trim())
                          .filter(Boolean);

            const payload: CreateLibraryAssetBody = {
                assetId: selectedAsset.id,
                name: trimmedName,
                categoryId: categoryId || null,
                license: trimmedLicense,
                authorName: trimmedAuthor,
                sourceUrl: trimmedSource || undefined,
                tags: rawTags,
            };

            const parsed = CreateLibraryAssetBodySchema.safeParse(payload);
            if (!parsed.success) {
                throw new Error(errorMessage(parsed.error));
            }

            return libraryApi.promote(parsed.data);
        },
        onSuccess: (result) => {
            toast.success(`Đã thêm tài nguyên "${result.name}" vào thư viện dùng chung thành công!`);
            void queryClient.invalidateQueries({ queryKey: ['admin'] });
            void queryClient.invalidateQueries({ queryKey: assetKeys.all });
            onSuccess?.(result.id);
            handleClose();
        },
        onError: (err: unknown) => {
            setApiError(errorMessage(err));
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFieldErrors({});
        setApiError(null);
        promoteMutation.mutate();
    };

    const categories = categoriesQuery.data || [];

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open: boolean) => {
                if (!open && !promoteMutation.isPending) {
                    handleClose();
                }
            }}
        >
            <DialogContent className="max-h-[90dvh] max-w-[540px] space-y-4 overflow-y-auto p-5 sm:p-6">
                <DialogHeader className="gap-1 pb-0.5">
                    <DialogTitle className="m-0 flex items-center gap-2 font-semibold text-base text-foreground leading-tight sm:text-lg">
                        {selectedAsset ? (
                            <>
                                <Share2 className="h-4.5 w-4.5 shrink-0 text-primary" />
                                <span>Cấu hình tài nguyên đưa vào thư viện</span>
                            </>
                        ) : (
                            <>
                                <Plus className="h-4.5 w-4.5 shrink-0 text-primary" />
                                <span>Thêm tài nguyên vào thư viện</span>
                            </>
                        )}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
                        {selectedAsset
                            ? 'Xác nhận thông tin bản quyền và tác giả trước khi đưa vào thư viện dùng chung.'
                            : 'Chọn tài nguyên cá nhân đã sẵn sàng để xuất bản vào thư viện dùng chung cho toàn bộ tác giả.'}
                    </DialogDescription>
                </DialogHeader>

                {apiError && (
                    <Alert tone="danger" className="text-xs">
                        {apiError}
                    </Alert>
                )}

                {/* BƯỚC 1: Chọn tài nguyên cá nhân */}
                {!selectedAsset && (
                    <div className="space-y-3.5">
                        {/* Thanh tìm kiếm & liên kết tải lên */}
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        setPage(1);
                                    }}
                                    placeholder="Tìm tài nguyên cá nhân..."
                                    className="h-8 pl-8 text-xs placeholder:text-xs"
                                />
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                asChild
                                className="h-8 shrink-0 gap-1.5 px-2.5 text-xs"
                            >
                                <Link to="/assets/upload" target="_blank" rel="noopener noreferrer">
                                    <UploadCloud className="h-3.5 w-3.5 text-primary" />
                                    <span>Tải tệp mới</span>
                                    <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
                                </Link>
                            </Button>
                        </div>

                        {/* Danh sách tài nguyên cá nhân */}
                        {mineAssetsQuery.isPending && (
                            <LoadingState layout="assets">Đang tải tài nguyên cá nhân…</LoadingState>
                        )}

                        {mineAssetsQuery.isError && (
                            <Alert tone="danger" className="text-xs">
                                {errorMessage(mineAssetsQuery.error)}
                            </Alert>
                        )}

                        {mineAssetsQuery.isSuccess && (
                            <div className="space-y-3">
                                {mineAssetsQuery.data.data.length ? (
                                    <ul className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
                                        {mineAssetsQuery.data.data.map((asset) => {
                                            const isReady =
                                                asset.status === 'READY' && asset.scope === 'mine';

                                            return (
                                                <li
                                                    key={asset.id}
                                                    onClick={() => {
                                                        if (isReady) handleSelectAsset(asset);
                                                    }}
                                                    className={`flex items-center justify-between gap-3 rounded-lg border p-2.5 transition-colors ${
                                                        isReady
                                                            ? 'cursor-pointer border-border bg-surface hover:border-primary/50 hover:bg-surface-hover'
                                                            : 'border-border/50 bg-muted/20 opacity-60'
                                                    }`}
                                                >
                                                    <div className="flex min-w-0 items-center gap-2.5">
                                                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted/40">
                                                            <AssetThumbnail
                                                                asset={asset}
                                                                variant="compact"
                                                            />
                                                        </div>
                                                        <div className="min-w-0 space-y-0.5">
                                                            <div className="flex items-center gap-1.5">
                                                                <h4 className="truncate font-semibold text-foreground text-xs">
                                                                    {asset.name}
                                                                </h4>
                                                                <Badge
                                                                    tone="neutral"
                                                                    className="h-4 px-1 text-[10px]"
                                                                >
                                                                    {assetTypeLabels[asset.type] ||
                                                                        asset.type}
                                                                </Badge>
                                                            </div>
                                                            <p className="text-[11px] text-muted-foreground">
                                                                {formatBytes(asset.sizeBytes)} •{' '}
                                                                <span
                                                                    className={
                                                                        isReady
                                                                            ? 'text-emerald-600 dark:text-emerald-400'
                                                                            : 'text-amber-500'
                                                                    }
                                                                >
                                                                    {assetStatusLabels[
                                                                        asset.status
                                                                    ] || asset.status}
                                                                </span>
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <Button
                                                        variant={isReady ? 'default' : 'secondary'}
                                                        size="sm"
                                                        className="h-7 shrink-0 px-2.5 text-xs"
                                                        type="button"
                                                        disabled={!isReady}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleSelectAsset(asset);
                                                        }}
                                                    >
                                                        {isReady ? 'Chọn' : 'Chưa sẵn sàng'}
                                                    </Button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : (
                                    <Empty className="py-8">
                                        <EmptyHeader>
                                            <EmptyTitle>
                                                <h3 className="text-sm">Chưa có tài nguyên phù hợp</h3>
                                            </EmptyTitle>
                                            <EmptyDescription>
                                                <p className="text-xs">
                                                    Không tìm thấy tài nguyên cá nhân nào ở trạng thái
                                                    sẵn sàng. Hãy tải tệp mới lên trước.
                                                </p>
                                            </EmptyDescription>
                                        </EmptyHeader>
                                    </Empty>
                                )}

                                {/* Phân trang danh sách cá nhân */}
                                {mineAssetsQuery.data.meta.totalPages > 1 && (
                                    <div className="flex items-center justify-between border-border/60 border-t pt-2 text-muted-foreground text-xs">
                                        <span>
                                            Trang {page} / {mineAssetsQuery.data.meta.totalPages}
                                        </span>
                                        <div className="flex gap-1.5">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 px-2 text-xs"
                                                disabled={page <= 1}
                                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                            >
                                                Trước
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 px-2 text-xs"
                                                disabled={
                                                    page >= mineAssetsQuery.data.meta.totalPages
                                                }
                                                onClick={() => setPage((p) => p + 1)}
                                            >
                                                Sau
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        <DialogFooter className="mt-2 border-border/60 border-t pt-2">
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="h-8 px-3 text-xs"
                                onClick={handleClose}
                            >
                                Đóng
                            </Button>
                        </DialogFooter>
                    </div>
                )}

                {/* BƯỚC 2: Cấu hình thông tin đưa vào thư viện */}
                {selectedAsset && (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Thẻ tóm tắt tài nguyên đã chọn */}
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-surface/40 p-2.5">
                            <div className="flex min-w-0 items-center gap-2.5">
                                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted/60">
                                    <AssetThumbnail asset={selectedAsset} variant="compact" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="truncate font-semibold text-foreground text-sm">
                                            {selectedAsset.name}
                                        </span>
                                        <Badge
                                            tone="neutral"
                                            className="h-4.5 px-1.5 font-normal text-[10px]"
                                        >
                                            {assetTypeLabels[selectedAsset.type] ||
                                                selectedAsset.type}
                                        </Badge>
                                    </div>
                                    <p className="truncate text-[11px] text-muted-foreground">
                                        {formatBytes(selectedAsset.sizeBytes)} • Định dạng .
                                        {selectedAsset.format.toUpperCase()}
                                    </p>
                                </div>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 shrink-0 gap-1 px-2 text-xs"
                                onClick={handleBackToSelect}
                                disabled={promoteMutation.isPending}
                            >
                                <ArrowLeft className="h-3 w-3" />
                                <span>Đổi tài nguyên</span>
                            </Button>
                        </div>

                        <FieldGroup className="gap-3.5">
                            {/* Tên tài nguyên */}
                            <Field>
                                <FieldLabel
                                    htmlFor="promote-asset-name"
                                    className="font-medium text-xs"
                                >
                                    Tên tài nguyên <span className="text-destructive">*</span>
                                </FieldLabel>
                                <Input
                                    id="promote-asset-name"
                                    value={name}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        setName(e.target.value);
                                        if (fieldErrors.name)
                                            setFieldErrors((p) => ({ ...p, name: '' }));
                                    }}
                                    maxLength={150}
                                    disabled={promoteMutation.isPending}
                                    className="mt-1 h-8 text-xs placeholder:text-xs"
                                    placeholder="Nhập tên tài nguyên..."
                                />
                                {fieldErrors.name && (
                                    <FieldError className="m-0 mt-1 text-[11px]">
                                        {fieldErrors.name}
                                    </FieldError>
                                )}
                            </Field>

                            {/* Danh mục */}
                            <Field orientation="contents">
                                <FieldLabel
                                    htmlFor="promote-asset-category"
                                    className="font-medium text-xs"
                                >
                                    Danh mục thư viện
                                    <FormSelect
                                        id="promote-asset-category"
                                        value={categoryId}
                                        onValueChange={(val) => setCategoryId(val)}
                                        options={[
                                            { value: '', label: 'Không phân danh mục' },
                                            ...categories.map((cat) => ({
                                                value: cat.id,
                                                label: cat.name,
                                            })),
                                        ]}
                                        disabled={promoteMutation.isPending}
                                    />
                                </FieldLabel>
                            </Field>

                            {/* Giấy phép & Tác giả 2 cột */}
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <Field>
                                    <FieldLabel
                                        htmlFor="promote-asset-license"
                                        className="font-medium text-xs"
                                    >
                                        Giấy phép sử dụng{' '}
                                        <span className="text-destructive">*</span>
                                    </FieldLabel>
                                    <Input
                                        id="promote-asset-license"
                                        value={license}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            setLicense(e.target.value);
                                            if (fieldErrors.license)
                                                setFieldErrors((p) => ({ ...p, license: '' }));
                                        }}
                                        maxLength={50}
                                        disabled={promoteMutation.isPending}
                                        className="mt-1 h-8 text-xs placeholder:text-xs"
                                        placeholder="Ví dụ: CC-BY, CC0, Miễn phí..."
                                    />
                                    {fieldErrors.license && (
                                        <FieldError className="m-0 mt-1 text-[11px]">
                                            {fieldErrors.license}
                                        </FieldError>
                                    )}
                                </Field>

                                <Field>
                                    <FieldLabel
                                        htmlFor="promote-asset-author"
                                        className="font-medium text-xs"
                                    >
                                        Tác giả gốc <span className="text-destructive">*</span>
                                    </FieldLabel>
                                    <Input
                                        id="promote-asset-author"
                                        value={authorName}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            setAuthorName(e.target.value);
                                            if (fieldErrors.authorName)
                                                setFieldErrors((p) => ({ ...p, authorName: '' }));
                                        }}
                                        maxLength={150}
                                        disabled={promoteMutation.isPending}
                                        className="mt-1 h-8 text-xs placeholder:text-xs"
                                        placeholder="Tên tác giả gốc..."
                                    />
                                    {fieldErrors.authorName && (
                                        <FieldError className="m-0 mt-1 text-[11px]">
                                            {fieldErrors.authorName}
                                        </FieldError>
                                    )}
                                </Field>
                            </div>

                            {/* Nguồn liên kết */}
                            <Field>
                                <FieldLabel
                                    htmlFor="promote-asset-source"
                                    className="font-medium text-xs"
                                >
                                    Liên kết nguồn gốc{' '}
                                    <span className="font-normal text-muted-foreground">
                                        (không bắt buộc)
                                    </span>
                                </FieldLabel>
                                <Input
                                    id="promote-asset-source"
                                    type="url"
                                    value={sourceUrl}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                        setSourceUrl(e.target.value)
                                    }
                                    disabled={promoteMutation.isPending}
                                    className="mt-1 h-8 text-xs placeholder:text-xs"
                                    placeholder="https://..."
                                />
                            </Field>

                            {/* Nhãn Tags */}
                            <Field>
                                <FieldLabel
                                    htmlFor="promote-asset-tags"
                                    className="font-medium text-xs"
                                >
                                    {selectedAsset.type === 'AUDIO'
                                        ? 'Loại âm thanh'
                                        : 'Nhãn (ngăn cách bởi dấu phẩy)'}
                                </FieldLabel>
                                {selectedAsset.type === 'AUDIO' ? (
                                    <FormSelect
                                        id="promote-asset-tags"
                                        value={tags}
                                        onValueChange={(val) => setTags(val)}
                                        options={AUDIO_TAG_OPTIONS}
                                        disabled={promoteMutation.isPending}
                                    />
                                ) : (
                                    <Input
                                        id="promote-asset-tags"
                                        value={tags}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                            setTags(e.target.value)
                                        }
                                        disabled={promoteMutation.isPending}
                                        className="mt-1 h-8 text-xs placeholder:text-xs"
                                        placeholder="ví dụ: phong cảnh, thiên nhiên, 3d..."
                                    />
                                )}
                                <span className="mt-1 block text-[11px] text-muted-foreground">
                                    Tối đa 20 nhãn, mỗi nhãn không quá 30 ký tự.
                                </span>
                            </Field>
                        </FieldGroup>

                        <div className="rounded-md border border-border/60 bg-muted/30 p-2.5 text-[11px] text-muted-foreground">
                            Tài nguyên sẽ được chuyển khỏi danh sách cá nhân sang thư viện dùng
                            chung. Tất cả tác giả có thể dùng trong sách; các tham chiếu hiện có
                            được giữ nguyên.
                        </div>

                        <DialogFooter className="mt-2 flex-row justify-end gap-2 border-border/60 border-t pt-2">
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="h-8 px-3 text-xs"
                                onClick={handleBackToSelect}
                                disabled={promoteMutation.isPending}
                            >
                                Quay lại
                            </Button>
                            <Button
                                type="submit"
                                size="sm"
                                className="h-8 gap-1.5 px-3.5 font-medium text-xs"
                                disabled={promoteMutation.isPending}
                            >
                                <Share2 className="h-3.5 w-3.5" />
                                <span>
                                    {promoteMutation.isPending
                                        ? 'Đang xử lý...'
                                        : 'Đưa vào thư viện'}
                                </span>
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}

