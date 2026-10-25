import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert } from '@/shared/ui/Alert';
import { ConfirmationDialog } from '@/shared/ui/ConfirmationDialog';
import { FormSelect } from '@/shared/ui/FormSelect';
import { LoadingState } from '@/shared/ui/LoadingState';
import { AlertDialogAction, AlertDialogCancel } from '@/shared/ui/primitives/alert-dialog';
import { Field, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { errorMessage } from '../../../shared/api/errors';
import { AddPageBodySchema } from '../../../shared/contracts/api/pages.schema';
import type { PageSummary } from '../../../shared/contracts/dto.schema';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { assetKeys } from '../../assets';
import { auth, useAuth } from '../../auth';
import { bookKeys } from '../../books';
import { profileKey } from '../../profile';
import {
    markerWarningText,
    movedPageIds,
    pageKeys,
    pagesApi,
    uncertainWrite,
} from '../model/pages';
import { PageImageForm } from './PageImageForm';

export function BookPages({
    bookId,
    disabled,
    onBusyChange,
}: {
    bookId: string;
    disabled: boolean;
    onBusyChange: (busy: boolean) => void;
}) {
    const { user } = useAuth(),
        cache = useQueryClient(),
        navigate = useNavigate();
    const [adding, setAdding] = useState(false),
        [uploadBusy, setUploadBusy] = useState(false),
        [busy, setBusy] = useState(false);
    const guard = useRef(false);
    const [uncertain, setUncertain] = useState(false),
        [error, setError] = useState<string | null>(null),
        [notice, setNotice] = useState<string | null>(null);
    const [warning, setWarning] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<PageSummary | null>(null);
    const pages = useQuery({
        queryKey: pageKeys.list(user?.id || '', bookId),
        queryFn: ({ signal }) => pagesApi.list(bookId, signal),
        refetchOnWindowFocus: false,
    });
    useEffect(() => {
        onBusyChange(busy || uploadBusy);
        return () => onBusyChange(false);
    }, [busy, uploadBusy, onBusyChange]);
    const locked = disabled || busy || uploadBusy || uncertain;
    async function refresh() {
        await cache.invalidateQueries({ queryKey: bookKeys.all });
        const result = await pages.refetch();
        if (result.isError) throw result.error;
    }
    async function mutate(action: () => Promise<unknown>, message: string, post = false) {
        if (locked || guard.current) return;
        guard.current = true;
        setBusy(true);
        setError(null);
        setNotice(null);
        setWarning(null);
        try {
            await action();
            await refresh();
            setNotice(message);
            setDeleting(null);
        } catch (cause) {
            if (post && uncertainWrite(cause)) setUncertain(true);
            setError(errorMessage(cause));
        } finally {
            guard.current = false;
            setBusy(false);
        }
    }
    return (
        <section className="book-pages mt-8" aria-labelledby="book-pages-title">
            <div className="page-list-heading flex flex-wrap items-center justify-between gap-4 [&_h2]:mx-0 [&_h2]:mt-0 [&_h2]:mb-2 [&_p]:m-0 [&_p]:text-muted-foreground">
                <div>
                    <h2 id="book-pages-title">Trang sách</h2>
                    <p>{pages.data?.length || 0} trang · Sắp xếp theo thứ tự đọc.</p>
                </div>
                <Button
                    variant="secondary"
                    disabled={locked}
                    onClick={() => setAdding((value) => !value)}
                >
                    <Plus data-icon="inline-start" aria-hidden="true" />
                    {adding ? 'Đóng phần thêm trang' : 'Thêm trang'}
                </Button>
            </div>
            <Feedback error={deleting ? null : error} success={notice} warning={warning} />
            {uncertain && (
                <Alert tone="warning" className="my-4">
                    <p>
                        Chưa xác nhận được kết quả. Yêu cầu có thể đã được nhận; hãy tải lại danh
                        sách trước khi thao tác tiếp.
                    </p>
                    <Button
                        variant="secondary"
                        aria-busy={busy}
                        onClick={async () => {
                            setBusy(true);
                            setError(null);
                            try {
                                await refresh();
                                setUncertain(false);
                                setAdding(false);
                                setDeleting(null);
                                setWarning(
                                    'Đã tải lại danh sách. Hãy kiểm tra trang vừa thao tác trước khi thử tiếp.',
                                );
                            } catch (cause) {
                                setError(errorMessage(cause));
                            } finally {
                                setBusy(false);
                            }
                        }}
                        disabled={busy}
                    >
                        {busy && <Spinner data-icon="inline-start" aria-hidden="true" />}
                        Tải lại danh sách
                    </Button>
                </Alert>
            )}
            {pages.isPending && (
                <LoadingState layout="pages">Đang tải danh sách trang…</LoadingState>
            )}
            {pages.isError && (
                <>
                    <Feedback error={errorMessage(pages.error)} />
                    <Button
                        variant="secondary"
                        onClick={() => {
                            void pages.refetch();
                        }}
                    >
                        Thử tải lại trang sách
                    </Button>
                </>
            )}
            {pages.data && (
                <>
                    {pages.data.length ? (
                        <ol className="page-list mx-0 my-5 list-none p-0">
                            {pages.data.map((page, index) => (
                                <li
                                    className="page-list-row flex items-center gap-4 border-b-[1px] border-b-border px-0 py-4 [border-bottom-style:solid] max-[540px]:flex-wrap max-[540px]:gap-3"
                                    key={page.id}
                                >
                                    <img
                                        className="page-row-image h-22 w-16 shrink-0 bg-muted object-contain"
                                        src={page.thumbnailUrl}
                                        alt=""
                                    />
                                    <div className="page-row-content wrap-anywhere min-w-0 flex-[1] [&_h3]:mx-0 [&_h3]:mt-0 [&_h3]:mb-1 [&_p]:mx-0 [&_p]:mt-0 [&_p]:mb-1 [&_p]:text-[length:var(--text-sm)] [&_p]:text-muted-foreground">
                                        <h3>
                                            <Link to={`/books/${bookId}/pages/${page.id}`}>
                                                {page.title || `Trang ${index + 1}`}
                                            </Link>
                                        </h3>
                                        <p>
                                            Trang {index + 1} · {page.objectCount} đối tượng ·{' '}
                                            {page.markerMode === 'NONE'
                                                ? 'Không dùng AR'
                                                : page.markerMode === 'BOOKARIA_MARKER'
                                                  ? `Marker Bookaria ${page.markerNumber || ''}`
                                                  : 'Nhận diện bằng ảnh trang'}
                                        </p>
                                        {[...new Set(page.markerWarnings)].map((warning) => (
                                            <p
                                                className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]"
                                                key={warning}
                                            >
                                                {markerWarningText(warning)}
                                            </p>
                                        ))}
                                    </div>
                                    <div className="page-row-actions flex flex-wrap gap-1 max-[540px]:w-full max-[540px]:justify-end [&_.button]:min-h-11 [&_.button]:min-w-11 [&_.button]:p-2">
                                        <Button
                                            variant="outline"
                                            disabled={locked || index === 0}
                                            aria-label={`Đưa trang ${index + 1} lên`}
                                            onClick={() => {
                                                const ids = movedPageIds(pages.data, page.id, -1);
                                                if (ids)
                                                    void mutate(
                                                        () => pagesApi.reorder(bookId, ids),
                                                        'Đã đổi thứ tự trang.',
                                                    );
                                            }}
                                        >
                                            <ArrowUp data-icon="inline-start" aria-hidden="true" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            disabled={locked || index === pages.data.length - 1}
                                            aria-label={`Đưa trang ${index + 1} xuống`}
                                            onClick={() => {
                                                const ids = movedPageIds(pages.data, page.id, 1);
                                                if (ids)
                                                    void mutate(
                                                        () => pagesApi.reorder(bookId, ids),
                                                        'Đã đổi thứ tự trang.',
                                                    );
                                            }}
                                        >
                                            <ArrowDown
                                                data-icon="inline-start"
                                                aria-hidden="true"
                                            />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            disabled={locked}
                                            aria-label={`Nhân bản trang ${index + 1}`}
                                            onClick={() => {
                                                void mutate(
                                                    () => pagesApi.duplicate(page.id),
                                                    'Đã nhân bản trang.',
                                                    true,
                                                );
                                            }}
                                        >
                                            <Copy data-icon="inline-start" aria-hidden="true" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            disabled={locked}
                                            aria-label={`Xóa trang ${index + 1}`}
                                            onClick={() => {
                                                setError(null);
                                                setDeleting(page);
                                            }}
                                        >
                                            <Trash2 data-icon="inline-start" aria-hidden="true" />
                                        </Button>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <p className="page-list-empty">
                            Sách chưa có trang. Tải một ảnh trang để bắt đầu.
                        </p>
                    )}
                    {adding && (
                        <PageImageForm
                            title="Thêm trang sách"
                            action="Thêm trang từ ảnh"
                            disabled={disabled || busy || uncertain}
                            onBusyChange={setUploadBusy}
                            onUploaded={() => {
                                void cache.invalidateQueries({ queryKey: assetKeys.all });
                                void cache.invalidateQueries({
                                    queryKey: profileKey(user?.id || ''),
                                });
                            }}
                            onAttach={async (asset, form, context) => {
                                const position = String(form.get('position') || 'end');
                                const body = AddPageBodySchema.parse({
                                    imageAssetId: asset.id,
                                    title: String(form.get('title') || '').trim() || undefined,
                                    afterPageId:
                                        position === 'end'
                                            ? undefined
                                            : position === 'start'
                                              ? null
                                              : position,
                                });
                                context.onStage('saving');
                                let result: Awaited<ReturnType<typeof pagesApi.add>>;
                                try {
                                    result = await pagesApi.add(bookId, body);
                                } catch (cause) {
                                    if (uncertainWrite(cause)) setUncertain(true);
                                    throw cause;
                                }
                                void cache.invalidateQueries({ queryKey: bookKeys.all });
                                void cache.invalidateQueries({ queryKey: pageKeys.all });
                                if (
                                    !context.signal.aborted &&
                                    auth.store.getState().user?.id === user?.id
                                )
                                    navigate(`/books/${bookId}/pages/${result.page.id}`, {
                                        state: { created: true, warnings: result.warnings },
                                    });
                            }}
                        >
                            <Field orientation="contents">
                                <FieldLabel htmlFor="new-page-title">
                                    Tên trang (không bắt buộc)
                                    <Input id="new-page-title" name="title" maxLength={150} />
                                </FieldLabel>
                            </Field>
                            <Field orientation="contents">
                                <FieldLabel htmlFor="page-position">
                                    Vị trí thêm trang
                                    <FormSelect
                                        id="page-position"
                                        name="position"
                                        defaultValue="end"
                                        options={[
                                            { value: 'end', label: 'Cuối sách' },
                                            { value: 'start', label: 'Đầu sách' },
                                            ...(pages.data.map((page, index) => ({
                                                value: page.id,
                                                label: (
                                                    <>
                                                        Sau trang {index + 1}
                                                        {page.title ? ` — ${page.title}` : ''}
                                                    </>
                                                ),
                                            })) ?? []),
                                        ]}
                                    />
                                </FieldLabel>
                            </Field>
                        </PageImageForm>
                    )}
                </>
            )}
            {deleting && (
                <ConfirmationDialog
                    description={
                        <>
                            Trang “{deleting.title || `Trang ${deleting.orderIndex + 1}`}” và nội
                            dung của nó sẽ bị xóa khỏi bản nháp. Tệp ảnh vẫn được giữ trong tài
                            nguyên.
                        </>
                    }
                    title="Xóa trang sách?"
                    busy={busy}
                    onClose={() => {
                        if (!busy) setDeleting(null);
                    }}
                >
                    <Feedback error={error} />
                    <div className="form-actions mt-3 flex flex-wrap items-center gap-5 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-4 max-[760px]:[&_>_a]:text-center [.confirm-dialog_&]:mt-6 [.confirm-dialog_&]:justify-end max-[760px]:[.confirm-dialog_&]:flex-row max-[760px]:[.confirm-dialog_&]:flex-wrap [.image-editor_&:empty]:hidden [.scene-object-asset_&]:gap-2">
                        <AlertDialogCancel variant="plain" asChild>
                            <Button
                                variant="secondary"
                                disabled={busy}
                                onClick={() => setDeleting(null)}
                            >
                                Giữ lại
                            </Button>
                        </AlertDialogCancel>
                        <AlertDialogAction
                            variant="plain"
                            asChild
                            onClick={(event) => event.preventDefault()}
                        >
                            <Button
                                variant="destructive"
                                aria-busy={busy}
                                onClick={() => {
                                    void mutate(
                                        () => pagesApi.remove(deleting.id),
                                        'Đã xóa trang.',
                                    );
                                }}
                                disabled={busy}
                            >
                                {busy && <Spinner data-icon="inline-start" aria-hidden="true" />}
                                Xóa trang
                            </Button>
                        </AlertDialogAction>
                    </div>
                </ConfirmationDialog>
            )}
        </section>
    );
}
