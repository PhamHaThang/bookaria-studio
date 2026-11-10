import { useQueryClient } from '@tanstack/react-query';
import { FolderPlus, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { assetKeys } from '@/features/assets';
import { errorMessage } from '@/shared/api/errors';
import {
    type CreateCategoryBody,
    CreateCategoryBodySchema,
} from '@/shared/contracts/api/admin.schema';
import type { AssetCategory } from '@/shared/contracts/dto.schema';
import { Alert } from '@/shared/ui/Alert';
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

    const handleNameBlur = () => {
        const err = validateName(name);
        setFieldErrors((p) => ({ ...p, name: err }));
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
            <DialogContent className="max-h-[90dvh] max-w-[480px] space-y-4 overflow-y-auto p-5 sm:p-6">
                <DialogHeader className="gap-1 pb-0.5">
                    <DialogTitle className="m-0 flex items-center gap-2 font-semibold text-base text-foreground leading-tight sm:text-lg">
                        <FolderPlus className="h-4.5 w-4.5 shrink-0 text-primary" />
                        <span>Tạo danh mục mới</span>
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
                        Thiết lập danh mục để phân loại và quản lý tài nguyên trong thư viện dùng
                        chung.
                    </DialogDescription>
                </DialogHeader>

                {apiError && (
                    <Alert tone="danger" className="text-xs">
                        {apiError}
                    </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <FieldGroup className="gap-3.5">
                        {/* 1. Tên danh mục */}
                        <Field>
                            <FieldLabel
                                htmlFor="create-category-name"
                                className="font-medium text-xs"
                            >
                                Tên danh mục <span className="text-destructive">*</span>
                            </FieldLabel>
                            <Input
                                id="create-category-name"
                                value={name}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    handleNameChange(e.target.value)
                                }
                                onBlur={handleNameBlur}
                                maxLength={100}
                                disabled={createMutation.isPending}
                                placeholder="Ví dụ: Mô hình 3D, Âm thanh thiên nhiên..."
                                className="mt-1 h-8 text-xs placeholder:text-xs"
                                autoFocus
                            />
                            {fieldErrors.name && (
                                <FieldError className="m-0 mt-1 text-[11px]">
                                    {fieldErrors.name}
                                </FieldError>
                            )}
                        </Field>

                        {/* 2. Danh mục cha */}
                        <Field orientation="contents">
                            <FieldLabel
                                htmlFor="create-category-parent"
                                className="font-medium text-xs"
                            >
                                Danh mục cha (không bắt buộc)
                                <FormSelect
                                    id="create-category-parent"
                                    value={parentId}
                                    onValueChange={(val) => setParentId(val)}
                                    options={categoryOptions}
                                    disabled={createMutation.isPending}
                                />
                            </FieldLabel>
                        </Field>
                    </FieldGroup>

                    <DialogFooter className="mt-2 flex-row justify-end gap-2 border-border/60 border-t pt-2">
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-8 px-3 text-xs"
                            onClick={handleClose}
                            disabled={createMutation.isPending}
                        >
                            Hủy bỏ
                        </Button>
                        <Button
                            type="submit"
                            size="sm"
                            className="h-8 gap-1.5 px-3.5 font-medium text-xs"
                            disabled={createMutation.isPending}
                        >
                            <Plus className="h-3.5 w-3.5" />
                            <span>{createMutation.isPending ? 'Đang tạo...' : 'Tạo danh mục'}</span>
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
