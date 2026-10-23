import { useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { apiClient } from '../../shared/api/client';
import type { Asset, AssetCategory } from '../../shared/contracts/dto.schema';
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog';
import { Feedback } from '../../shared/ui/Feedback';
import { assetKeys } from '../assets';
import { useAuth } from '../auth';
import { profileKey } from '../profile';
import { createAdminLibraryApi } from './library-api';
import { useAdminAction } from './ui';
export const libraryApi = createAdminLibraryApi(apiClient);
export function useLibraryAction() {
    const { user } = useAuth();
    const action = useAdminAction(),
        cache = useQueryClient();
    return {
        ...action,
        run: <T,>(task: () => Promise<T>, success: (result: T) => void) =>
            action.run(task, (result) => {
                if (
                    result &&
                    typeof result === 'object' &&
                    'scope' in result &&
                    result.scope === 'library' &&
                    'id' in result &&
                    typeof result.id === 'string'
                ) {
                    cache.setQueryData(assetKeys.detail(user?.id || '', result.id), result);
                    void cache.invalidateQueries({ queryKey: profileKey(user?.id || '') });
                }
                void cache.invalidateQueries({ queryKey: assetKeys.all });
                success(result);
            }),
    };
}
export function WriteFeedback({
    action,
    error,
}: {
    action: ReturnType<typeof useLibraryAction>;
    error?: string | null;
}) {
    return (
        <>
            <Feedback error={error || action.error} />
            {action.uncertain && (
                <button
                    className="button secondary"
                    type="button"
                    onClick={() => window.location.reload()}
                >
                    Tải lại trang và kiểm tra
                </button>
            )}
        </>
    );
}
export function LibraryConfirm({
    title,
    busy,
    blocked,
    error,
    onClose,
    onConfirm,
    children,
}: {
    title: string;
    busy: boolean;
    blocked: boolean;
    error: string | null;
    onClose: () => void;
    onConfirm: () => void;
    children: ReactNode;
}) {
    return (
        <ConfirmDialog title={title} busy={busy} onClose={onClose} className="admin-confirm">
            {children}
            <Feedback error={error} />
            <div className="admin-actions">
                <button
                    type="button"
                    className="button"
                    disabled={busy || blocked}
                    onClick={onConfirm}
                >
                    {busy ? 'Đang xử lý…' : 'Xác nhận'}
                </button>
                <button
                    type="button"
                    className="button secondary"
                    disabled={busy}
                    onClick={onClose}
                >
                    Quay lại
                </button>
            </div>
        </ConfirmDialog>
    );
}
export function CategorySelect({
    categories,
    value = '',
    exclude = new Set<string>(),
    label = 'Danh mục',
    name = 'categoryId',
    emptyLabel = 'Không có',
}: {
    categories: AssetCategory[];
    value?: string;
    exclude?: Set<string>;
    label?: string;
    name?: string;
    emptyLabel?: string;
}) {
    return (
        <label htmlFor={`library-${name}`}>
            {label}
            <select id={`library-${name}`} name={name} defaultValue={value}>
                <option value="">{emptyLabel}</option>
                {categories
                    .filter((item) => !exclude.has(item.id))
                    .map((item) => (
                        <option key={item.id} value={item.id}>
                            {item.name}
                            {item.parentId
                                ? ` — trong ${categories.find((parent) => parent.id === item.parentId)?.name || 'danh mục cha'}`
                                : ''}
                        </option>
                    ))}
            </select>
        </label>
    );
}
export function LibraryMetadata({
    asset,
    categories,
}: {
    asset: Asset;
    categories: AssetCategory[];
}) {
    return (
        <>
            <label htmlFor="library-name">
                Tên tài nguyên
                <input
                    id="library-name"
                    name="name"
                    required
                    maxLength={150}
                    defaultValue={asset.name}
                />
            </label>
            <CategorySelect categories={categories} value={asset.categoryId || ''} />
            <label htmlFor="library-license">
                Giấy phép sử dụng
                <input
                    id="library-license"
                    name="license"
                    required
                    maxLength={50}
                    defaultValue={asset.license || ''}
                />
            </label>
            <label htmlFor="library-author">
                Tác giả gốc
                <input
                    id="library-author"
                    name="authorName"
                    required
                    maxLength={150}
                    defaultValue={asset.authorName || ''}
                />
            </label>
            <label htmlFor="library-source">
                Liên kết nguồn (không bắt buộc)
                <input
                    id="library-source"
                    name="sourceUrl"
                    type="url"
                    defaultValue={asset.sourceUrl || ''}
                />
            </label>
            <label htmlFor="library-tags">
                Nhãn, ngăn cách bằng dấu phẩy
                <input id="library-tags" name="tags" defaultValue={asset.tags.join(', ')} />
            </label>
            <p className="stats-note">
                Tối đa 20 nhãn, mỗi nhãn 30 ký tự. Giấy phép và tên tác giả phải thể hiện đúng quyền
                sử dụng tệp.
            </p>
        </>
    );
}
