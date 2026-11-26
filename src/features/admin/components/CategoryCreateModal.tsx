import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { assetKeys } from '@/features/assets';
import { errorMessage } from '@/shared/api/errors';
import {
    type CreateCategoryBody,
    CreateCategoryBodySchema,
} from '@/shared/contracts/api/admin.schema';
import type { AssetCategory } from '@/shared/contracts/dto.schema';
import { Button } from '@/shared/ui/Button';
import { Feedback } from '@/shared/ui/Feedback';
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

export interface CategoryCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: (createdCategoryId?: string) => void;
    categories?: AssetCategory[];
}

export function CategoryCreateModal({
    isOpen,
    onClose,
    onSuccess,
    categories,
}: CategoryCreateModalProps) {
    const queryClient = useQueryClient();
    const [name, setName] = useState('');
    const [parentId, setParentId] = useState('');
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [apiError, setApiError] = useState<string | null>(null);

    const validateName = (val: string) => {
        const trimmed = val.trim();
        if (!trimmed) return 'Tên danh mục không được để trống';
        if (trimmed.length > 100) return 'Tên danh mục tối đa 100 ký tự';
        return '';
    };

    const handleNameChange = (val: string) => {
        setName(val);
        if (fieldErrors.name) {
            const err = validateName(val);
            setFieldErrors((p) => ({ ...p, name: err }));
        }
    };

    const handleClose = () => {
        setName('');
        setParentId('');
        setFieldErrors({});
        setApiError(null);
        onClose();
    };

    const createMutation = useMutation({
        mutationFn: async () => {
            const trimmedName = name.trim();
            if (!trimmedName) {
                setFieldErrors({ name: 'Tên danh mục không được để trống' });
                throw new Error('Vui lòng nhập tên danh mục');
            }

            const payload: CreateCategoryBody = {
                name: trimmedName,
                parentId: parentId || null,
            };

            const parsed = CreateCategoryBodySchema.safeParse(payload);
            if (!parsed.success) {
                throw new Error(errorMessage(parsed.error));
            }

            return libraryApi.createCategory(parsed.data);
        },
        onSuccess: (result) => {
            toast.success(`Đã tạo danh mục "${result.name}" thành công!`);
            void queryClient.invalidateQueries({ queryKey: assetKeys.all });
            void queryClient.invalidateQueries({ queryKey: ['admin'] });
            onSuccess?.(result.id);
            handleClose();
        },
        onError: (err: unknown) => {
            setApiError(errorMessage(err));
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setApiError(null);
        const err = validateName(name);
        if (err) {
            setFieldErrors({ name: err });
            return;
        }
        createMutation.mutate();
    };

    const categoryOptions = [
        { value: '', label: 'Không có (danh mục gốc)' },
        ...(categories || []).map((cat) => ({
            value: cat.id,
            label: cat.parentId
                ? `${cat.name} (trong ${categories?.find((p) => p.id === cat.parentId)?.name || 'danh mục cha'})`
                : cat.name,
        })),
    ];

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open: boolean) => {
                if (!open && !createMutation.isPending) {
                    handleClose();
                }
            }}
        >
            <DialogContent
                showCloseButton={!createMutation.isPending}
                className="max-h-[90dvh] gap-4 overflow-y-auto p-5 sm:p-6"
            >
                <DialogHeader>
                    <DialogTitle className="pr-8">Tạo danh mục mới</DialogTitle>
                    <DialogDescription>
                        Tạo danh mục để phân loại tài nguyên dùng chung.
                    </DialogDescription>
                </DialogHeader>

                <Feedback error={apiError} errorMode="toast" />

                <form onSubmit={handleSubmit}>
                    <FieldGroup className="gap-4">
                        <Field>
                            <FieldLabel htmlFor="create-category-name">Tên danh mục</FieldLabel>
                            <Input
                                id="create-category-name"
                                value={name}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    handleNameChange(e.target.value)
                                }
                                aria-invalid={Boolean(fieldErrors.name)}
                                aria-describedby={
                                    fieldErrors.name ? 'create-category-name-error' : undefined
                                }
                                maxLength={100}
                                disabled={createMutation.isPending}
                                placeholder="Ví dụ: Mô hình 3D, Âm thanh thiên nhiên..."
                                autoFocus
                            />
                            {fieldErrors.name && (
                                <FieldError id="create-category-name-error">
                                    {fieldErrors.name}
                                </FieldError>
                            )}
                        </Field>

                        <Field>
                            <FieldLabel htmlFor="create-category-parent">Danh mục cha</FieldLabel>
                            <FormSelect
                                id="create-category-parent"
                                value={parentId}
                                onValueChange={setParentId}
                                options={categoryOptions}
                                disabled={createMutation.isPending}
                            />
                        </Field>
                    </FieldGroup>

                    <DialogFooter className="mt-5 border-0 pt-0">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={createMutation.isPending}
                        >
                            Hủy
                        </Button>
                        <Button type="submit" disabled={createMutation.isPending}>
                            {createMutation.isPending ? 'Đang tạo…' : 'Tạo danh mục'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
