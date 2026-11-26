import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { AssetThumbnail, assetKeys, assetsApi, assetTypeLabels } from '@/features/assets';
import { useAuth } from '@/features/auth';
import { errorMessage } from '@/shared/api/errors';
import {
    type UpdateLibraryAssetBody,
    UpdateLibraryAssetBodySchema,
} from '@/shared/contracts/api/admin.schema';
import type { Asset } from '@/shared/contracts/dto.schema';
import { formatBytes } from '@/shared/lib/format';
import { AUDIO_TAG_OPTIONS, audioKindFromTags } from '@/shared/scene/audio-kind';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { FormSelect } from '@/shared/ui/FormSelect';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/shared/ui/primitives/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { libraryApi } from '../library-ui';
import { useAdminMutation as useMutation } from '../use-admin-mutation';

export interface LibraryAssetEditModalProps {
    asset: Asset | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export function LibraryAssetEditModal({
    asset,
    isOpen,
    onClose,
    onSuccess,
}: LibraryAssetEditModalProps) {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const [name, setName] = useState('');
    const [categoryId, setCategoryId] = useState<string>('');
    const [license, setLicense] = useState('');
    const [authorName, setAuthorName] = useState('');
    const [sourceUrl, setSourceUrl] = useState('');
    const [tags, setTags] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [apiError, setApiError] = useState<string | null>(null);

    const categoriesQuery = useQuery({
        queryKey: assetKeys.categories(user?.id || ''),
        queryFn: ({ signal }) => assetsApi.categories(signal),
        enabled: isOpen,
    });

    useEffect(() => {
        if (asset && isOpen) {
            setName(asset.name || '');
            setCategoryId(asset.categoryId || '');
            setLicense(asset.license || '');
            setAuthorName(asset.authorName || '');
            setSourceUrl(asset.sourceUrl || '');
            if (asset.type === 'AUDIO') {
                setTags(audioKindFromTags(asset.tags).toLowerCase());
            } else {
                setTags(asset.tags?.join(', ') || '');
            }
            setFieldErrors({});
            setApiError(null);
        }
    }, [asset, isOpen]);

    const editMutation = useMutation({
        mutationFn: async () => {
            if (!asset) throw new Error('Không tìm thấy tài nguyên');

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

            const payload: UpdateLibraryAssetBody = {
                name: trimmedName,
                categoryId: categoryId || null,
                license: trimmedLicense,
                authorName: trimmedAuthor,
                sourceUrl: trimmedSource || null,
                tags: rawTags,
            };

            const parsed = UpdateLibraryAssetBodySchema.safeParse(payload);
            if (!parsed.success) {
                throw new Error(errorMessage(parsed.error));
            }

            return libraryApi.update(asset.id, parsed.data);
        },
        onSuccess: () => {
            toast.success(`Đã cập nhật thông tin tài nguyên "${asset?.name}".`);
            void queryClient.invalidateQueries({ queryKey: ['admin'] });
            void queryClient.invalidateQueries({ queryKey: assetKeys.all });
            onSuccess?.();
            onClose();
        },
        onError: (err: unknown) => {
            setApiError(errorMessage(err));
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setFieldErrors({});
        setApiError(null);
        editMutation.mutate();
    };

    if (!asset) return null;

    const categories = categoriesQuery.data || [];

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open: boolean) => {
                if (!open && !editMutation.isPending) {
                    onClose();
                }
            }}
        >
            <DialogContent className="max-h-[88dvh] max-w-[460px] space-y-4 overflow-y-auto p-5">
                <DialogHeader className="gap-1 pb-0.5">
                    <DialogTitle className="m-0 flex items-center gap-2 font-semibold text-base text-foreground leading-tight sm:text-lg">
                        <Pencil className="h-4.5 w-4.5 shrink-0 text-primary" />
                        <span>Chỉnh sửa thông tin tài nguyên</span>
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
                        Cập nhật tên, danh mục, giấy phép và thông tin ghi công của tài nguyên dùng
                        chung.
                    </DialogDescription>
                </DialogHeader>

                {/* Thẻ tóm tắt tài nguyên */}
                <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-surface/40 p-2.5">
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border/60 bg-muted/60">
                        <AssetThumbnail asset={asset} variant="compact" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                            <span className="truncate font-semibold text-foreground text-sm">
                                {asset.name}
                            </span>
                            <Badge tone="neutral" className="h-4.5 px-1.5 font-normal text-[10px]">
                                {assetTypeLabels[asset.type] || asset.type}
                            </Badge>
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground">
                            {formatBytes(asset.sizeBytes)} • Định dạng .{asset.format.toUpperCase()}
                        </p>
                    </div>
                </div>

                {apiError && (
                    <div className="rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-destructive text-xs">
                        {apiError}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3">
                    <FieldGroup className="space-y-3">
                        {/* Tên tài nguyên */}
                        <Field>
                            <FieldLabel htmlFor="edit-asset-name" className="font-medium text-xs">
                                Tên tài nguyên <span className="text-destructive">*</span>
                            </FieldLabel>
                            <Input
                                id="edit-asset-name"
                                value={name}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    setName(e.target.value);
                                    if (fieldErrors.name)
                                        setFieldErrors((p) => ({ ...p, name: '' }));
                                }}
                                maxLength={150}
                                disabled={editMutation.isPending}
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
                                htmlFor="edit-asset-category"
                                className="font-medium text-xs"
                            >
                                Danh mục thư viện
                                <FormSelect
                                    id="edit-asset-category"
                                    value={categoryId}
                                    onValueChange={(val) => setCategoryId(val)}
                                    options={[
                                        { value: '', label: 'Không phân danh mục' },
                                        ...categories.map((cat) => ({
                                            value: cat.id,
                                            label: cat.name,
                                        })),
                                    ]}
                                    disabled={editMutation.isPending}
                                />
                            </FieldLabel>
                        </Field>

                        {/* Giấy phép & Tác giả 2 cột */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <Field>
                                <FieldLabel
                                    htmlFor="edit-asset-license"
                                    className="font-medium text-xs"
                                >
                                    Giấy phép sử dụng <span className="text-destructive">*</span>
                                </FieldLabel>
                                <Input
                                    id="edit-asset-license"
                                    value={license}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        setLicense(e.target.value);
                                        if (fieldErrors.license)
                                            setFieldErrors((p) => ({ ...p, license: '' }));
                                    }}
                                    maxLength={50}
                                    disabled={editMutation.isPending}
                                    className="mt-1 h-8 text-xs placeholder:text-xs"
                                    placeholder="Ví dụ: CC-BY, CC0..."
                                />
                                {fieldErrors.license && (
                                    <FieldError className="m-0 mt-1 text-[11px]">
                                        {fieldErrors.license}
                                    </FieldError>
                                )}
                            </Field>

                            <Field>
                                <FieldLabel
                                    htmlFor="edit-asset-author"
                                    className="font-medium text-xs"
                                >
                                    Tác giả gốc <span className="text-destructive">*</span>
                                </FieldLabel>
                                <Input
                                    id="edit-asset-author"
                                    value={authorName}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        setAuthorName(e.target.value);
                                        if (fieldErrors.authorName)
                                            setFieldErrors((p) => ({ ...p, authorName: '' }));
                                    }}
                                    maxLength={150}
                                    disabled={editMutation.isPending}
                                    className="mt-1 h-8 text-xs placeholder:text-xs"
                                    placeholder="Tên tác giả..."
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
                            <FieldLabel htmlFor="edit-asset-source" className="font-medium text-xs">
                                Liên kết nguồn gốc{' '}
                                <span className="font-normal text-muted-foreground">
                                    (không bắt buộc)
                                </span>
                            </FieldLabel>
                            <Input
                                id="edit-asset-source"
                                type="url"
                                value={sourceUrl}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    setSourceUrl(e.target.value)
                                }
                                disabled={editMutation.isPending}
                                className="mt-1 h-8 text-xs placeholder:text-xs"
                                placeholder="https://..."
                            />
                        </Field>

                        {/* Nhãn Tags */}
                        <Field>
                            <FieldLabel htmlFor="edit-asset-tags" className="font-medium text-xs">
                                {asset.type === 'AUDIO'
                                    ? 'Loại âm thanh'
                                    : 'Nhãn (ngăn cách bởi dấu phẩy)'}
                            </FieldLabel>
                            {asset.type === 'AUDIO' ? (
                                <FormSelect
                                    id="edit-asset-tags"
                                    value={tags}
                                    onValueChange={(val) => setTags(val)}
                                    options={AUDIO_TAG_OPTIONS}
                                    disabled={editMutation.isPending}
                                />
                            ) : (
                                <Input
                                    id="edit-asset-tags"
                                    value={tags}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                        setTags(e.target.value)
                                    }
                                    disabled={editMutation.isPending}
                                    className="mt-1 h-8 text-xs placeholder:text-xs"
                                    placeholder="ví dụ: phong cảnh, thiên nhiên, 3d..."
                                />
                            )}
                            <span className="mt-1 block text-[11px] text-muted-foreground">
                                Tối đa 20 nhãn, mỗi nhãn không quá 30 ký tự.
                            </span>
                        </Field>
                    </FieldGroup>

                    <DialogFooter className="mt-2 flex-row justify-end gap-2 border-border/60 border-t pt-2">
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-8 px-3 text-xs"
                            onClick={onClose}
                            disabled={editMutation.isPending}
                        >
                            Hủy bỏ
                        </Button>
                        <Button
                            type="submit"
                            size="sm"
                            className="h-8 px-3.5 font-medium text-xs"
                            disabled={editMutation.isPending}
                        >
                            {editMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
