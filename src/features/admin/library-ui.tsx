import { useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AUDIO_TAG_OPTIONS, audioKindFromTags } from '@/shared/scene/audio-kind';
import { Button } from '@/shared/ui/Button';
import { ConfirmationDialog } from '@/shared/ui/ConfirmationDialog';
import { FormSelect } from '@/shared/ui/FormSelect';
import { AlertDialogAction, AlertDialogCancel } from '@/shared/ui/primitives/alert-dialog';
import { Field, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { apiClient } from '../../shared/api/client';
import type { Asset, AssetCategory } from '../../shared/contracts/dto.schema';
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
                <Button
                    variant="secondary"
                    fullWidth
                    type="button"
                    onClick={() => window.location.reload()}
                >
                    Tải lại trang và kiểm tra
                </Button>
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
        <ConfirmationDialog
            description={children}
            title={title}
            busy={busy}
            onClose={onClose}
            className="admin-confirm [&_p]:wrap-anywhere max-h-[calc(100dvh_-_32px)] max-w-[min(480px,_calc(100%_-_32px))] overflow-y-auto [&_p]:[white-space:pre-wrap]"
        >
            <Feedback error={error} />
            <div className="admin-actions flex flex-wrap items-center gap-3 max-[640px]:flex-col max-[640px]:items-stretch [.admin-confirm_&]:mt-5">
                <AlertDialogCancel variant="plain" asChild>
                    <Button type="button" fullWidth disabled={busy || blocked} onClick={onConfirm}>
                        {busy ? 'Đang xử lý…' : 'Xác nhận'}
                    </Button>
                </AlertDialogCancel>
                <AlertDialogAction
                    variant="plain"
                    asChild
                    onClick={(event) => event.preventDefault()}
                >
                    <Button
                        type="button"
                        variant="secondary"
                        fullWidth
                        disabled={busy}
                        onClick={onClose}
                    >
                        Quay lại
                    </Button>
                </AlertDialogAction>
            </div>
        </ConfirmationDialog>
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
        <Field orientation="contents">
            <FieldLabel htmlFor={`library-${name}`}>
                {label}
                <FormSelect
                    id={`library-${name}`}
                    name={name}
                    defaultValue={value}
                    options={[
                        { value: '', label: emptyLabel },
                        ...(categories
                            .filter((item) => !exclude.has(item.id))
                            .map((item) => ({
                                value: item.id,
                                label: (
                                    <>
                                        {item.name}
                                        {item.parentId
                                            ? ` — trong ${categories.find((parent) => parent.id === item.parentId)?.name || 'danh mục cha'}`
                                            : ''}
                                    </>
                                ),
                            })) ?? []),
                    ]}
                />
            </FieldLabel>
        </Field>
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
            <Field orientation="contents">
                <FieldLabel htmlFor="library-name">
                    Tên tài nguyên
                    <Input
                        id="library-name"
                        name="name"
                        required
                        maxLength={150}
                        defaultValue={asset.name}
                    />
                </FieldLabel>
            </Field>
            <CategorySelect categories={categories} value={asset.categoryId || ''} />
            <Field orientation="contents">
                <FieldLabel htmlFor="library-license">
                    Giấy phép sử dụng
                    <Input
                        id="library-license"
                        name="license"
                        required
                        maxLength={50}
                        defaultValue={asset.license || ''}
                    />
                </FieldLabel>
            </Field>
            <Field orientation="contents">
                <FieldLabel htmlFor="library-author">
                    Tác giả gốc
                    <Input
                        id="library-author"
                        name="authorName"
                        required
                        maxLength={150}
                        defaultValue={asset.authorName || ''}
                    />
                </FieldLabel>
            </Field>
            <Field orientation="contents">
                <FieldLabel htmlFor="library-source">
                    Liên kết nguồn (không bắt buộc)
                    <Input
                        id="library-source"
                        name="sourceUrl"
                        type="url"
                        defaultValue={asset.sourceUrl || ''}
                    />
                </FieldLabel>
            </Field>
            <Field orientation="contents">
                <FieldLabel htmlFor="library-tags">
                    {asset.type === 'AUDIO' ? 'Loại âm thanh' : 'Nhãn, ngăn cách bằng dấu phẩy'}
                    {asset.type === 'AUDIO' ? (
                        <FormSelect
                            id="library-tags"
                            name="tags"
                            defaultValue={audioKindFromTags(asset.tags).toLowerCase()}
                            options={AUDIO_TAG_OPTIONS}
                        />
                    ) : (
                        <Input id="library-tags" name="tags" defaultValue={asset.tags.join(', ')} />
                    )}
                </FieldLabel>
            </Field>
            <p className="stats-note max-w-[75ch] text-[length:var(--text-sm)] text-muted-foreground [.admin-form_&]:mb-4">
                Tối đa 20 nhãn, mỗi nhãn 30 ký tự. Giấy phép và tên tác giả phải thể hiện đúng quyền
                sử dụng tệp.
            </p>
        </>
    );
}
