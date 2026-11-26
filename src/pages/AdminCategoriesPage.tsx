import { useQuery } from '@tanstack/react-query';
import { Folder, FolderTree, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CategoryCreateModal } from '../features/admin';
import { CategoryEditDialog } from '../features/admin/components/CategoryEditDialog';
import { libraryApi, useLibraryAction, WriteFeedback } from '../features/admin/library-ui';
import { AdminReload } from '../features/admin/ui';
import { assetKeys, assetsApi } from '../features/assets';
import { useAuth } from '../features/auth';
import { errorMessage } from '../shared/api/errors';
import type { AssetCategory } from '../shared/contracts/dto.schema';
import { Badge } from '../shared/ui/Badge';
import { Button } from '../shared/ui/Button';
import { ConfirmationDialog } from '../shared/ui/ConfirmationDialog';
import { Feedback } from '../shared/ui/Feedback';
import { FormSelect } from '../shared/ui/FormSelect';
import { LoadingState } from '../shared/ui/LoadingState';
import { AlertDialogFooter } from '../shared/ui/primitives/alert-dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../shared/ui/primitives/empty';
import { Field, FieldGroup, FieldLabel } from '../shared/ui/primitives/field';
import { SearchInput } from '../shared/ui/SearchInput';

function useCategories() {
    const { user } = useAuth();
    return useQuery({
        queryKey: assetKeys.categories(user?.id || ''),
        queryFn: ({ signal }) => assetsApi.categories(signal),
    });
}

interface AdminCategoryItemProps {
    category: AssetCategory;
    categories: AssetCategory[];
    childCount: number;
    onDelete: () => void;
}

/**
 * Thẻ hiển thị một danh mục tài nguyên.
 * Đồng bộ phong cách thẻ dữ liệu với trang /admin/users, /admin/books và /admin/library.
 */
function AdminCategoryItem({ category, categories, childCount, onDelete }: AdminCategoryItemProps) {
    const isRoot = !category.parentId;
    const parentCategory = category.parentId
        ? categories.find((c) => c.id === category.parentId)
        : null;

    return (
        <li className="group rounded-[var(--radius-lg)] border border-border bg-surface p-5 transition-all hover:border-primary/40 hover:shadow-xs">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                {/* Biểu tượng + Thông tin danh mục */}
                <div className="flex min-w-0 flex-1 items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border bg-muted/40 text-primary shadow-xs">
                        {isRoot ? (
                            <FolderTree className="h-6 w-6" />
                        ) : (
                            <Folder className="h-6 w-6" />
                        )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                            <Link
                                to={`/admin/categories/${category.id}`}
                                className="truncate text-left font-semibold text-base text-foreground transition-colors hover:text-primary focus-visible:underline focus-visible:outline-none"
                            >
                                {category.name}
                            </Link>

                            {isRoot ? (
                                <Badge
                                    tone="info"
                                    className="gap-1 px-2.5 py-0.5 font-medium text-xs"
                                >
                                    <FolderTree className="h-3 w-3" />
                                    Danh mục gốc
                                </Badge>
                            ) : (
                                <Badge
                                    tone="neutral"
                                    className="gap-1 px-2.5 py-0.5 font-medium text-xs"
                                >
                                    <Folder className="h-3 w-3" />
                                    Thuộc: {parentCategory?.name || 'Danh mục cha'}
                                </Badge>
                            )}
                        </div>

                        {/* Thông tin phụ: thứ tự hiển thị & số danh mục con */}
                        <div className="flex flex-wrap items-center gap-2.5 text-muted-foreground text-xs">
                            <span>
                                Thứ tự hiển thị:{' '}
                                <strong className="text-foreground">{category.sortOrder}</strong>
                            </span>
                            {childCount > 0 && (
                                <>
                                    <span>•</span>
                                    <span className="font-medium text-primary">
                                        {childCount} danh mục con
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Nút hành động */}
                <div className="flex shrink-0 items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="h-8 gap-1.5 px-3 text-xs"
                    >
                        <Link to={`/admin/categories/${category.id}`}>
                            <Pencil className="h-3.5 w-3.5" />
                            Chỉnh sửa
                        </Link>
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 px-3 text-destructive text-xs hover:text-destructive"
                        aria-label={`Xóa danh mục ${category.name}`}
                        title={childCount ? 'Hãy chuyển hoặc xóa danh mục con trước' : undefined}
                        disabled={childCount > 0}
                        onClick={onDelete}
                    >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Xóa
                    </Button>
                </div>
            </div>
        </li>
    );
}

export function AdminCategoriesPage() {
    const list = useCategories();
    const { categoryId } = useParams();
    const navigate = useNavigate();
    const action = useLibraryAction();
    const [searchQuery, setSearchQuery] = useState('');
    const [levelFilter, setLevelFilter] = useState<'all' | 'root' | 'child'>('all');
    const [categoryToDelete, setCategoryToDelete] = useState<AssetCategory | null>(null);

    const categories = list.data || [];
    const isCreateOpen = categoryId === 'new';
    const isEditOpen = Boolean(categoryId && !isCreateOpen && list.isSuccess);
    const current = categories.find((category) => category.id === categoryId);
    const closeEditor = () => navigate('/admin/categories', { replace: true });

    // Tính số danh mục con cho từng danh mục
    const childCountMap = useMemo(() => {
        const counts = new Map<string, number>();
        categories.forEach((cat) => {
            if (cat.parentId) {
                counts.set(cat.parentId, (counts.get(cat.parentId) || 0) + 1);
            }
        });
        return counts;
    }, [categories]);

    // Lọc danh mục theo tìm kiếm và cấp phân loại
    const filteredCategories = useMemo(() => {
        return categories.filter((item) => {
            if (searchQuery.trim()) {
                const term = searchQuery.toLowerCase().trim();
                if (!item.name.toLowerCase().includes(term)) return false;
            }
            if (levelFilter === 'root' && item.parentId) return false;
            if (levelFilter === 'child' && !item.parentId) return false;
            return true;
        });
    }, [categories, searchQuery, levelFilter]);

    return (
        <div className="mx-auto max-w-6xl space-y-6 p-6">
            {/* Header: Tiêu đề & Nút Tạo mới */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="font-semibold text-2xl text-foreground tracking-tight">
                        Danh mục tài nguyên
                    </h1>
                    <p className="mt-1 text-muted-foreground text-sm">
                        Cấu trúc phân cấp dùng chung cho thư viện và bộ chọn tài nguyên.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        type="button"
                        onClick={() => navigate('/admin/categories/new')}
                        className="gap-2"
                    >
                        <Plus className="h-4 w-4" data-icon="inline-start" />
                        Tạo danh mục
                    </Button>
                </div>
            </div>

            {/* Thanh Bộ lọc & Tìm kiếm đồng bộ với AdminUsersPage / AdminLibraryPage */}
            <form
                className="rounded-[var(--radius-lg)] border border-border bg-surface p-4"
                onSubmit={(event) => event.preventDefault()}
            >
                <FieldGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {/* 1. Tìm kiếm theo tên */}
                    <Field>
                        <FieldLabel htmlFor="category-q" className="font-medium text-xs">
                            Tìm kiếm danh mục
                        </FieldLabel>
                        <SearchInput
                            id="category-q"
                            placeholder="Tìm theo tên danh mục..."
                            value={searchQuery}
                            onValueChange={setSearchQuery}
                        />
                    </Field>

                    {/* 2. Lọc theo cấp danh mục */}
                    <Field>
                        <FieldLabel htmlFor="category-level" className="font-medium text-xs">
                            Cấp danh mục
                        </FieldLabel>
                        <FormSelect
                            id="category-level"
                            value={levelFilter}
                            onValueChange={(val) => setLevelFilter(val as 'all' | 'root' | 'child')}
                            options={[
                                { value: 'all', label: 'Tất cả danh mục' },
                                { value: 'root', label: 'Chỉ danh mục gốc (không có cha)' },
                                { value: 'child', label: 'Chỉ danh mục con' },
                            ]}
                        />
                    </Field>
                </FieldGroup>

                {/* Footer bar của filter: thông tin & Đặt lại bộ lọc */}
                <div className="mt-3 flex items-center justify-between border-border border-t pt-3 text-xs">
                    <span className="text-muted-foreground">
                        Cấu trúc cây danh mục phục vụ bộ lọc tìm kiếm và phân loại tài nguyên dùng
                        chung.
                    </span>
                    {(searchQuery || levelFilter !== 'all') && (
                        <button
                            type="button"
                            onClick={() => {
                                setSearchQuery('');
                                setLevelFilter('all');
                            }}
                            className="font-medium text-primary hover:underline"
                        >
                            Đặt lại bộ lọc
                        </button>
                    )}
                </div>
            </form>

            {/* Trạng thái tải & Báo lỗi */}
            {list.isPending && <LoadingState layout="admin-rows">Đang tải danh mục…</LoadingState>}
            {list.isError && <Feedback error={errorMessage(list.error)} errorMode="toast" />}
            {!isEditOpen && !categoryToDelete && <WriteFeedback action={action} />}

            {/* Danh sách danh mục */}
            {list.isSuccess && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between text-muted-foreground text-xs">
                        <span>
                            Hiển thị{' '}
                            <strong className="text-foreground">{filteredCategories.length}</strong>{' '}
                            trên <strong className="text-foreground">{categories.length}</strong>{' '}
                            danh mục
                        </span>
                        <AdminReload retry={() => void list.refetch()} busy={list.isFetching} />
                    </div>

                    {filteredCategories.length ? (
                        <ul className="list-none space-y-3 p-0">
                            {filteredCategories.map((item) => (
                                <AdminCategoryItem
                                    key={item.id}
                                    category={item}
                                    categories={categories}
                                    childCount={childCountMap.get(item.id) || 0}
                                    onDelete={() => setCategoryToDelete(item)}
                                />
                            ))}
                        </ul>
                    ) : (
                        <Empty className="empty-state px-5 py-16">
                            <EmptyHeader>
                                <EmptyTitle>
                                    <h2>Chưa có danh mục phù hợp</h2>
                                </EmptyTitle>
                                <EmptyDescription>
                                    <p>
                                        Thử tìm kiếm với từ khóa khác hoặc tạo danh mục mới để phân
                                        loại tài nguyên.
                                    </p>
                                </EmptyDescription>
                            </EmptyHeader>
                            {!searchQuery && levelFilter === 'all' && (
                                <div className="mt-4 flex justify-center">
                                    <Button
                                        type="button"
                                        onClick={() => navigate('/admin/categories/new')}
                                        className="gap-2"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Tạo danh mục đầu tiên
                                    </Button>
                                </div>
                            )}
                        </Empty>
                    )}
                </div>
            )}

            {isCreateOpen && (
                <CategoryCreateModal isOpen onClose={closeEditor} categories={categories} />
            )}
            {isEditOpen && (
                <CategoryEditDialog
                    key={categoryId}
                    current={current}
                    categories={categories}
                    action={action}
                    onClose={closeEditor}
                />
            )}
            {categoryToDelete && (
                <ConfirmationDialog
                    title="Xóa danh mục?"
                    description={
                        <p className="wrap-anywhere m-0">
                            Danh mục <strong>{categoryToDelete.name}</strong> sẽ bị xóa khỏi thư
                            viện. Danh mục phải trống trước khi xóa.
                        </p>
                    }
                    busy={action.busy}
                    onClose={() => setCategoryToDelete(null)}
                >
                    <WriteFeedback action={action} />
                    <AlertDialogFooter className="mt-0 border-0 pt-0">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={action.busy}
                            onClick={() => setCategoryToDelete(null)}
                            data-initial-focus
                        >
                            Hủy
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            disabled={
                                action.busy ||
                                action.uncertain ||
                                childCountMap.has(categoryToDelete.id)
                            }
                            onClick={() =>
                                void action.run(
                                    () => libraryApi.removeCategory(categoryToDelete.id),
                                    () => {
                                        setCategoryToDelete(null);
                                        toast.success('Đã xóa danh mục.');
                                    },
                                )
                            }
                        >
                            {action.busy ? 'Đang xóa…' : 'Xóa danh mục'}
                        </Button>
                    </AlertDialogFooter>
                </ConfirmationDialog>
            )}
        </div>
    );
}
