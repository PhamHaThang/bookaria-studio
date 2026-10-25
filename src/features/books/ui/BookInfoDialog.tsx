import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, ImagePlus, Trash2, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '../../../shared/api/errors';
import { IdSchema } from '../../../shared/contracts/common.schema';
import type { Asset, BookDetail } from '../../../shared/contracts/dto.schema';
import { Button } from '../../../shared/ui/Button';
import { ConfirmationDialog } from '../../../shared/ui/ConfirmationDialog';
import { Feedback } from '../../../shared/ui/Feedback';
import { LoadingState } from '../../../shared/ui/LoadingState';
import { Button as ActionButton } from '../../../shared/ui/primitives/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '../../../shared/ui/primitives/dialog';
import { Input } from '../../../shared/ui/primitives/input';
import { Progress } from '../../../shared/ui/primitives/progress';
import { Separator } from '../../../shared/ui/primitives/separator';
import { Spinner } from '../../../shared/ui/primitives/spinner';
import { assetKeys, assetsApi } from '../../assets';
import { uploadFile } from '../../assets/api/upload-file';
import { imageUploadRequest, saveUploadedImage } from '../../assets/model/image';
import type { UploadCheckpoint } from '../../assets/model/upload';
import { auth, useAuth } from '../../auth';
import { profileKey } from '../../profile';
import { NavigationGuard } from '../../scene/ui/NavigationGuard';
import { bookKeys, booksApi } from '../model/books';
import { updateBookForm } from '../model/form';
import { BookForm } from './BookForm';

export function BookInfoDialog({
    bookId,
    opener,
    onClose,
    onBusyChange,
    onDirtyChange,
    guardNavigation = true,
}: {
    bookId: string;
    opener?: HTMLElement | null;
    onClose: () => void;
    onBusyChange?: (value: boolean) => void;
    onDirtyChange?: (value: boolean) => void;
    guardNavigation?: boolean;
}) {
    const { user } = useAuth();
    const cache = useQueryClient();
    const formId = useId();
    const actor = useRef(user?.id),
        alive = useRef(true);
    const controller = useRef<AbortController | null>(null);
    const input = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false),
        [metadataDirty, setMetadataDirty] = useState(false);
    const [discard, setDiscard] = useState(false),
        [closing, setClosing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null),
        [preview, setPreview] = useState<string | null>(null);
    const [removed, setRemoved] = useState(false),
        [stage, setStage] = useState('');
    const [progress, setProgress] = useState(0);
    const checkpoint = useRef<UploadCheckpoint | null>(null),
        ready = useRef<Asset | null>(null);
    const valid = IdSchema.safeParse(bookId).success;
    const detail = useQuery({
        queryKey: bookKeys.detail(user?.id || '', bookId),
        queryFn: ({ signal }) => booksApi.detail(bookId, signal),
        enabled: valid && Boolean(user),
        refetchOnWindowFocus: false,
        retry: false,
    });
    const dirty = Boolean(metadataDirty || file || removed) && !closing;
    useEffect(() => {
        onBusyChange?.(busy);
    }, [busy, onBusyChange]);
    useEffect(() => {
        onDirtyChange?.(dirty);
    }, [dirty, onDirtyChange]);
    useEffect(() => {
        if (closing && !busy) onClose();
    }, [closing, busy, onClose]);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
            controller.current?.abort();
            onBusyChange?.(false);
            onDirtyChange?.(false);
        };
    }, [onBusyChange, onDirtyChange]);
    useEffect(() => {
        if (!file) {
            setPreview(null);
            return;
        }
        const url = URL.createObjectURL(file);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);
    function checkSession() {
        if (!alive.current || !actor.current || auth.store.getState().user?.id !== actor.current)
            throw new Error('Phiên đăng nhập đã thay đổi. Hãy mở lại thông tin sách.');
    }
    function close() {
        if (controller.current) return;
        if (dirty) setDiscard(true);
        else setClosing(true);
    }
    async function save(form: FormData) {
        if (controller.current || !detail.data) return;
        const active = new AbortController();
        try {
            checkSession();
            const body = updateBookForm(form);
            controller.current = active;
            setBusy(true);
            setError(null);
            const persist = async (coverAssetId?: string | null) => {
                checkSession();
                setStage('Đang lưu thông tin sách…');
                const saved = await booksApi.update(bookId, {
                    ...body,
                    ...(coverAssetId !== undefined ? { coverAssetId } : {}),
                });
                checkSession();
                cache.setQueryData<BookDetail>(
                    bookKeys.detail(actor.current || '', bookId),
                    (current) => (current ? { ...current, ...saved } : current),
                );
            };
            if (file) {
                await saveUploadedImage({
                    api: {
                        signature: (...args) => {
                            checkSession();
                            return assetsApi.signature(...args);
                        },
                        complete: (...args) => {
                            checkSession();
                            return assetsApi.complete(...args);
                        },
                    },
                    transfer: uploadFile,
                    file,
                    purpose: 'ASSET',
                    metadata: { name: file.name, tags: [] },
                    signal: active.signal,
                    checkpoint: checkpoint.current,
                    readyAsset: ready.current,
                    onCheckpoint: (value) => {
                        checkpoint.current = value;
                    },
                    onReady: (asset) => {
                        ready.current = asset;
                        void cache.invalidateQueries({ queryKey: assetKeys.all });
                        void cache.invalidateQueries({ queryKey: profileKey(actor.current || '') });
                    },
                    onStage: (value) =>
                        setStage(
                            {
                                signing: 'Đang chuẩn bị ảnh bìa…',
                                uploading: 'Đang tải ảnh bìa…',
                                completing: 'Đang xác nhận ảnh bìa…',
                            }[value],
                        ),
                    onProgress: setProgress,
                    onSaving: () => setStage('Đang lưu thông tin sách…'),
                    save: persist,
                });
            } else await persist(removed ? null : undefined);
            await cache.invalidateQueries({ queryKey: bookKeys.all });
            checkSession();
            toast.success('Đã lưu thông tin sách.');
            setClosing(true);
        } catch (cause) {
            if (alive.current && !active.signal.aborted) setError(errorMessage(cause));
        } finally {
            if (controller.current === active) {
                controller.current = null;
                if (alive.current) setBusy(false);
            }
        }
    }
    const book = detail.data;
    const cover = preview || (!removed ? book?.coverUrl : null);
    return (
        <>
            {guardNavigation && (
                <NavigationGuard
                    dirty={dirty}
                    saving={busy}
                    title="Rời phần thông tin sách?"
                    dirtyDescription="Thông tin và ảnh bìa bạn đã chọn chưa được lưu. Rời trang sẽ bỏ phần đang sửa."
                />
            )}
            <Dialog
                open
                onOpenChange={(open) => {
                    if (!open) close();
                }}
            >
                <DialogContent
                    showCloseButton={false}
                    className="flex max-h-[calc(100dvh-64px)] max-w-190 flex-col gap-0 overflow-hidden p-0"
                    onInteractOutside={(event) => event.preventDefault()}
                    onEscapeKeyDown={(event) => {
                        if (busy) event.preventDefault();
                    }}
                    onCloseAutoFocus={(event) => {
                        if (opener?.isConnected) {
                            event.preventDefault();
                            opener.focus({ preventScroll: true });
                        }
                    }}
                >
                    <DialogHeader className="gap-3 px-7 pt-6 pr-18 pb-5">
                        <DialogTitle size="lg" className="m-0">
                            Thông tin sách
                        </DialogTitle>
                        <DialogDescription className="m-0">
                            Cập nhật thông tin và ảnh bìa của cuốn sách.
                        </DialogDescription>
                    </DialogHeader>
                    <ActionButton
                        variant="ghost"
                        size="icon"
                        className="absolute top-5 right-5"
                        aria-label="Đóng thông tin sách"
                        disabled={busy}
                        onClick={close}
                    >
                        <X data-icon="inline-start" />
                    </ActionButton>
                    <div className="flex min-h-0 flex-col gap-6 overflow-y-auto px-7 pb-6 [overscroll-behavior:contain] [scrollbar-color:var(--border-input)_var(--bg-surface)] [scrollbar-width:thin]">
                        {!valid && <Feedback error="Đường dẫn sách không hợp lệ." />}
                        {valid && detail.isPending && (
                            <LoadingState layout="profile">Đang tải thông tin sách…</LoadingState>
                        )}
                        {detail.isError && (
                            <div>
                                <Feedback error={errorMessage(detail.error)} />
                                <Button
                                    variant="secondary"
                                    disabled={busy || detail.isFetching}
                                    onClick={() => void detail.refetch()}
                                >
                                    Thử tải lại
                                </Button>
                            </div>
                        )}
                        {book && (
                            <>
                                {book.takenDown && (
                                    <Feedback warning="Sách đang bị gỡ. Một số thao tác có thể bị hạn chế." />
                                )}
                                <section
                                    aria-label="Ảnh bìa sách"
                                    className="flex items-center gap-5"
                                >
                                    <ActionButton
                                        variant="plain"
                                        disabled={busy}
                                        aria-label="Chọn ảnh bìa sách"
                                        onClick={() => input.current?.click()}
                                        className="flex h-32 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted"
                                    >
                                        {cover ? (
                                            <img
                                                src={cover}
                                                alt="Ảnh bìa sách"
                                                className="size-full object-contain"
                                            />
                                        ) : (
                                            <BookOpen
                                                aria-hidden="true"
                                                className="size-8 text-muted-foreground"
                                            />
                                        )}
                                    </ActionButton>
                                    <div className="flex min-w-0 flex-col items-start gap-3">
                                        <span className="font-semibold text-sm">Ảnh bìa</span>
                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                disabled={busy}
                                                onClick={() => input.current?.click()}
                                            >
                                                <ImagePlus data-icon="inline-start" />
                                                {cover ? 'Đổi ảnh bìa' : 'Chọn ảnh bìa'}
                                            </Button>
                                            {(cover || file) && (
                                                <ActionButton
                                                    variant="ghost"
                                                    size="sm"
                                                    disabled={busy}
                                                    onClick={() => {
                                                        setFile(null);
                                                        setRemoved(Boolean(book.coverUrl));
                                                        checkpoint.current = null;
                                                        ready.current = null;
                                                        if (input.current) input.current.value = '';
                                                    }}
                                                >
                                                    <Trash2 data-icon="inline-start" />
                                                    Gỡ ảnh
                                                </ActionButton>
                                            )}
                                        </div>
                                        <span className="text-muted-foreground text-xs">
                                            JPG, PNG hoặc WebP · Tối đa 10 MB
                                        </span>
                                        {file && (
                                            <span
                                                className="max-w-full truncate text-xs"
                                                title={file.name}
                                            >
                                                {file.name}
                                            </span>
                                        )}
                                    </div>
                                    <Input
                                        ref={input}
                                        type="file"
                                        className="hidden"
                                        tabIndex={-1}
                                        accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                                        disabled={busy}
                                        onChange={(event) => {
                                            const next = event.currentTarget.files?.[0];
                                            event.currentTarget.value = '';
                                            if (!next) return;
                                            try {
                                                imageUploadRequest(next, 'ASSET');
                                                setFile(next);
                                                setRemoved(false);
                                                checkpoint.current = null;
                                                ready.current = null;
                                                setError(null);
                                            } catch (cause) {
                                                setError(errorMessage(cause));
                                            }
                                        }}
                                    />
                                </section>
                                <BookForm
                                    id={formId}
                                    key={book.id}
                                    book={book}
                                    busy={busy}
                                    error={error}
                                    hideActions
                                    onDirtyChange={setMetadataDirty}
                                    onSubmit={(form) => void save(form)}
                                />
                                {busy && (
                                    <div role="status" className="flex flex-col gap-3">
                                        <span className="flex items-center gap-2 text-sm">
                                            <Spinner aria-hidden="true" />
                                            {stage}
                                        </span>
                                        {stage === 'Đang tải ảnh bìa…' && (
                                            <Progress
                                                value={progress}
                                                max={100}
                                                aria-label="Tiến độ tải ảnh bìa"
                                            />
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <Separator className="h-px w-full" />
                    <footer className="flex justify-end gap-3 px-7 py-5">
                        <Button variant="secondary" disabled={busy} onClick={close}>
                            Hủy
                        </Button>
                        <Button
                            type="submit"
                            form={formId}
                            disabled={busy || !book}
                            aria-busy={busy}
                        >
                            {busy && <Spinner data-icon="inline-start" />}
                            {busy ? 'Đang lưu…' : 'Lưu thông tin sách'}
                        </Button>
                    </footer>
                </DialogContent>
            </Dialog>
            {discard && (
                <ConfirmationDialog
                    title="Bỏ thay đổi thông tin sách?"
                    description="Thông tin và ảnh bìa đang chọn chưa được lưu."
                    busy={false}
                    onClose={() => setDiscard(false)}
                >
                    <div className="mt-6 flex justify-end gap-3">
                        <Button variant="secondary" onClick={() => setDiscard(false)}>
                            Tiếp tục sửa
                        </Button>
                        <Button variant="destructive" onClick={() => setClosing(true)}>
                            Bỏ thay đổi
                        </Button>
                    </div>
                </ConfirmationDialog>
            )}
        </>
    );
}
