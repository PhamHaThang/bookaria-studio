import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Folder, FolderTree, Pencil, Plus, Save, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CategoryCreateModal } from '../features/admin';
import { excludedParents } from '../features/admin/library-model';
import {
    CategorySelect,
    LibraryConfirm,
    libraryApi,
    useLibraryAction,
    WriteFeedback,
} from '../features/admin/library-ui';
import { AdminReload } from '../features/admin/ui';
import { assetKeys, assetsApi } from '../features/assets';
import { useAuth } from '../features/auth';
import { errorMessage } from '../shared/api/errors';
import {
    type CreateCategoryBody,
    CreateCategoryBodySchema,
    type UpdateCategoryBody,
    UpdateCategoryBodySchema,
} from '../shared/contracts/api/admin.schema';
import type { AssetCategory } from '../shared/contracts/dto.schema';
import { Badge } from '../shared/ui/Badge';
import { Button } from '../shared/ui/Button';
import { Feedback } from '../shared/ui/Feedback';
import { FormSelect } from '../shared/ui/FormSelect';
import { LoadingState } from '../shared/ui/LoadingState';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../shared/ui/primitives/empty';
import { Field, FieldGroup, FieldLabel } from '../shared/ui/primitives/field';
import { Input } from '../shared/ui/primitives/input';

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
}

/**
 * Thẻ hiển thị một danh mục tài nguyên.
 * Đồng bộ phong cách thẻ dữ liệu với trang /admin/users, /admin/books và /admin/library.
 */
function AdminCategoryItem({ category, categories, childCount }: AdminCategoryItemProps) {
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
                </div>
            </div>
        </li>
    );
}

export function AdminCategoriesPage() {
    const list = useCategories();
    const [searchQuery, setSearchQuery] = useState('');
    const [levelFilter, setLevelFilter] = useState<'all' | 'root' | 'child'>('all');
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    const categories = list.data || [];

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
                    <Button type="button" onClick={() => setIsCreateOpen(true)} className="gap-2">
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
                        <div className="relative mt-1.5">
                            <Search className="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                id="category-q"
                                placeholder="Tìm theo tên danh mục..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8 text-xs placeholder:text-xs"
                            />
                        </div>
                    </Field>

                    {/* 2. Lọc theo cấp danh mục */}
                    <Field orientation="contents">
                        <FieldLabel htmlFor="category-level" className="font-medium text-xs">
                            Cấp danh mục
                            <FormSelect
                                id="category-level"
                                value={levelFilter}
                                onValueChange={(val) =>
                                    setLevelFilter(val as 'all' | 'root' | 'child')
                                }
                                options={[
                                    { value: 'all', label: 'Tất cả danh mục' },
                                    { value: 'root', label: 'Chỉ danh mục gốc (không có cha)' },
                                    { value: 'child', label: 'Chỉ danh mục con' },
                                ]}
                            />
                        </FieldLabel>
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
            {list.isPending && <LoadingState layout="rows">Đang tải danh mục…</LoadingState>}
            {list.isError && <Feedback error={errorMessage(list.error)} />}

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
                                        onClick={() => setIsCreateOpen(true)}
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

            {/* Modal tạo danh mục mới */}
            <CategoryCreateModal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                categories={categories}
                onSuccess={() => void list.refetch()}
            />
        </div>
    );
}

function CategoryForm({
    categories,
    current,
}: {
    categories: AssetCategory[];
    current?: AssetCategory;
}) {
    const action = useLibraryAction();
    const navigate = useNavigate();
    const [draft, setDraft] = useState<CreateCategoryBody | UpdateCategoryBody | 'delete' | null>(
        null,
    );
    const [error, setError] = useState<string | null>(null);
    const excluded = current ? excludedParents(categories, current.id) : new Set<string>();

    return (
        <div className="space-y-6">
            {/* Tiêu đề & mô tả */}
            <div className="flex flex-col gap-1">
                <h1 className="font-semibold text-2xl text-foreground tracking-tight">
                    {current ? `Sửa danh mục: ${current.name}` : 'Tạo danh mục mới'}
                </h1>
                <p className="text-muted-foreground text-sm">
                    {current
                        ? 'Cập nhật tên, danh mục cha và thứ tự hiển thị của danh mục này.'
                        : 'Thiết lập danh mục mới để phân loại và quản lý tài nguyên trong thư viện.'}
                </p>
            </div>

            <WriteFeedback action={action} error={error} />

            {/* Form chỉnh sửa / tạo */}
            <form
                className="space-y-5 rounded-[var(--radius-lg)] border border-border bg-surface p-5 sm:p-6"
                onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    const name = String(data.get('name') || '').trim();
                    const parentId = String(data.get('parentId') || '') || null;
                    const sortOrder = Number(data.get('sortOrder'));

                    const parsed = current
                        ? UpdateCategoryBodySchema.safeParse({
                              ...(name !== current.name ? { name } : {}),
                              ...(parentId !== current.parentId ? { parentId } : {}),
                              ...(sortOrder !== current.sortOrder ? { sortOrder } : {}),
                          })
                        : CreateCategoryBodySchema.safeParse({ name, parentId });

                    if (!parsed.success) {
                        setError(errorMessage(parsed.error));
                        return;
                    }
                    setError(null);
                    setDraft(parsed.data);
                }}
            >
                <h2 className="font-semibold text-base text-foreground">Thông tin danh mục</h2>

                <FieldGroup className="gap-4">
                    <fieldset disabled={action.busy || action.uncertain} className="space-y-4">
                        {/* 1. Tên danh mục */}
                        <Field>
                            <FieldLabel htmlFor="category-name" className="font-medium text-xs">
                                Tên danh mục <span className="text-destructive">*</span>
                            </FieldLabel>
                            <Input
                                name="name"
                                id="category-name"
                                required
                                maxLength={100}
                                defaultValue={current?.name || ''}
                                placeholder="Ví dụ: Mô hình 3D, Âm thanh thiên nhiên..."
                                className="mt-1 h-9 text-xs placeholder:text-xs"
                            />
                        </Field>

                        {/* 2. Danh mục cha */}
                        <CategorySelect
                            name="parentId"
                            label="Danh mục cha (không bắt buộc)"
                            categories={categories}
                            value={current?.parentId || ''}
                            exclude={excluded}
                            emptyLabel="Không có (danh mục gốc)"
                        />

                        {/* 3. Thứ tự hiển thị */}
                        {current && (
                            <Field>
                                <FieldLabel
                                    htmlFor="category-order"
                                    className="font-medium text-xs"
                                >
                                    Thứ tự hiển thị
                                </FieldLabel>
                                <Input
                                    name="sortOrder"
                                    id="category-order"
                                    required
                                    type="number"
                                    step={1}
                                    min={-32768}
                                    max={32767}
                                    defaultValue={current.sortOrder}
                                    className="mt-1 h-9 text-xs"
                                />
                                <span className="mt-1 block text-[11px] text-muted-foreground">
                                    Số nhỏ hơn sẽ hiển thị trước trong danh sách chọn.
                                </span>
                            </Field>
                        )}

                        <div className="pt-2">
                            <Button type="submit" className="gap-2">
                                <Save className="h-4 w-4" data-icon="inline-start" />
                                {current ? 'Xem lại và lưu danh mục' : 'Xem lại và tạo danh mục'}
                            </Button>
                        </div>
                    </fieldset>
                </FieldGroup>
            </form>

            {/* Khối nguy hiểm: Xóa danh mục */}
            {current && (
                <section className="space-y-3 rounded-[var(--radius-lg)] border border-destructive/30 bg-destructive/5 p-5 sm:p-6">
                    <h2 className="font-semibold text-base text-destructive">Xóa danh mục</h2>
                    <p className="max-w-2xl text-muted-foreground text-xs leading-relaxed">
                        Chỉ xóa khi không còn danh mục con hoặc tài nguyên gắn với danh mục này.
                        Chuyển các mục sang danh mục khác trước khi thực hiện xóa.
                    </p>
                    <Button
                        variant="destructive"
                        size="sm"
                        className="h-8 gap-1.5 px-3 font-medium text-xs"
                        type="button"
                        disabled={action.busy || action.uncertain || excluded.size > 1}
                        onClick={() => setDraft('delete')}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Xóa danh mục
                    </Button>
                    {excluded.size > 1 && (
                        <p className="text-[11px] text-destructive">
                            Không thể xóa danh mục đang có danh mục con trực thuộc.
                        </p>
                    )}
                </section>
            )}

            {/* Hộp thoại xác nhận */}
            {draft && (
                <LibraryConfirm
                    title={
                        draft === 'delete'
                            ? 'Xóa danh mục?'
                            : current
                              ? 'Lưu thay đổi danh mục?'
                              : 'Tạo danh mục?'
                    }
                    busy={action.busy}
                    blocked={action.uncertain}
                    error={action.error}
                    onClose={() => setDraft(null)}
                    onConfirm={() =>
                        void action.run(
                            async () => {
                                if (draft === 'delete') {
                                    if (current) await libraryApi.removeCategory(current.id);
                                    return;
                                }
                                if (current) await libraryApi.updateCategory(current.id, draft);
                                else await libraryApi.createCategory(draft as CreateCategoryBody);
                            },
                            () => navigate('/admin/categories', { replace: true }),
                        )
                    }
                >
                    <p>{draft === 'delete' ? current?.name : draft.name || current?.name}</p>
                    {draft !== 'delete' && (
                        <p>
                            Danh mục cha:{' '}
                            {categories.find(
                                (item) =>
                                    item.id ===
                                    ((draft as UpdateCategoryBody).parentId === undefined
                                        ? current?.parentId
                                        : (draft as UpdateCategoryBody).parentId),
                            )?.name || 'Không có'}
                        </p>
                    )}
                    {draft !== 'delete' && current && (
                        <p>
                            Thứ tự hiển thị:{' '}
                            {(draft as UpdateCategoryBody).sortOrder ?? current.sortOrder}
                        </p>
                    )}
                    <p>
                        {draft === 'delete'
                            ? 'Danh mục này sẽ bị xóa khỏi cấu trúc dùng chung.'
                            : 'Cập nhật này áp dụng cho các màn chọn danh mục khi tải lại.'}
                    </p>
                </LibraryConfirm>
            )}
        </div>
    );
}

export function AdminCategoryEditPage() {
    const { categoryId } = useParams();
    const list = useCategories();
    const current = list.data?.find((item) => item.id === categoryId);

    return (
        <div className="mx-auto max-w-4xl space-y-6 p-6">
            {/* Thanh điều hướng quay lại */}
            <div className="flex items-center gap-2">
                <Link
                    to="/admin/categories"
                    className="inline-flex items-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Về danh mục tài nguyên</span>
                </Link>
            </div>

            {list.isPending && <LoadingState layout="detail">Đang tải danh mục…</LoadingState>}

            {list.isError && (
                <div className="space-y-3">
                    <Feedback error={errorMessage(list.error)} />
                    <AdminReload retry={() => void list.refetch()} busy={list.isFetching} />
                </div>
            )}

            {list.isSuccess &&
                (categoryId && !current ? (
                    <div className="rounded-[var(--radius-lg)] border border-destructive/20 bg-destructive/10 p-5">
                        <h1 className="font-semibold text-base text-destructive">
                            Không tìm thấy danh mục
                        </h1>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Danh mục này có thể đã bị xóa hoặc đường dẫn không chính xác.
                        </p>
                    </div>
                ) : (
                    <CategoryForm
                        key={current?.id || 'new'}
                        current={current}
                        categories={list.data}
                    />
                ))}
        </div>
    );
}
