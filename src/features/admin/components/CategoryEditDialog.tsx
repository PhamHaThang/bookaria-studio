import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/shared/api/errors';
import { UpdateCategoryBodySchema } from '@/shared/contracts/api/admin.schema';
import type { AssetCategory } from '@/shared/contracts/dto.schema';
import { Button } from '@/shared/ui/Button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/shared/ui/primitives/dialog';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { excludedParents } from '../library-model';
import { CategorySelect, libraryApi, type useLibraryAction, WriteFeedback } from '../library-ui';

export function CategoryEditDialog({
    current,
    categories,
    action,
    onClose,
}: {
    current: AssetCategory | undefined;
    categories: AssetCategory[];
    action: ReturnType<typeof useLibraryAction>;
    onClose: () => void;
}) {
    const [error, setError] = useState<string | null>(null);

    function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!current || action.busy || action.uncertain) return;

        const data = new FormData(event.currentTarget);
        const name = String(data.get('name') || '').trim();
        const parentId = String(data.get('parentId') || '') || null;
        const sortOrder = Number(data.get('sortOrder'));
        const parsed = UpdateCategoryBodySchema.safeParse({
            ...(name !== current.name ? { name } : {}),
            ...(parentId !== current.parentId ? { parentId } : {}),
            ...(sortOrder !== current.sortOrder ? { sortOrder } : {}),
        });
        if (!parsed.success) {
            setError(errorMessage(parsed.error));
            return;
        }

        setError(null);
        void action.run(
            () => libraryApi.updateCategory(current.id, parsed.data),
            () => {
                toast.success('Đã lưu danh mục.');
                onClose();
            },
        );
    }

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open && !action.busy) onClose();
            }}
        >
            <DialogContent
                showCloseButton={!action.busy}
                className="max-h-[90dvh] gap-4 overflow-y-auto p-5 sm:p-6"
            >
                <DialogHeader>
                    <DialogTitle className="pr-8">
                        {current ? 'Chỉnh sửa danh mục' : 'Không tìm thấy danh mục'}
                    </DialogTitle>
                    <DialogDescription>
                        {current
                            ? 'Cập nhật tên, danh mục cha và thứ tự hiển thị.'
                            : 'Danh mục này có thể đã bị xóa hoặc đường dẫn không chính xác.'}
                    </DialogDescription>
                </DialogHeader>
                <WriteFeedback action={action} error={error} />
                {current && (
                    <form onSubmit={save}>
                        <fieldset disabled={action.busy || action.uncertain}>
                            <FieldGroup className="gap-4">
                                <Field>
                                    <FieldLabel htmlFor="edit-category-name">
                                        Tên danh mục
                                    </FieldLabel>
                                    <Input
                                        id="edit-category-name"
                                        name="name"
                                        required
                                        maxLength={100}
                                        defaultValue={current.name}
                                    />
                                </Field>
                                <CategorySelect
                                    name="parentId"
                                    label="Danh mục cha"
                                    labelClassName="mb-0"
                                    categories={categories}
                                    value={current.parentId || ''}
                                    exclude={excludedParents(categories, current.id)}
                                    emptyLabel="Không có (danh mục gốc)"
                                />
                                <Field>
                                    <FieldLabel htmlFor="edit-category-order">
                                        Thứ tự hiển thị
                                    </FieldLabel>
                                    <Input
                                        id="edit-category-order"
                                        name="sortOrder"
                                        type="number"
                                        required
                                        step={1}
                                        min={-32768}
                                        max={32767}
                                        defaultValue={current.sortOrder}
                                    />
                                </Field>
                            </FieldGroup>
                        </fieldset>
                        <DialogFooter className="mt-5 border-0 pt-0">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={action.busy}
                                onClick={onClose}
                            >
                                Hủy
                            </Button>
                            <Button type="submit" disabled={action.busy || action.uncertain}>
                                {action.busy ? 'Đang lưu…' : 'Lưu thay đổi'}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
