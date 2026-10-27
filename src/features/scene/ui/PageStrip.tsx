import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MoreHorizontal, Plus, X } from 'lucide-react';
import { type DragEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '@/shared/lib/cn';
import { Button as ActionButton } from '@/shared/ui/primitives/button';
import { DropdownMenu, DropdownMenuTrigger } from '@/shared/ui/primitives/dropdown-menu';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { Skeleton } from '@/shared/ui/primitives/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/primitives/tooltip';
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
import { droppedPageIds, type PageDropTarget } from '../model/page-reorder';
import { PageActionsMenu } from './PageActionsMenu';
import { usePageReorderMotion } from './use-page-reorder-motion';

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
    const currentPageLink = useRef<HTMLAnchorElement>(null);
    const pageScroll = useRef<HTMLFieldSetElement>(null);
    const dragSession = useRef<{ id: string; ids: string[] } | null>(null);
    const dragX = useRef<number | null>(null);
    const suppressClickUntil = useRef(0);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dropTarget, setDropTarget] = useState<PageDropTarget | null>(null);
    const [pendingOrder, setPendingOrder] = useState<string[] | null>(null);
    const active = useRef(false),
        alive = useRef(true);
    const actor = useRef(user?.id);
    const currentSession = () => alive.current && auth.store.getState().user?.id === actor.current;
    const listing = useQuery({
        queryKey: pageKeys.list(user?.id || '', bookId),
        queryFn: ({ signal }) => pagesApi.list(bookId, signal),
        refetchOnWindowFocus: false,
    });
    const previewOrder =
        draggingId && dropTarget
            ? droppedPageIds(listing.data || [], draggingId, dropTarget)
            : pendingOrder;
    usePageReorderMotion(pageScroll, listing.data, previewOrder);
    const locked = disabled || dirty || busy || uncertain;
    const dragLocked = locked || listing.isPending || listing.isError || listing.isFetching;
    const clearDrag = useCallback(() => {
        dragSession.current = null;
        dragX.current = null;
        setDraggingId(null);
        setDropTarget(null);
    }, []);
    const locateDrop = useCallback((x: number) => {
        const cards = Array.from(
            pageScroll.current?.querySelectorAll<HTMLElement>('[data-page-id]') || [],
        );
        const card = cards.find((item) => {
            const rect = item.getBoundingClientRect();
            return x < rect.left + rect.width / 2;
        });
        const last = cards.at(-1);
        const id = (card || last)?.dataset.pageId;
        const next = id ? { id, after: !card } : null;
        setDropTarget((previous) =>
            previous?.id === next?.id && previous?.after === next?.after ? previous : next,
        );
        return next;
    }, []);
    useEffect(() => {
        if (dragLocked) clearDrag();
    }, [dragLocked, clearDrag]);
    useEffect(() => {
        if (!draggingId) return;
        let frame = 0;
        let previousTime = performance.now();
        const scroll = (time: number) => {
            const elapsed = Math.min(32, time - previousTime) / 1000;
            previousTime = time;
            const viewport = pageScroll.current;
            const x = dragX.current;
            if (viewport && x !== null) {
                const rect = viewport.getBoundingClientRect();
                const left = Math.max(0, Math.min(1, (rect.left + 32 - x) / 32));
                const right = Math.max(0, Math.min(1, (x - rect.right + 32) / 32));
                const delta = (right - left) * 480 * elapsed;
                const before = viewport.scrollLeft;
                viewport.scrollLeft += delta;
                if (viewport.scrollLeft !== before) locateDrop(x);
            }
            frame = requestAnimationFrame(scroll);
        };
        frame = requestAnimationFrame(scroll);
        window.addEventListener('blur', clearDrag);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener('blur', clearDrag);
        };
    }, [draggingId, clearDrag, locateDrop]);
    useEffect(() => {
        if (listing.data?.some((page) => page.id === pageId))
            currentPageLink.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }, [pageId, listing.data]);
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
    async function reorder(ids: string[]) {
        try {
            await run(async () => {
                setStage('Đang lưu thứ tự trang…');
                const result = await pagesApi.reorder(bookId, ids);
                if (!currentSession()) return;
                const order = new Map(result.pages.map((page) => [page.id, page.orderIndex]));
                cache.setQueryData<PageSummary[]>(
                    pageKeys.list(actor.current || '', bookId),
                    (current) =>
                        current
                            ?.map((page) => ({
                                ...page,
                                orderIndex: order.get(page.id) ?? page.orderIndex,
                            }))
                            .sort((a, b) => a.orderIndex - b.orderIndex),
                );
                for (const item of result.pages)
                    cache.setQueryData<Page>(
                        pageKeys.detail(actor.current || '', item.id),
                        (current) =>
                            current ? { ...current, orderIndex: item.orderIndex } : current,
                    );
            });
        } finally {
            if (currentSession()) setPendingOrder(null);
        }
    }
    async function move(page: PageSummary, direction: -1 | 1) {
        const ids = movedPageIds(listing.data || [], page.id, direction);
        if (ids) await reorder(ids);
    }
    function dragOver(event: DragEvent<HTMLFieldSetElement>) {
        if (!dragSession.current || dragLocked) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        dragX.current = event.clientX;
        locateDrop(event.clientX);
    }
    function drop(event: DragEvent<HTMLFieldSetElement>) {
        const session = dragSession.current;
        if (!session) return;
        event.preventDefault();
        const target = locateDrop(event.clientX);
        clearDrag();
        suppressClickUntil.current = Date.now() + 250;
        if (dragLocked || !target) return;
        const pages = listing.data || [];
        if (
            session.ids.length !== pages.length ||
            session.ids.some((id, index) => id !== pages[index].id)
        ) {
            setError('Danh sách trang đã thay đổi. Vui lòng kéo lại.');
            return;
        }
        const ids = droppedPageIds(pages, session.id, target);
        if (ids) {
            setPendingOrder(ids);
            void reorder(ids);
        }
    }
    const menuIndex = listing.data?.findIndex((page) => page.id === menu?.id) ?? -1;
    return (
        <div className="page-strip-region pointer-events-auto relative w-max max-w-[min(100%,40rem)] rounded-2xl border border-border bg-surface p-2.5">
            <nav
                data-page-dragging={Boolean(draggingId)}
                className="editor-page-dock flex min-w-0 max-w-full items-center gap-1"
                aria-label="Các trang trong sách"
            >
                <fieldset
                    className="m-0 flex min-w-0 items-center gap-1 overflow-x-auto overscroll-x-contain border-0 p-1 [scrollbar-width:thin]"
                    data-page-scroll
                    aria-label="Sắp xếp các trang"
                    ref={pageScroll}
                    onDragEnter={dragOver}
                    onDragOver={dragOver}
                    onDrop={drop}
                    onDragLeave={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        // Scrolling changes the child under the pointer; only clear when leaving the viewport.
                        if (
                            event.clientX < rect.left ||
                            event.clientX > rect.right ||
                            event.clientY < rect.top ||
                            event.clientY > rect.bottom
                        ) {
                            dragX.current = null;
                            setDropTarget(null);
                        }
                    }}
                >
                    {listing.isPending && (
                        <div className="flex items-center gap-2" role="status" aria-busy="true">
                            <span className="sr-only">Đang tải các trang…</span>
                            {[0, 1, 2].map((index) => (
                                <Skeleton key={index} className="size-14 shrink-0 rounded-xl" />
                            ))}
                        </div>
                    )}
                    {listing.isError && (
                        <ActionButton
                            variant="outline"
                            size="sm"
                            type="button"
                            onClick={() => void listing.refetch()}
                        >
                            Thử tải danh sách trang
                        </ActionButton>
                    )}
                    {listing.data?.map((page) => (
                        <div
                            className="page-thumbnail group relative shrink-0 p-1 transition-opacity duration-150 data-[dragging=true]:opacity-40 motion-reduce:transition-none"
                            key={page.id}
                            data-page-id={page.id}
                            data-dragging={draggingId === page.id}
                        >
                            {dropTarget?.id === page.id && draggingId !== page.id && (
                                <span
                                    aria-hidden="true"
                                    data-page-drop-marker
                                    className={cn(
                                        'pointer-events-none absolute inset-y-1 w-0.5 rounded-full bg-primary',
                                        dropTarget.after ? 'right-0' : 'left-0',
                                    )}
                                />
                            )}
                            <div className="relative" data-page-visual>
                                <Link
                                    className="relative grid size-14 place-items-center rounded-xl border border-border bg-surface p-1 no-underline transition-[transform,border-color,box-shadow] duration-200 ease-out hover:border-input focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-[current=page]:border-primary aria-[current=page]:ring-1 aria-[current=page]:ring-primary data-[reorderable=true]:cursor-grab data-[reorderable=true]:active:cursor-grabbing group-data-[dragging=true]:scale-95 motion-reduce:transform-none motion-reduce:transition-none"
                                    draggable={!dragLocked}
                                    data-reorderable={!dragLocked}
                                    onDragStart={(event) => {
                                        if (dragLocked || menu) {
                                            event.preventDefault();
                                            return;
                                        }
                                        setError(null);
                                        dragSession.current = {
                                            id: page.id,
                                            ids: (listing.data || []).map((item) => item.id),
                                        };
                                        event.dataTransfer.effectAllowed = 'move';
                                        event.dataTransfer.setData(
                                            'application/x-bookaria-page',
                                            page.id,
                                        );
                                        event.dataTransfer.setDragImage(
                                            event.currentTarget,
                                            28,
                                            28,
                                        );
                                        setDraggingId(page.id);
                                    }}
                                    onDragEnd={() => {
                                        suppressClickUntil.current = Date.now() + 250;
                                        clearDrag();
                                    }}
                                    ref={pageId === page.id ? currentPageLink : undefined}
                                    aria-label={`Trang ${page.orderIndex + 1}: ${page.title || 'Chưa đặt tên'}`}
                                    to={`/books/${bookId}/pages/${page.id}`}
                                    aria-current={pageId === page.id ? 'page' : undefined}
                                    aria-disabled={disabled || busy}
                                    onClick={(event) => {
                                        if (
                                            disabled ||
                                            busy ||
                                            (event.detail > 0 &&
                                                Date.now() < suppressClickUntil.current)
                                        )
                                            event.preventDefault();
                                    }}
                                    title={`${page.title || `Trang ${page.orderIndex + 1}`}${!dragLocked ? ' · Kéo để đổi thứ tự' : ''}`}
                                >
                                    <img
                                        className="size-full rounded-lg object-contain"
                                        src={page.thumbnailUrl}
                                        alt=""
                                        loading="lazy"
                                        decoding="async"
                                        draggable={false}
                                    />
                                    <span
                                        className="absolute right-0.5 bottom-0.5 rounded-sm bg-surface px-1 text-[10px] text-foreground tabular-nums leading-4"
                                        aria-hidden="true"
                                    >
                                        {page.orderIndex + 1}
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
                                    <Tooltip delayDuration={250}>
                                        <TooltipTrigger asChild>
                                            <DropdownMenuTrigger asChild>
                                                <ActionButton
                                                    variant="plain"
                                                    className="page-thumbnail-menu absolute top-0 right-0 grid size-6 place-items-center rounded-md border border-border bg-surface text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-focus-within:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 [[data-page-dragging=true]_&]:invisible"
                                                    type="button"
                                                    disabled={
                                                        disabled || busy || Boolean(draggingId)
                                                    }
                                                    aria-label={`Tùy chọn trang ${page.orderIndex + 1}`}
                                                    ref={(node) => {
                                                        if (node && menu?.id === page.id)
                                                            menuAnchor.current = node;
                                                    }}
                                                >
                                                    <MoreHorizontal size={14} />
                                                </ActionButton>
                                            </DropdownMenuTrigger>
                                        </TooltipTrigger>
                                        {dirty && (
                                            <TooltipContent side="top" sideOffset={8}>
                                                Lưu thay đổi để quản lý trang
                                            </TooltipContent>
                                        )}
                                    </Tooltip>
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
                                                    const result = await pagesApi.duplicate(
                                                        menu.id,
                                                    );
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
                        </div>
                    ))}
                </fieldset>
                <Tooltip delayDuration={250}>
                    <TooltipTrigger asChild>
                        <span
                            className="inline-flex shrink-0 rounded-xl outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                            tabIndex={dirty ? 0 : undefined}
                        >
                            <ActionButton
                                variant="plain"
                                className="strip-add-page grid size-14 shrink-0 place-items-center rounded-xl border border-border bg-surface text-primary transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground disabled:pointer-events-none"
                                type="button"
                                disabled={locked || listing.isPending || listing.isError}
                                aria-label="Thêm trang"
                                ref={addAnchor}
                                onClick={() => {
                                    setAdding(true);
                                    setError(null);
                                }}
                            >
                                <Plus size={20} aria-hidden="true" />
                                <span className="sr-only">Thêm trang</span>
                            </ActionButton>
                        </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={8}>
                        {dirty ? 'Lưu thay đổi để tiếp tục' : 'Thêm trang'}
                    </TooltipContent>
                </Tooltip>
            </nav>
            {busy && (
                <p
                    className="page-strip-feedback pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 m-0 -translate-x-1/2 whitespace-nowrap rounded-lg bg-surface px-3 py-2 text-muted-foreground text-xs shadow-sm"
                    role="status"
                >
                    {stage || 'Đang cập nhật trang…'}
                </p>
            )}
            {!menu && <Feedback error={error} />}
            {uncertain && (
                <div className="page-strip-feedback m-0 px-2 py-2 text-[length:12px] text-muted-foreground">
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
