import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { assetKeys, assetStatusLabels, assetsApi, assetTypeLabels } from '@/features/assets';
import { useAuth } from '@/features/auth';
import { AssetUploadView } from '@/features/scene/ui/AssetUploadView';
import { errorMessage } from '@/shared/api/errors';
import {
    type CreateLibraryAssetBody,
    CreateLibraryAssetBodySchema,
} from '@/shared/contracts/api/admin.schema';
import type { Asset } from '@/shared/contracts/dto.schema';
import { type AssetType, AssetTypeSchema } from '@/shared/contracts/enums.schema';
import { AUDIO_TAG_OPTIONS, audioKindFromTags } from '@/shared/scene/audio-kind';
import { Alert } from '@/shared/ui/Alert';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { ConfirmationDialog } from '@/shared/ui/ConfirmationDialog';
import { Feedback } from '@/shared/ui/Feedback';
import { FormSelect } from '@/shared/ui/FormSelect';
import { LoadingState } from '@/shared/ui/LoadingState';
import { DialogFooter } from '@/shared/ui/primitives/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/shared/ui/primitives/empty';
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { SearchInput } from '@/shared/ui/SearchInput';
import { libraryApi } from '../library-ui';
import { useAdminMutation as useMutation } from '../use-admin-mutation';
import { LibraryAssetDialog, LibraryAssetSummary } from './LibraryAssetDialog';
import { LibraryLicenseField } from './LibraryLicenseField';

const uploadTypes = AssetTypeSchema.options.map((type) => ({
    value: type,
    label: assetTypeLabels[type],
}));

export interface LibraryAssetCreateModalProps {
    isOpen: boolean;
    initialUpload?: boolean;
    onClose: () => void;
    onSuccess?: (createdAssetId?: string) => void;
}

export function LibraryAssetCreateModal({
    isOpen,
    initialUpload = false,
    onClose,
    onSuccess,
}: LibraryAssetCreateModalProps) {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // Bước 1: Chọn tài nguyên cá nhân
    const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [uploadType, setUploadType] = useState<AssetType | null>(initialUpload ? 'IMAGE' : null);
    const [uploadBusy, setUploadBusy] = useState(false);
    const [uploadDirty, setUploadDirty] = useState(false);
    const [discardUpload, setDiscardUpload] = useState<(() => void) | null>(null);

    // Bước 2: Form cấu hình metadata
    const [name, setName] = useState('');
    const [categoryId, setCategoryId] = useState<string>('');
    const [license, setLicense] = useState('');
    const [authorName, setAuthorName] = useState(initialUpload ? user?.displayName || '' : '');
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
        enabled: isOpen && !selectedAsset && !uploadType,
        refetchInterval: (query) =>
            query.state.data?.data.some((asset) => asset.status === 'PROCESSING') ? 2000 : false,
    });

    // Đặt lại state khi đóng modal
    const handleClose = () => {
        setSelectedAsset(null);
        setUploadType(null);
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
        if (asset.status !== 'READY' || asset.scope !== 'mine') return;
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
        mutationFn: async (asset: Asset) => {
            if (asset.status !== 'READY' || asset.scope !== 'mine')
                throw new Error('Vui lòng chọn một tài nguyên cá nhân đã sẵn sàng.');
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
                asset.type === 'AUDIO'
                    ? [tags.trim()]
                    : tags
                          .split(',')
                          .map((t) => t.trim())
                          .filter(Boolean);

            const payload: CreateLibraryAssetBody = {
                assetId: asset.id,
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
            toast.success(
                `Đã thêm tài nguyên "${result.name}" vào thư viện dùng chung thành công!`,
            );
            void queryClient.invalidateQueries({ queryKey: ['admin'] });
            void queryClient.invalidateQueries({ queryKey: assetKeys.all });
            onSuccess?.(result.id);
            handleClose();
        },
        onError: (err: unknown) => {
            setApiError(errorMessage(err));
        },
    });

    const promote = (asset: Asset) => {
        setFieldErrors({});
        setApiError(null);
        promoteMutation.mutate(asset);
    };

    const categories = categoriesQuery.data || [];
    const personalAssets = mineAssetsQuery.data;
    const leaveUpload = (next: () => void) => {
        if (uploadBusy) return;
        if (uploadDirty) setDiscardUpload(() => next);
        else next();
    };
    const startUpload = () => {
        setName('');
        setCategoryId('');
        setLicense('');
        setAuthorName(user?.displayName || '');
        setSourceUrl('');
        setTags('');
        setFieldErrors({});
        setApiError(null);
        setUploadType('IMAGE');
    };

    function renderFields(type: AssetType, disabled: boolean) {
        return (
            <FieldGroup className={uploadType ? 'gap-3!' : 'gap-4'}>
                {uploadType && (
                    <Field>
                        <FieldLabel htmlFor="library-upload-type">Loại tài nguyên</FieldLabel>
                        <FormSelect
                            id="library-upload-type"
                            value={uploadType}
                            options={uploadTypes}
                            disabled={disabled}
                            onValueChange={(value) => {
                                const nextType = AssetTypeSchema.parse(value);
                                leaveUpload(() => {
                                    setName('');
                                    setTags(nextType === 'AUDIO' ? 'bgm' : '');
                                    setUploadType(nextType);
                                });
                            }}
                        />
                    </Field>
                )}
                {/* Tên tài nguyên */}
                <Field>
                    <FieldLabel htmlFor="promote-asset-name">
                        Tên tài nguyên <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                        id="promote-asset-name"
                        name="name"
                        value={name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            setName(e.target.value);
                            if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: '' }));
                        }}
                        maxLength={150}
                        disabled={disabled}
                        placeholder="Nhập tên tài nguyên..."
                    />
                    {fieldErrors.name && <FieldError>{fieldErrors.name}</FieldError>}
                </Field>

                {/* Danh mục */}
                <Field>
                    <FieldLabel htmlFor="promote-asset-category">Danh mục</FieldLabel>
                    <FormSelect
                        id="promote-asset-category"
                        value={categoryId}
                        onValueChange={setCategoryId}
                        options={[
                            { value: '', label: 'Không phân danh mục' },
                            ...categories.map((cat) => ({
                                value: cat.id,
                                label: cat.name,
                            })),
                        ]}
                        disabled={disabled}
                    />
                </Field>

                <LibraryLicenseField
                    id="promote-asset-license"
                    value={license}
                    onValueChange={(value) => {
                        setLicense(value);
                        if (fieldErrors.license) setFieldErrors((p) => ({ ...p, license: '' }));
                    }}
                    disabled={disabled}
                    error={fieldErrors.license}
                />

                <Field>
                    <FieldLabel htmlFor="promote-asset-author">
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
                        disabled={disabled}
                        placeholder="Tên tác giả gốc..."
                    />
                    {fieldErrors.authorName && <FieldError>{fieldErrors.authorName}</FieldError>}
                </Field>

                {/* Nguồn liên kết */}
                <Field>
                    <FieldLabel htmlFor="promote-asset-source">
                        Liên kết nguồn gốc{' '}
                        <span className="font-normal text-muted-foreground">(không bắt buộc)</span>
                    </FieldLabel>
                    <Input
                        id="promote-asset-source"
                        type="url"
                        value={sourceUrl}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setSourceUrl(e.target.value)
                        }
                        disabled={disabled}
                        placeholder="https://..."
                    />
                </Field>

                {/* Nhãn Tags */}
                <Field>
                    <FieldLabel htmlFor="promote-asset-tags">
                        {type === 'AUDIO' ? 'Loại âm thanh' : 'Nhãn (ngăn cách bởi dấu phẩy)'}
                    </FieldLabel>
                    {type === 'AUDIO' ? (
                        <FormSelect
                            id="promote-asset-tags"
                            name="tags"
                            value={tags}
                            onValueChange={(val) => setTags(val)}
                            options={AUDIO_TAG_OPTIONS}
                            disabled={disabled}
                        />
                    ) : (
                        <Input
                            id="promote-asset-tags"
                            name="tags"
                            value={tags}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setTags(e.target.value)
                            }
                            disabled={disabled}
                            placeholder="ví dụ: phong cảnh, thiên nhiên, 3d..."
                        />
                    )}
                    {type !== 'AUDIO' && (
                        <FieldDescription className="text-xs">
                            Tối đa 20 nhãn, mỗi nhãn không quá 30 ký tự.
                        </FieldDescription>
                    )}
                </Field>
            </FieldGroup>
        );
    }

    return (
        <>
            <LibraryAssetDialog
                open={isOpen}
                busy={promoteMutation.isPending || uploadBusy}
                className={
                    uploadType
                        ? 'h-[min(840px,calc(100dvh-24px))] max-h-[calc(100dvh-24px)] max-w-[min(1200px,calc(100vw-24px))]'
                        : undefined
                }
                title={
                    uploadType
                        ? 'Tải tệp mới'
                        : selectedAsset
                          ? 'Thông tin tài nguyên'
                          : 'Chọn tài nguyên'
                }
                description={
                    uploadType
                        ? 'Chọn tệp từ máy để thêm vào thư viện dùng chung.'
                        : selectedAsset
                          ? 'Kiểm tra giấy phép và thông tin tác giả trước khi chia sẻ.'
                          : 'Chọn tài nguyên cá nhân để thêm vào thư viện dùng chung.'
                }
                onClose={() => leaveUpload(handleClose)}
            >
                <Feedback error={apiError} errorMode="toast" />

                {uploadType && (
                    <AssetUploadView
                        key={uploadType}
                        type={uploadType}
                        pending={promoteMutation.isPending}
                        library={{
                            fields: renderFields(
                                uploadType,
                                uploadBusy || promoteMutation.isPending,
                            ),
                            onFileNameChange: setName,
                        }}
                        onChoose={promote}
                        onBack={() =>
                            leaveUpload(() => {
                                setSearchQuery('');
                                setPage(1);
                                setUploadType(null);
                                setFieldErrors({});
                                setApiError(null);
                            })
                        }
                        onBusyChange={setUploadBusy}
                        onDirtyChange={setUploadDirty}
                    />
                )}

                {!selectedAsset && !uploadType && (
                    <div className="flex min-h-0 flex-col gap-3">
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <SearchInput
                                aria-label="Tìm tài nguyên cá nhân"
                                value={searchQuery}
                                onValueChange={(value) => {
                                    setSearchQuery(value);
                                    setPage(1);
                                }}
                                placeholder="Tìm theo tên…"
                                loading={mineAssetsQuery.isFetching && !mineAssetsQuery.isPending}
                                className="min-w-36 flex-1"
                            />
                            <Button
                                variant="outline"
                                className="min-h-[var(--control-height)] gap-2"
                                onClick={startUpload}
                            >
                                <Upload data-icon="inline-start" aria-hidden="true" />
                                Tải tệp mới
                            </Button>
                        </div>

                        <div className="min-h-0 overflow-y-auto" key={page}>
                            {mineAssetsQuery.isPending && (
                                <LoadingState layout="assets">
                                    Đang tải tài nguyên cá nhân…
                                </LoadingState>
                            )}
                            {mineAssetsQuery.isError && (
                                <div className="flex flex-col items-start gap-3 py-3">
                                    <Alert tone="danger">
                                        {errorMessage(mineAssetsQuery.error)}
                                    </Alert>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => void mineAssetsQuery.refetch()}
                                    >
                                        Thử tải lại
                                    </Button>
                                </div>
                            )}
                            {mineAssetsQuery.isSuccess &&
                                (personalAssets?.data.length ? (
                                    <ul className="m-0 list-none divide-y divide-border px-0">
                                        {personalAssets.data.map((asset) => {
                                            const isReady =
                                                asset.status === 'READY' && asset.scope === 'mine';
                                            return (
                                                <li key={asset.id}>
                                                    <button
                                                        type="button"
                                                        disabled={!isReady}
                                                        onClick={() => handleSelectAsset(asset)}
                                                        className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:not-disabled:bg-muted focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2 disabled:cursor-default disabled:opacity-65"
                                                    >
                                                        <LibraryAssetSummary asset={asset} />
                                                        {isReady ? (
                                                            <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground text-sm">
                                                                Chọn{' '}
                                                                <ChevronRight
                                                                    className="size-4"
                                                                    aria-hidden="true"
                                                                />
                                                            </span>
                                                        ) : (
                                                            <Badge
                                                                tone={
                                                                    asset.status === 'FAILED'
                                                                        ? 'danger'
                                                                        : 'neutral'
                                                                }
                                                            >
                                                                {assetStatusLabels[asset.status]}
                                                            </Badge>
                                                        )}
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : (
                                    <Empty className="border-0 py-10">
                                        <EmptyHeader>
                                            <EmptyTitle>
                                                {searchQuery
                                                    ? 'Không tìm thấy tài nguyên'
                                                    : 'Chưa có tài nguyên cá nhân'}
                                            </EmptyTitle>
                                            <EmptyDescription>
                                                {searchQuery
                                                    ? 'Thử tìm với từ khóa khác.'
                                                    : 'Tải tệp mới để thêm tài nguyên vào thư viện.'}
                                            </EmptyDescription>
                                        </EmptyHeader>
                                    </Empty>
                                ))}
                        </div>

                        {mineAssetsQuery.isSuccess &&
                            personalAssets &&
                            personalAssets.meta.total > 0 && (
                                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-border border-t pt-3">
                                    <span className="text-muted-foreground text-sm">
                                        {personalAssets.meta.total} tài nguyên
                                    </span>
                                    {personalAssets.meta.totalPages > 1 && (
                                        <nav
                                            aria-label="Phân trang tài nguyên cá nhân"
                                            className="flex items-center gap-2"
                                        >
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon-sm"
                                                aria-label="Trang trước"
                                                disabled={page <= 1}
                                                onClick={() => setPage(page - 1)}
                                            >
                                                <ChevronLeft aria-hidden="true" />
                                            </Button>
                                            <span className="text-muted-foreground text-sm tabular-nums">
                                                {page} / {personalAssets.meta.totalPages}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon-sm"
                                                aria-label="Trang sau"
                                                disabled={page >= personalAssets.meta.totalPages}
                                                onClick={() => setPage(page + 1)}
                                            >
                                                <ChevronRight aria-hidden="true" />
                                            </Button>
                                        </nav>
                                    )}
                                </div>
                            )}
                    </div>
                )}

                {selectedAsset && (
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            promote(selectedAsset);
                        }}
                        className="flex min-h-0 flex-col gap-4"
                    >
                        <div className="-mx-1 min-h-0 space-y-4 overflow-y-auto px-1 pb-1">
                            <div className="rounded-lg bg-muted/40 p-3">
                                <LibraryAssetSummary asset={selectedAsset} />
                            </div>
                            {renderFields(selectedAsset.type, promoteMutation.isPending)}

                            <p className="m-0 rounded-lg bg-muted/40 p-3 text-muted-foreground text-sm">
                                Tài nguyên sẽ chuyển từ kho cá nhân sang thư viện dùng chung. Các
                                sách đang dùng tài nguyên vẫn hoạt động.
                            </p>
                        </div>
                        <DialogFooter className="mt-0 shrink-0 border-0 pt-0">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleBackToSelect}
                                disabled={promoteMutation.isPending}
                            >
                                Quay lại
                            </Button>
                            <Button type="submit" disabled={promoteMutation.isPending}>
                                {promoteMutation.isPending ? 'Đang thêm…' : 'Thêm vào thư viện'}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </LibraryAssetDialog>
            {discardUpload && (
                <ConfirmationDialog
                    title="Bỏ tệp đang chọn?"
                    description="Tệp này chưa được thêm vào kho cá nhân."
                    busy={false}
                    onClose={() => setDiscardUpload(null)}
                >
                    <DialogFooter className="mt-0 border-0 pt-0">
                        <Button
                            variant="outline"
                            data-initial-focus
                            onClick={() => setDiscardUpload(null)}
                        >
                            Tiếp tục tải
                        </Button>
                        <Button
                            onClick={() => {
                                setDiscardUpload(null);
                                discardUpload();
                            }}
                        >
                            Bỏ tệp
                        </Button>
                    </DialogFooter>
                </ConfirmationDialog>
            )}
        </>
    );
}
