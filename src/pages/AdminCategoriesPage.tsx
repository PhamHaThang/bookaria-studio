import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/shared/ui/primitives/empty';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
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
            <div className="page-heading insights-heading [&_h1]:wrap-anywhere mx-0 mt-0 mb-7 flex items-center justify-between gap-6 max-[760px]:mb-6 max-[640px]:flex-col max-[700px]:flex-wrap max-[640px]:items-start max-[700px]:items-start max-[760px]:items-start max-[700px]:gap-3 max-[760px]:gap-4 max-[700px]:[&_>_.button]:max-w-full max-[700px]:[&_>_.button]:flex-[0_0_auto] [&_>_div]:min-w-0 max-[640px]:[&_>_div]:w-full max-[700px]:[&_>_div]:flex-[1_1_180px] [&_h1]:font-semibold [&_h1]:text-[length:28px] [&_h1]:tracking-[-0.025em] max-[700px]:[&_h1]:text-[length:25px] max-[760px]:[&_h1]:text-[length:var(--text-2xl)] [&_p]:mx-0 [&_p]:mt-2 [&_p]:mb-0 [&_p]:max-w-[64ch] [&_p]:text-[length:13px] [&_p]:text-muted-foreground max-[760px]:[&_p]:text-[length:var(--text-sm)] [.page-editor-screen[data-mode=content]_>_&]:hidden [.studio-editing_&]:mb-2 [.studio-editing_&_h1]:ml-4 [.studio-editing_&_h1]:inline [.studio-editing_&_h1]:text-[length:21px] max-[700px]:[.studio-editing_&_h1]:mx-0 max-[700px]:[.studio-editing_&_h1]:mt-[6px] max-[700px]:[.studio-editing_&_h1]:mb-0 max-[700px]:[.studio-editing_&_h1]:block [.studio-editing_&_p]:ml-[14px] [.studio-editing_&_p]:inline [.studio-editing_&_p]:text-[length:11px] max-[700px]:[.studio-editing_&_p]:mx-0 max-[700px]:[.studio-editing_&_p]:my-1 max-[700px]:[.studio-editing_&_p]:block [:where(.studio-main_>_&)]:mx-auto [:where(.studio-main_>_&)]:max-w-375">
                <div>
                    <h1>Danh mục tài nguyên</h1>
                    <p>Cấu trúc dùng chung cho thư viện và bộ chọn tài nguyên.</p>
                </div>
                <Button asChild>
                    <Link to="/admin/categories/new">Tạo danh mục</Link>
                </Button>
            </div>
            <AdminReload retry={() => void list.refetch()} busy={list.isFetching} />
            {list.isPending && <p role="status">Đang tải danh mục…</p>}
            {list.isError && <Feedback error={errorMessage(list.error)} />}
            {list.isSuccess &&
                (list.data.length ? (
                    <ul className="admin-rows [&_>_li]:wrap-anywhere mx-0 my-4 list-none p-0 [&_>_li]:flex [&_>_li]:items-start [&_>_li]:justify-between [&_>_li]:gap-5 [&_>_li]:border-b-[1px] [&_>_li]:border-b-border [&_>_li]:py-5 [&_>_li]:[border-bottom-style:solid] max-[640px]:[&_>_li]:flex-col max-[640px]:[&_>_li]:gap-3 [&_h2]:mx-0 [&_h2]:mt-0 [&_h2]:mb-2 [&_h2]:text-[length:var(--text-md)] [&_h3]:mx-0 [&_h3]:mt-0 [&_h3]:mb-2 [&_h3]:text-[length:var(--text-md)] [&_p]:mx-0 [&_p]:my-2">
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
                                    Sửa danh mục
                                    <span className="sr-only [.editor-page-strip_a.strip-add-page_>_span:not(&)]:[position:static] [.editor-page-strip_a_>_span:not(&)]:absolute [.editor-page-strip_a_>_span:not(&)]:right-[-1px] [.editor-page-strip_a_>_span:not(&)]:bottom-[-1px] [.editor-page-strip_a_>_span:not(&)]:rounded-[3px] [.editor-page-strip_a_>_span:not(&)]:bg-surface [.editor-page-strip_a_>_span:not(&)]:px-[5px] [.editor-page-strip_a_>_span:not(&)]:py-0 [.editor-page-strip_a_>_span:not(&)]:text-[length:10px] [.editor-page-strip_a_>_span:not(&)]:text-foreground">
                                        {' '}
                                        {item.name}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <Empty className="empty-state border-border border-t px-5 py-16 max-[760px]:px-3 max-[760px]:py-12">
                        <EmptyHeader>
                            <EmptyTitle>
                                <h2>Chưa có danh mục</h2>
                            </EmptyTitle>
                            <EmptyDescription>
                                <p>Tạo danh mục đầu tiên để phân loại tài nguyên.</p>
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
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
                className="admin-form my-6 max-w-160 [&_:is(input,_select,_textarea)]:w-full [&_label]:mb-4 [&_label]:grid [&_label]:gap-2 [&_textarea]:min-h-25"
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
                <FieldGroup className="contents">
                    <fieldset disabled={action.busy || action.uncertain}>
                        <Field orientation="contents">
                            <FieldLabel htmlFor="category-name">
                                Tên danh mục
                                <Input
                                    name="name"
                                    id="category-name"
                                    required
                                    maxLength={100}
                                    defaultValue={current?.name || ''}
                                />
                            </FieldLabel>
                        </Field>
                        <CategorySelect
                            name="parentId"
                            label="Danh mục cha"
                            categories={categories}
                            value={current?.parentId || ''}
                            exclude={excluded}
                        />
                        {current && (
                            <Field orientation="contents">
                                <FieldLabel htmlFor="category-order">
                                    Thứ tự hiển thị
                                    <Input
                                        name="sortOrder"
                                        id="category-order"
                                        required
                                        type="number"
                                        step={1}
                                        min={-32768}
                                        max={32767}
                                        defaultValue={current.sortOrder}
                                    />
                                </FieldLabel>
                            </Field>
                        )}
                        <Button fullWidth type="submit">
                            Xem lại danh mục
                        </Button>
                    </fieldset>
                </FieldGroup>
            </form>
            {current && (
                <section className="admin-section mt-8">
                    <h2>Xóa danh mục</h2>
                    <p>
                        Chỉ xóa khi không còn danh mục con hoặc tài nguyên. Chuyển các mục sang nơi
                        khác trước khi xóa.
                    </p>
                    <Button
                        variant="secondary"
                        fullWidth
                        type="button"
                        disabled={action.busy || action.uncertain || excluded.size > 1}
                        onClick={() => setDraft('delete')}
                    >
                        Xóa danh mục
                    </Button>
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
