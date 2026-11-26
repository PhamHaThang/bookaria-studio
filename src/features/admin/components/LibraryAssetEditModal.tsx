import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { assetKeys, assetsApi } from '@/features/assets';
import { useAuth } from '@/features/auth';
import { errorMessage } from '@/shared/api/errors';
import {
    type UpdateLibraryAssetBody,
    UpdateLibraryAssetBodySchema,
} from '@/shared/contracts/api/admin.schema';
import type { Asset } from '@/shared/contracts/dto.schema';
import { AUDIO_TAG_OPTIONS, audioKindFromTags } from '@/shared/scene/audio-kind';
import { Button } from '@/shared/ui/Button';
import { Feedback } from '@/shared/ui/Feedback';
import { FormSelect } from '@/shared/ui/FormSelect';
import { DialogFooter } from '@/shared/ui/primitives/dialog';
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { libraryApi } from '../library-ui';
import { useAdminMutation as useMutation } from '../use-admin-mutation';
import { LibraryAssetDialog, LibraryAssetSummary } from './LibraryAssetDialog';
import { LibraryLicenseField } from './LibraryLicenseField';

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
        <LibraryAssetDialog
            open={isOpen}
            busy={editMutation.isPending}
            title="Chỉnh sửa tài nguyên"
            description="Cập nhật danh mục, giấy phép và thông tin tác giả."
            onClose={onClose}
        >
            <Feedback error={apiError} errorMode="toast" />
            <form onSubmit={handleSubmit} className="flex min-h-0 flex-col gap-4">
                <div className="-mx-1 min-h-0 space-y-4 overflow-y-auto px-1 pb-1">
                    <div className="rounded-lg bg-muted/40 p-3">
                        <LibraryAssetSummary asset={asset} />
                    </div>
                    <FieldGroup className="gap-4">
                        {/* Tên tài nguyên */}
                        <Field>
                            <FieldLabel htmlFor="edit-asset-name">
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
                                placeholder="Nhập tên tài nguyên..."
                            />
                            {fieldErrors.name && <FieldError>{fieldErrors.name}</FieldError>}
                        </Field>

                        {/* Danh mục */}
                        <Field>
                            <FieldLabel htmlFor="edit-asset-category">Danh mục</FieldLabel>
                            <FormSelect
                                id="edit-asset-category"
                                value={categoryId}
                                onValueChange={setCategoryId}
                                options={[
                                    { value: '', label: 'Không phân danh mục' },
                                    ...categories.map((cat) => ({
                                        value: cat.id,
                                        label: cat.name,
                                    })),
                                ]}
                                disabled={editMutation.isPending}
                            />
                        </Field>

                        <LibraryLicenseField
                            key={asset.id}
                            id="edit-asset-license"
                            value={license}
                            onValueChange={(value) => {
                                setLicense(value);
                                if (fieldErrors.license)
                                    setFieldErrors((p) => ({ ...p, license: '' }));
                            }}
                            disabled={editMutation.isPending}
                            error={fieldErrors.license}
                        />

                        <Field>
                            <FieldLabel htmlFor="edit-asset-author">
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
                                placeholder="Tên tác giả..."
                            />
                            {fieldErrors.authorName && (
                                <FieldError>{fieldErrors.authorName}</FieldError>
                            )}
                        </Field>

                        {/* Nguồn liên kết */}
                        <Field>
                            <FieldLabel htmlFor="edit-asset-source">
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
                                placeholder="https://..."
                            />
                        </Field>

                        {/* Nhãn Tags */}
                        <Field>
                            <FieldLabel htmlFor="edit-asset-tags">
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
                                    placeholder="ví dụ: phong cảnh, thiên nhiên, 3d..."
                                />
                            )}
                            {asset.type !== 'AUDIO' && (
                                <FieldDescription className="text-xs">
                                    Tối đa 20 nhãn, mỗi nhãn không quá 30 ký tự.
                                </FieldDescription>
                            )}
                        </Field>
                    </FieldGroup>
                </div>
                <DialogFooter className="mt-0 shrink-0 border-0 pt-0">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={editMutation.isPending}
                    >
                        Hủy
                    </Button>
                    <Button type="submit" disabled={editMutation.isPending}>
                        {editMutation.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}
                    </Button>
                </DialogFooter>
            </form>
        </LibraryAssetDialog>
    );
}
