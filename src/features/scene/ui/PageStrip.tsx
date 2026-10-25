import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Plus, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LoadingState } from '@/shared/ui/LoadingState';
import { Button as ActionButton } from '@/shared/ui/primitives/button';
import { DropdownMenu, DropdownMenuTrigger } from '@/shared/ui/primitives/dropdown-menu';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { errorMessage } from '../../../shared/api/errors';
import type { BookDetail, Page, PageSummary } from '../../../shared/contracts/dto.schema';
import { Button } from '../../../shared/ui/Button';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { Feedback } from '../../../shared/ui/Feedback';
import { assetKeys } from '../../assets';
import { auth, useAuth } from '../../auth';
import { bookKeys } from '../../books';
import { pageKeys, pagesApi } from '../../pages';
import { movedPageIds, uncertainWrite } from '../../pages/model/operations';
import { AddPagesDialog } from '../../pages/ui/AddPagesDialog';
import { PageActionsMenu } from './PageActionsMenu';

export function PageStrip({
    book,
    pageId,
    disabled,
    dirty,
    onBusyChange,
    onDraftChange,
}: {
    book: BookDetail;
    pageId: string;
    disabled: boolean;
    dirty: boolean;
    onBusyChange: (busy: boolean) => void;
    onDraftChange: (dirty: boolean) => void;
}) {
    const { user } = useAuth();
    const bookId = book.id;
    const cache = useQueryClient(),
        navigate = useNavigate();
    const [busy, setBusy] = useState(false),
        [uncertain, setUncertain] = useState(false);
    const [stage, setStage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [menu, setMenu] = useState<PageSummary | null>(null);
    const [renaming, setRenaming] = useState(false);
    const menuAnchor = useRef<HTMLButtonElement | null>(null);
    const addAnchor = useRef<HTMLButtonElement | null>(null);
    const [deleting, setDeleting] = useState(false),
        [adding, setAdding] = useState(false);
    const [target, setTarget] = useState<string | null>(null);
    const active = useRef(false),
        alive = useRef(true);
    const actor = useRef(user?.id);
    const currentSession = () => alive.current && auth.store.getState().user?.id === actor.current;
    const listing = useQuery({
        queryKey: pageKeys.list(user?.id || '', bookId),
        queryFn: ({ signal }) => pagesApi.list(bookId, signal),
        refetchOnWindowFocus: false,
    });
    const locked = disabled || dirty || busy || uncertain;
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
            onBusyChange(false);
        };
    }, [onBusyChange]);
    useEffect(() => {
        if (target && !busy && !disabled) navigate(target, { state: { created: true } });
    }, [target, busy, disabled, navigate]);
    const busyChange = useCallback(
        (value: boolean) => {
            setBusy(value);
            onBusyChange(value);
        },
        [onBusyChange],
    );
    async function refresh() {
        await Promise.all([
            cache.invalidateQueries({ queryKey: bookKeys.all }),
            cache.invalidateQueries({ queryKey: pageKeys.list(actor.current || '', bookId) }),
        ]);
    }
    async function run(action: () => Promise<void>, post = false) {
        if (locked || active.current || !currentSession()) return;
        active.current = true;
        busyChange(true);
        setError(null);
        try {
            await action();
            if (currentSession()) {
                setMenu(null);
                setDeleting(false);
                await refresh();
            }
        } catch (cause) {
            if (currentSession()) {
                if (post && uncertainWrite(cause)) setUncertain(true);
                setError(errorMessage(cause));
            }
        } finally {
            active.current = false;
            if (currentSession()) {
                busyChange(false);
                setStage('');
            }
        }
    }
    async function move(page: PageSummary, direction: -1 | 1) {
        await run(async () => {
            const ids = movedPageIds(listing.data || [], page.id, direction);
            if (!ids) return;
            const result = await pagesApi.reorder(bookId, ids);
            if (!currentSession()) return;
            for (const item of result.pages)
                cache.setQueryData<Page>(
                    pageKeys.detail(actor.current || '', item.id),
                    (current) => (current ? { ...current, orderIndex: item.orderIndex } : current),
                );
        });
    }
    const menuIndex = listing.data?.findIndex((page) => page.id === menu?.id) ?? -1;
    return (
        <div className="page-strip-region sticky bottom-0 z-6 bg-surface">
            <nav
                className="editor-page-strip scene-page-strip flex min-h-25 items-center justify-center gap-3 overflow-x-auto border-t-[1px] border-t-border bg-surface px-5 py-3 [border-top-style:solid] max-[760px]:justify-start [&_a[aria-current=page]]:bg-selected [&_a[aria-current=page]]:outline-offset-[1px] [&_a[aria-current=page]]:[outline:2px_solid_var(--action-primary)] [&_img]:size-full [&_img]:object-contain [.editor-page-strip&]:justify-start"
                aria-label="Các trang trong sách"
            >
                <span className="page-strip-label mr-2 shrink-0 text-[length:11px] text-muted-foreground">
                    Trang sách
                </span>
                {listing.isPending && (
                    <LoadingState layout="page-strip">Đang tải các trang…</LoadingState>
                )}
                {listing.isError && (
                    <ActionButton
                        variant="plain"
                        type="button"
                        onClick={() => void listing.refetch()}
                    >
                        Thử tải danh sách trang
                    </ActionButton>
                )}
                {listing.data?.map((page) => (
                    <div
                        className="page-thumbnail relative flex-[0_0_64px] pt-1 [.scene-page-strip_&_a]:h-18 [.scene-page-strip_&_a]:w-[58px]"
                        key={page.id}
                    >
                        <Link
                            to={`/books/${bookId}/pages/${page.id}`}
                            aria-current={pageId === page.id ? 'page' : undefined}
                            aria-disabled={disabled || busy}
                            onClick={(event) => {
                                if (disabled || busy) event.preventDefault();
                            }}
                            title={page.title || `Trang ${page.orderIndex + 1}`}
                        >
                            <img src={page.thumbnailUrl} alt="" />
                            <span>{page.orderIndex + 1}</span>
                            <span className="sr-only [.editor-page-strip_a.strip-add-page_>_span:not(&)]:[position:static] [.editor-page-strip_a_>_span:not(&)]:absolute [.editor-page-strip_a_>_span:not(&)]:right-[-1px] [.editor-page-strip_a_>_span:not(&)]:bottom-[-1px] [.editor-page-strip_a_>_span:not(&)]:rounded-[3px] [.editor-page-strip_a_>_span:not(&)]:bg-surface [.editor-page-strip_a_>_span:not(&)]:px-[5px] [.editor-page-strip_a_>_span:not(&)]:py-0 [.editor-page-strip_a_>_span:not(&)]:text-[length:10px] [.editor-page-strip_a_>_span:not(&)]:text-foreground">
                                {page.title || `Trang ${page.orderIndex + 1}`}
                            </span>
                        </Link>
                        <DropdownMenu
                            open={menu?.id === page.id && !renaming && !deleting}
                            onOpenChange={(open) => {
                                if (open) {
                                    setRenaming(false);
                                    setDeleting(false);
                                    setError(null);
                                    setMenu(page);
                                } else setMenu(null);
                            }}
                        >
                            <DropdownMenuTrigger asChild>
                                <ActionButton
                                    variant="plain"
                                    className="page-thumbnail-menu absolute top-[-5px] right-0 grid size-7 rounded-[var(--radius-sm)] border border-border border-solid bg-surface p-0 text-muted-foreground [place-items:center] max-[760px]:size-10 [&:hover]:bg-selected [&:hover]:text-primary"
                                    type="button"
                                    disabled={disabled || busy}
                                    aria-label={`Tùy chọn trang ${page.orderIndex + 1}`}
                                    ref={(node) => {
                                        if (node && menu?.id === page.id) menuAnchor.current = node;
                                    }}
                                >
                                    <MoreHorizontal size={14} />
                                </ActionButton>
                            </DropdownMenuTrigger>
                            {menu?.id === page.id && !renaming && !deleting && (
                                <PageActionsMenu
                                    title={menu.title || `Trang ${menu.orderIndex + 1}`}
                                    locked={locked}
                                    first={menuIndex <= 0}
                                    last={menuIndex >= (listing.data?.length || 0) - 1}
                                    error={error}
                                    onRename={() => setRenaming(true)}
                                    onMove={(direction) => void move(menu, direction)}
                                    onDelete={() => setDeleting(true)}
                                    onDuplicate={() =>
                                        void run(async () => {
                                            const result = await pagesApi.duplicate(menu.id);
                                            if (currentSession())
                                                setTarget(
                                                    `/books/${bookId}/pages/${result.page.id}`,
                                                );
                                        }, true)
                                    }
                                />
                            )}
                        </DropdownMenu>
                    </div>
                ))}
                <ActionButton
                    variant="plain"
                    className="strip-add-page [.editor-page-strip_&]:flex [.editor-page-strip_&]:flex-[0_0_100px] [.editor-page-strip_&]:flex-col [.editor-page-strip_&]:items-center [.editor-page-strip_&]:justify-center [.editor-page-strip_&]:gap-[5px] [.editor-page-strip_&]:text-[length:10px] [.editor-page-strip_&]:no-underline [.editor-page-strip_&_>_span]:[position:static] [.editor-page-strip_a:not(&)]:relative [.editor-page-strip_a:not(&)]:flex [.editor-page-strip_a:not(&)]:h-[70px] [.editor-page-strip_a:not(&)]:flex-[0_0_54px] [.editor-page-strip_a:not(&)]:rounded-[8px] [.editor-page-strip_a:not(&)]:border [.editor-page-strip_a:not(&)]:border-border [.editor-page-strip_a:not(&)]:border-solid [.editor-page-strip_a:not(&)]:bg-muted [.editor-page-strip_a:not(&)]:p-[3px] [.editor-page-strip_a:not(&)]:no-underline [.scene-page-strip_button&]:min-h-18 [.scene-page-strip_button&]:w-19 [.scene-page-strip_button&]:flex-[0_0_76px] [.scene-page-strip_button&]:rounded-[var(--radius-md)] [.scene-page-strip_button&]:border [.scene-page-strip_button&]:border-input [.scene-page-strip_button&]:border-dashed [.scene-page-strip_button&]:bg-muted [.scene-page-strip_button&]:text-primary"
                    type="button"
                    disabled={locked || listing.isPending || listing.isError}
                    title={dirty ? 'Lưu nội dung trước khi thêm trang' : 'Thêm trang'}
                    ref={addAnchor}
                    onClick={() => {
                        setAdding(true);
                        setError(null);
                    }}
                >
                    <Plus size={20} aria-hidden="true" />
                    <span>Thêm trang</span>
                </ActionButton>
            </nav>
            {busy && (
                <p
                    className="page-strip-feedback m-0 px-5 py-2 text-[length:12px] text-muted-foreground"
                    role="status"
                >
                    {stage || 'Đang cập nhật trang…'}
                </p>
            )}
            {dirty && (
                <p className="page-strip-feedback m-0 px-5 py-2 text-[length:12px] text-muted-foreground">
                    Lưu nội dung hiện tại trước khi thêm hoặc quản lý trang.
                </p>
            )}
            {!menu && <Feedback error={error} />}
            {uncertain && (
                <div className="page-strip-feedback m-0 px-5 py-2 text-[length:12px] text-muted-foreground">
                    <p>
                        Yêu cầu có thể đã được nhận. Tải lại danh sách và kiểm tra trang vừa thao
                        tác trước khi tạo tiếp.
                    </p>
                    <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={async () => {
                            busyChange(true);
                            const result = await listing.refetch();
                            if (currentSession() && !result.isError) {
                                setUncertain(false);
                                setError(null);
                                setMenu(null);
                            }
                            if (currentSession()) busyChange(false);
                        }}
                    >
                        Tải lại danh sách trang
                    </Button>
                </div>
            )}

            {menu && (renaming || deleting) && (
                <ConfirmDialog
                    confirmation={deleting}
                    returnFocus={menuAnchor.current}
                    title={deleting ? 'Xóa trang sách?' : `Trang ${menu.orderIndex + 1}`}
                    busy={busy}
                    className="page-actions-dialog max-h-[calc(100dvh_-_32px)] w-[min(480px,_calc(100vw_-_24px))] overflow-y-auto [&_form]:my-5 [&_form_>_.button]:mt-3 max-[760px]:[&_input]:text-[length:16px]"
                    onClose={() => {
                        if (!busy) {
                            setMenu(null);
                            setDeleting(false);
                        }
                    }}
                >
                    <Feedback error={error} />
                    {deleting ? (
                        <>
                            <p>
                                Xóa “{menu.title || `Trang ${menu.orderIndex + 1}`}” và nội dung của
                                trang khỏi bản nháp?
                            </p>
                            <div className="form-actions mt-3 flex flex-wrap items-center gap-5 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-4 max-[760px]:[&_>_a]:text-center [.confirm-dialog_&]:mt-6 [.confirm-dialog_&]:justify-end max-[760px]:[.confirm-dialog_&]:flex-row max-[760px]:[.confirm-dialog_&]:flex-wrap [.image-editor_&:empty]:hidden [.scene-object-asset_&]:gap-2">
                                <Button
                                    variant="secondary"
                                    disabled={busy}
                                    onClick={() => {
                                        setDeleting(false);
                                        setMenu(null);
                                    }}
                                >
                                    Giữ lại
                                </Button>
                                <Button
                                    variant="destructive"
                                    disabled={locked}
                                    onClick={() =>
                                        void run(async () => {
                                            await pagesApi.remove(menu.id);
                                            if (menu.id === pageId && currentSession()) {
                                                // Deletion is confirmed: a failed refresh must not leave the editor on a deleted page.
                                                const remaining = await pagesApi
                                                    .list(bookId)
                                                    .catch(() => null);
                                                if (!currentSession()) return;
                                                setTarget(
                                                    remaining?.[0]
                                                        ? `/books/${bookId}/pages/${remaining[0].id}`
                                                        : `/books/${bookId}/edit`,
                                                );
                                            }
                                        })
                                    }
                                >
                                    Xóa trang
                                </Button>
                            </div>
                        </>
                    ) : (
                        <>
                            <form
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    const title = String(
                                        new FormData(event.currentTarget).get('title') || '',
                                    ).trim();
                                    void run(async () => {
                                        const saved = await pagesApi.update(menu.id, {
                                            title: title || null,
                                        });
                                        if (currentSession())
                                            cache.setQueryData<Page>(
                                                pageKeys.detail(actor.current || '', menu.id),
                                                (current) =>
                                                    current ? { ...current, ...saved } : current,
                                            );
                                    });
                                }}
                            >
                                <FieldGroup className="contents">
                                    <Field orientation="contents">
                                        <FieldLabel htmlFor="scene-page-title">
                                            Tên trang
                                            <Input
                                                id="scene-page-title"
                                                name="title"
                                                maxLength={150}
                                                defaultValue={menu.title || ''}
                                                disabled={locked}
                                                placeholder={`Trang ${menu.orderIndex + 1}`}
                                            />
                                        </FieldLabel>
                                    </Field>
                                    <Button type="submit" disabled={locked}>
                                        Lưu tên trang
                                    </Button>
                                </FieldGroup>
                            </form>
                            {dirty && <p>Lưu nội dung đang sửa trước khi thao tác với trang.</p>}
                            <Button variant="outline" disabled={busy} onClick={() => setMenu(null)}>
                                <X data-icon="inline-start" />
                                Đóng
                            </Button>
                        </>
                    )}
                </ConfirmDialog>
            )}
            {adding && (
                <AddPagesDialog
                    book={book}
                    disabled={disabled || dirty || uncertain}
                    opener={addAnchor.current}
                    onBusyChange={busyChange}
                    onDraftChange={onDraftChange}
                    onClose={() => {
                        setAdding(false);
                        void refresh();
                        void cache.invalidateQueries({ queryKey: assetKeys.all });
                    }}
                    onComplete={async (id) => {
                        await refresh();
                        void cache.invalidateQueries({ queryKey: assetKeys.all });
                        if (currentSession()) {
                            setAdding(false);
                            setTarget(`/books/${bookId}/pages/${id}`);
                        }
                    }}
                    onInspect={async () => {
                        await refresh();
                        void cache.invalidateQueries({ queryKey: assetKeys.all });
                        if (currentSession()) setAdding(false);
                    }}
                />
            )}
        </div>
    );
}
