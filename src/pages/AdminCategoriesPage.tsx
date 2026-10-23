import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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
import { Feedback } from '../shared/ui/Feedback';

function useCategories() {
    const { user } = useAuth();
    return useQuery({
        queryKey: assetKeys.categories(user?.id || ''),
        queryFn: ({ signal }) => assetsApi.categories(signal),
    });
}
export function AdminCategoriesPage() {
    const list = useCategories();
    return (
        <>
            <div className="page-heading insights-heading">
                <div>
                    <h1>Danh mục tài nguyên</h1>
                    <p>Cấu trúc dùng chung cho thư viện và bộ chọn tài nguyên.</p>
                </div>
                <Link className="button compact" to="/admin/categories/new">
                    Tạo danh mục
                </Link>
            </div>
            <AdminReload retry={() => void list.refetch()} busy={list.isFetching} />
            {list.isPending && <p role="status">Đang tải danh mục…</p>}
            {list.isError && <Feedback error={errorMessage(list.error)} />}
            {list.isSuccess &&
                (list.data.length ? (
                    <ul className="admin-rows">
                        {list.data.map((item) => (
                            <li key={item.id}>
                                <div>
                                    <h2>
                                        <Link to={`/admin/categories/${item.id}`}>{item.name}</Link>
                                    </h2>
                                    <p>
                                        Danh mục cha:{' '}
                                        {list.data.find((parent) => parent.id === item.parentId)
                                            ?.name || 'Không có'}{' '}
                                        · Thứ tự: {item.sortOrder}
                                    </p>
                                </div>
                                <Link to={`/admin/categories/${item.id}`}>
                                    Sửa danh mục<span className="sr-only"> {item.name}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <section className="empty-state">
                        <h2>Chưa có danh mục</h2>
                        <p>Tạo danh mục đầu tiên để phân loại tài nguyên.</p>
                    </section>
                ))}
        </>
    );
}
function CategoryForm({
    categories,
    current,
}: {
    categories: AssetCategory[];
    current?: AssetCategory;
}) {
    const action = useLibraryAction(),
        navigate = useNavigate(),
        [draft, setDraft] = useState<CreateCategoryBody | UpdateCategoryBody | 'delete' | null>(
            null,
        ),
        [error, setError] = useState<string | null>(null);
    const excluded = current ? excludedParents(categories, current.id) : new Set<string>();
    return (
        <>
            <h1>{current ? `Sửa danh mục: ${current.name}` : 'Tạo danh mục'}</h1>
            <WriteFeedback action={action} error={error} />
            <form
                className="admin-form"
                onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget),
                        name = String(data.get('name') || '').trim(),
                        parentId = String(data.get('parentId') || '') || null,
                        sortOrder = Number(data.get('sortOrder'));
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
                <fieldset disabled={action.busy || action.uncertain}>
                    <label htmlFor="category-name">
                        Tên danh mục
                        <input
                            name="name"
                            id="category-name"
                            required
                            maxLength={100}
                            defaultValue={current?.name || ''}
                        />
                    </label>
                    <CategorySelect
                        name="parentId"
                        label="Danh mục cha"
                        categories={categories}
                        value={current?.parentId || ''}
                        exclude={excluded}
                    />
                    {current && (
                        <label htmlFor="category-order">
                            Thứ tự hiển thị
                            <input
                                name="sortOrder"
                                id="category-order"
                                required
                                type="number"
                                step={1}
                                min={-32768}
                                max={32767}
                                defaultValue={current.sortOrder}
                            />
                        </label>
                    )}
                    <button className="button" type="submit">
                        Xem lại danh mục
                    </button>
                </fieldset>
            </form>
            {current && (
                <section className="admin-section">
                    <h2>Xóa danh mục</h2>
                    <p>
                        Chỉ xóa khi không còn danh mục con hoặc tài nguyên. Chuyển các mục sang nơi
                        khác trước khi xóa.
                    </p>
                    <button
                        className="button secondary"
                        type="button"
                        disabled={action.busy || action.uncertain || excluded.size > 1}
                        onClick={() => setDraft('delete')}
                    >
                        Xóa danh mục
                    </button>
                </section>
            )}
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
        </>
    );
}
export function AdminCategoryEditPage() {
    const { categoryId } = useParams(),
        list = useCategories(),
        current = list.data?.find((item) => item.id === categoryId);
    return (
        <>
            <Link to="/admin/categories">Về danh mục tài nguyên</Link>
            {list.isPending && <p role="status">Đang tải danh mục…</p>}
            {list.isError && (
                <>
                    <Feedback error={errorMessage(list.error)} />
                    <AdminReload retry={() => void list.refetch()} busy={list.isFetching} />
                </>
            )}
            {list.isSuccess &&
                (categoryId && !current ? (
                    <h1>Không tìm thấy danh mục</h1>
                ) : (
                    <CategoryForm
                        key={JSON.stringify(current) || 'new'}
                        current={current}
                        categories={list.data}
                    />
                ))}
        </>
    );
}
