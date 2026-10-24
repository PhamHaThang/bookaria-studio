import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, MoreHorizontal, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../../../shared/api/errors';
import type { Page, PageSummary } from '../../../shared/contracts/dto.schema';
import { Button } from '../../../shared/ui/Button';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import { Feedback } from '../../../shared/ui/Feedback';
import { assetKeys } from '../../assets';
import { auth, useAuth } from '../../auth';
import { bookKeys } from '../../books';
import { pageKeys, pagesApi } from '../../pages';
import { type BlankPageCheckpoint, createBlankPage } from '../../pages/model/blank-page';
import { type BlankUploadCheckpoint, uploadBlankPage } from '../../pages/model/blank-page-upload';
import { movedPageIds, uncertainWrite } from '../../pages/model/operations';
import { PageImageForm } from '../../pages/ui/PageImageForm';
import '../../pages/ui/pages.css';
import './page-strip.css';
import { PageActionsMenu } from './PageActionsMenu';

export function PageStrip({
    bookId,
    pageId,
    pageAspect,
    disabled,
    dirty,
    onBusyChange,
}: {
    bookId: string;
    pageId: string;
    pageAspect: number;
    disabled: boolean;
    dirty: boolean;
    onBusyChange: (busy: boolean) => void;
}) {
    const { user } = useAuth();
    const cache = useQueryClient(),
        navigate = useNavigate();
    const [busy, setBusy] = useState(false),
        [uncertain, setUncertain] = useState(false);
    const [stage, setStage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [menu, setMenu] = useState<PageSummary | null>(null);
    const menuAnchor = useRef<HTMLButtonElement | null>(null);
    const [renaming, setRenaming] = useState(false);
    const [deleting, setDeleting] = useState(false),
        [addingImage, setAddingImage] = useState(false);
    const [target, setTarget] = useState<string | null>(null);
    const active = useRef(false),
        alive = useRef(true);
    const blank = useRef<BlankPageCheckpoint>({}),
        upload = useRef<BlankUploadCheckpoint>({});
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
    function busyChange(value: boolean) {
        setBusy(value);
        onBusyChange(value);
    }
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
    async function addBlank() {
        await run(async () => {
            const result = await createBlankPage({
                bookId,
                checkpoint: blank.current,
                onCheckpoint: (value) => {
                    blank.current = value;
                },
                upload: () =>
                    uploadBlankPage({
                        aspect: pageAspect,
                        checkpoint: upload.current,
                        onCheckpoint: (value) => {
                            upload.current = value;
                        },
                        signal: new AbortController().signal,
                        onStage: (value) => {
                            if (!currentSession()) throw new Error('Phiên đăng nhập đã thay đổi.');
                            setStage(value);
                        },
                    }),
                add: (id, body) => {
                    if (!currentSession()) throw new Error('Phiên đăng nhập đã thay đổi.');
                    setStage('Đang thêm trang…');
                    return pagesApi.add(id, body);
                },
            });
            if (!currentSession()) return;
            blank.current = {};
            upload.current = {};
            void cache.invalidateQueries({ queryKey: assetKeys.all });
            setTarget(`/books/${bookId}/pages/${result.page.id}`);
        }, true);
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
        <div className="page-strip-region">
            <nav className="editor-page-strip scene-page-strip" aria-label="Các trang trong sách">
                <span className="page-strip-label">Trang sách</span>
                {listing.isPending && <span role="status">Đang tải các trang…</span>}
                {listing.isError && (
                    <button type="button" onClick={() => void listing.refetch()}>
                        Thử tải danh sách trang
                    </button>
                )}
                {listing.data?.map((page) => (
                    <div className="page-thumbnail" key={page.id}>
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
                            <span className="sr-only">
                                {page.title || `Trang ${page.orderIndex + 1}`}
                            </span>
                        </Link>
                        <button
                            className="page-thumbnail-menu"
                            type="button"
                            disabled={disabled || busy}
                            aria-label={`Tùy chọn trang ${page.orderIndex + 1}`}
                            aria-haspopup="menu"
                            aria-expanded={menu?.id === page.id && !renaming && !deleting}
                            aria-controls={menu?.id === page.id ? 'page-actions-menu' : undefined}
                            onClick={(event) => {
                                menuAnchor.current = event.currentTarget;
                                setRenaming(false);
                                setMenu(page);
                                setDeleting(false);
                                setError(null);
                            }}
                        >
                            <MoreHorizontal size={14} />
                        </button>
                    </div>
                ))}
                <button
                    className="strip-add-page"
                    type="button"
                    disabled={locked || listing.isPending || listing.isError}
                    title={dirty ? 'Lưu nội dung trước khi thêm trang' : 'Thêm trang trắng'}
                    onClick={() => void addBlank()}
                >
                    <Plus size={20} aria-hidden="true" />
                    <span>Thêm trang</span>
                </button>
                <button
                    className="strip-image-page"
                    type="button"
                    disabled={locked}
                    onClick={() => {
                        setAddingImage(true);
                        setError(null);
                    }}
                >
                    <ImagePlus size={18} aria-hidden="true" />
                    <span>Thêm từ ảnh</span>
                </button>
            </nav>
            {busy && (
                <p className="page-strip-feedback" role="status">
                    {stage || 'Đang cập nhật trang…'}
                </p>
            )}
            {dirty && (
                <p className="page-strip-feedback">
                    Lưu nội dung hiện tại trước khi thêm hoặc quản lý trang.
                </p>
            )}
            {!menu && <Feedback error={error} />}
            {uncertain && (
                <div className="page-strip-feedback">
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
                                setAddingImage(false);
                                blank.current = {};
                                upload.current = {};
                            }
                            if (currentSession()) busyChange(false);
                        }}
                    >
                        Tải lại danh sách trang
                    </Button>
                </div>
            )}
            {menu && !renaming && !deleting && menuAnchor.current && (
                <PageActionsMenu
                    anchor={menuAnchor.current}
                    title={menu.title || `Trang ${menu.orderIndex + 1}`}
                    locked={locked}
                    first={menuIndex <= 0}
                    last={menuIndex >= (listing.data?.length || 0) - 1}
                    error={error}
                    onClose={() => setMenu(null)}
                    onRename={() => setRenaming(true)}
                    onMove={(direction) => void move(menu, direction)}
                    onDelete={() => setDeleting(true)}
                    onDuplicate={() =>
                        void run(async () => {
                            const result = await pagesApi.duplicate(menu.id);
                            if (currentSession())
                                setTarget(`/books/${bookId}/pages/${result.page.id}`);
                        }, true)
                    }
                />
            )}
            {menu && (renaming || deleting) && (
                <ConfirmDialog
                    title={deleting ? 'Xóa trang sách?' : `Trang ${menu.orderIndex + 1}`}
                    busy={busy}
                    className="page-actions-dialog"
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
                            <div className="form-actions">
                                <Button
                                    variant="secondary"
                                    disabled={busy}
                                    onClick={() => setDeleting(false)}
                                >
                                    Giữ lại
                                </Button>
                                <Button
                                    variant="danger"
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
                                                        : `/books/${bookId}`,
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
                                <label htmlFor="scene-page-title">
                                    Tên trang
                                    <input
                                        id="scene-page-title"
                                        name="title"
                                        maxLength={150}
                                        defaultValue={menu.title || ''}
                                        disabled={locked}
                                        placeholder={`Trang ${menu.orderIndex + 1}`}
                                    />
                                </label>
                                <Button type="submit" disabled={locked}>
                                    Lưu tên trang
                                </Button>
                            </form>
                            {dirty && <p>Lưu nội dung đang sửa trước khi thao tác với trang.</p>}
                            <Button variant="ghost" disabled={busy} onClick={() => setMenu(null)}>
                                <X size={17} />
                                Đóng
                            </Button>
                        </>
                    )}
                </ConfirmDialog>
            )}
            {addingImage && (
                <ConfirmDialog
                    title="Thêm trang từ ảnh"
                    busy={busy}
                    className="page-actions-dialog"
                    onClose={() => {
                        if (!busy) setAddingImage(false);
                    }}
                >
                    <PageImageForm
                        title="Ảnh trang"
                        action="Thêm trang và mở editor"
                        disabled={disabled || uncertain || dirty}
                        onBusyChange={busyChange}
                        onUploaded={() => {
                            void cache.invalidateQueries({ queryKey: assetKeys.all });
                        }}
                        onAttach={async (asset, form) => {
                            if (!currentSession()) throw new Error('Phiên đăng nhập đã thay đổi.');
                            try {
                                const result = await pagesApi.add(bookId, {
                                    imageAssetId: asset.id,
                                    title: String(form.get('title') || '').trim() || undefined,
                                });
                                if (currentSession()) {
                                    await refresh();
                                    setTarget(`/books/${bookId}/pages/${result.page.id}`);
                                }
                            } catch (cause) {
                                if (currentSession() && uncertainWrite(cause)) setUncertain(true);
                                throw cause;
                            }
                        }}
                    >
                        <label htmlFor="image-page-title">
                            Tên trang (không bắt buộc)
                            <input id="image-page-title" name="title" maxLength={150} />
                        </label>
                    </PageImageForm>
                    <Button variant="ghost" disabled={busy} onClick={() => setAddingImage(false)}>
                        Đóng
                    </Button>
                </ConfirmDialog>
            )}
        </div>
    );
}
