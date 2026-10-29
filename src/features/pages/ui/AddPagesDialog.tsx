import { BookOpen, FileUp, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ContractError } from '../../../shared/api/contract';
import { errorMessage } from '../../../shared/api/errors';
import type { BookDetail } from '../../../shared/contracts/dto.schema';
import { cn } from '../../../shared/lib/cn';
import { Button } from '../../../shared/ui/Button';
import { ConfirmationDialog } from '../../../shared/ui/ConfirmationDialog';
import { Feedback } from '../../../shared/ui/Feedback';
import { Button as ActionButton } from '../../../shared/ui/primitives/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '../../../shared/ui/primitives/dialog';
import { Field, FieldLabel, FieldLegend, FieldSet } from '../../../shared/ui/primitives/field';
import { Progress } from '../../../shared/ui/primitives/progress';
import { RadioGroup, RadioGroupItem } from '../../../shared/ui/primitives/radio-group';
import { Separator } from '../../../shared/ui/primitives/separator';
import { Spinner } from '../../../shared/ui/primitives/spinner';
import { assetsApi } from '../../assets';
import { uploadFile } from '../../assets/api/upload-file';
import { runAssetUpload } from '../../assets/model/upload';
import { auth } from '../../auth';
import { booksApi } from '../../books';
import { bookPageSize } from '../../books/model/page-size';
import { BookImportField, type BookImportValue } from '../../books/ui/BookImportField';
import { blankPageImage } from '../model/blank-page';
import { importPages, type PageImportCheckpoint } from '../model/import-pages';
import { pagesApi } from '../model/pages';

export function AddPagesDialog({
    book,
    disabled,
    opener,
    onClose,
    onComplete,
    onInspect,
    onBusyChange,
    onDraftChange,
}: {
    book: BookDetail;
    disabled: boolean;
    opener: HTMLElement | null;
    onClose: () => void;
    onComplete: (pageId: string) => Promise<void>;
    onInspect: () => Promise<void>;
    onBusyChange: (value: boolean) => void;
    onDraftChange: (value: boolean) => void;
}) {
    const [mode, setMode] = useState<'blank' | 'import'>('blank');
    const [value, setValue] = useState<BookImportValue | null>(null);
    const source = useRef<BookImportValue | null>(null);
    const checkpoint = useRef<PageImportCheckpoint>({ pages: [] });
    const submission = useRef<{
        mode: 'blank' | 'import';
        indices: number[];
        aspect: number;
    } | null>(null);
    const [busy, setBusy] = useState(false),
        [preparing, setPreparing] = useState(false);
    const [locked, setLocked] = useState(false),
        [discard, setDiscard] = useState(false);
    const [completed, setCompleted] = useState(0),
        [stage, setStage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const actor = useRef(auth.store.getState().user?.id);
    const alive = useRef(true),
        active = useRef(false);
    const pending = busy || preparing;
    const dirty = Boolean(value || locked);
    const count =
        submission.current?.indices.length ?? (mode === 'blank' ? 1 : value?.indices.length || 0);
    const size = bookPageSize(book);
    useEffect(() => {
        onBusyChange(pending);
    }, [pending, onBusyChange]);
    useEffect(() => {
        onDraftChange(dirty);
    }, [dirty, onDraftChange]);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
            source.current?.source.dispose();
            onBusyChange(false);
            onDraftChange(false);
        };
    }, [onBusyChange, onDraftChange]);
    function checkSession() {
        if (!alive.current || !actor.current || auth.store.getState().user?.id !== actor.current)
            throw new Error('Phiên đăng nhập đã thay đổi. Hãy mở lại sách.');
    }
    function requestClose() {
        if (pending) return;
        if (dirty) setDiscard(true);
        else onClose();
    }
    async function submit() {
        if (active.current || preparing || disabled || checkpoint.current.uncertain) return;
        active.current = true;
        setError(null);
        setBusy(true);
        try {
            checkSession();
            if (!submission.current) {
                if (mode === 'import' && !value?.indices.length)
                    throw new Error('Chọn PDF hoặc ảnh và ít nhất một trang.');
                setStage('Đang kiểm tra khổ sách…');
                const currentBook = await booksApi.detail(book.id);
                checkSession();
                submission.current = {
                    mode,
                    indices: mode === 'blank' ? [0] : [...(value?.indices || [])],
                    aspect: currentBook.pageAspect,
                };
                setLocked(true);
            }
            const frozen = submission.current;
            const result = await importPages({
                bookId: book.id,
                aspect: frozen.aspect,
                indices: frozen.indices,
                checkpoint: checkpoint.current,
                render: (index, aspect) =>
                    frozen.mode === 'blank'
                        ? blankPageImage(aspect)
                        : (source.current as BookImportValue).source.render(index),
                add: pagesApi.add,
                checkSession,
                onStage: setStage,
                onCheckpoint: (next) => {
                    checkpoint.current = next;
                    if (alive.current)
                        setCompleted(next.pages.filter((page) => page.result).length);
                },
                async upload(file, saved, save) {
                    checkSession();
                    const uploaded = await runAssetUpload({
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
                        purpose: 'PAGE_IMAGE',
                        metadata: { name: file.name, tags: [] },
                        signal: new AbortController().signal,
                        checkpoint: saved || null,
                        onCheckpoint: save,
                        onStage: () => undefined,
                        onProgress: () => undefined,
                    });
                    checkSession();
                    if (
                        uploaded.processing ||
                        uploaded.asset.type !== 'IMAGE' ||
                        uploaded.asset.status !== 'READY'
                    )
                        throw new ContractError();
                    return uploaded.asset.id;
                },
            });
            checkSession();
            await onComplete(result.pageId);
        } catch (cause) {
            if (alive.current) setError(errorMessage(cause));
        } finally {
            active.current = false;
            if (alive.current) setBusy(false);
        }
    }
    return (
        <>
            <Dialog
                open
                onOpenChange={(open) => {
                    if (!open) requestClose();
                }}
            >
                <DialogContent
                    showCloseButton={false}
                    className="flex max-h-[calc(100dvh-64px)] max-w-190 flex-col gap-0 overflow-hidden p-0"
                    onEscapeKeyDown={(event) => {
                        if (pending) event.preventDefault();
                    }}
                    onInteractOutside={(event) => event.preventDefault()}
                    onCloseAutoFocus={(event) => {
                        if (opener?.isConnected) {
                            event.preventDefault();
                            opener.focus({ preventScroll: true });
                        }
                    }}
                >
                    <DialogHeader className="gap-3 px-7 pt-7 pr-18 pb-5">
                        <DialogTitle size="lg">Thêm trang</DialogTitle>
                        <DialogDescription>
                            Trang mới được thêm vào cuối sách. Hoàn tất sẽ mở trang mới đầu tiên.
                        </DialogDescription>
                    </DialogHeader>
                    <ActionButton
                        variant="ghost"
                        size="icon"
                        className="absolute top-5 right-5"
                        aria-label="Đóng hộp thêm trang"
                        disabled={pending}
                        onClick={requestClose}
                    >
                        <X data-icon="inline-start" />
                    </ActionButton>
                    <div className="overflow-y-auto px-7 pb-6 [overscroll-behavior:contain] [scrollbar-color:var(--border-input)_var(--bg-surface)] [scrollbar-width:thin]">
                        <p className="mt-0 mb-5 text-muted-foreground text-sm">
                            Khổ sách hiện tại:{' '}
                            <strong className="text-foreground">
                                {size.widthMm} × {size.heightMm} mm
                            </strong>
                            . PDF và ảnh được đặt vừa trang, phần dư có nền trắng.
                        </p>
                        <FieldSet disabled={pending || locked} className="gap-3">
                            <FieldLegend className="sr-only">Cách thêm trang</FieldLegend>
                            <RadioGroup
                                value={mode}
                                onValueChange={(next) => setMode(next as 'blank' | 'import')}
                                className="grid grid-cols-2 gap-3"
                            >
                                {(
                                    [
                                        {
                                            id: 'blank',
                                            title: 'Trang trắng',
                                            description: 'Một trang để sáng tạo',
                                            icon: BookOpen,
                                        },
                                        {
                                            id: 'import',
                                            title: 'PDF / nhiều ảnh',
                                            description: 'Chọn các trang muốn thêm',
                                            icon: FileUp,
                                        },
                                    ] as const
                                ).map((item) => (
                                    <Field key={item.id} orientation="contents">
                                        <FieldLabel
                                            htmlFor={`add-pages-${item.id}`}
                                            className={cn(
                                                'mb-0 flex min-h-20 cursor-pointer items-center gap-3 rounded-lg border border-primary p-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary has-[:focus-visible]:outline-offset-2',
                                                mode === item.id
                                                    ? 'bg-primary text-primary-foreground'
                                                    : 'bg-surface text-foreground',
                                            )}
                                        >
                                            <RadioGroupItem
                                                id={`add-pages-${item.id}`}
                                                value={item.id}
                                                className="sr-only absolute"
                                            />
                                            <item.icon aria-hidden="true" />
                                            <span className="flex flex-col gap-1">
                                                <span className="font-semibold text-sm">
                                                    {item.title}
                                                </span>
                                                <span className="font-normal text-xs">
                                                    {item.description}
                                                </span>
                                            </span>
                                        </FieldLabel>
                                    </Field>
                                ))}
                            </RadioGroup>
                        </FieldSet>
                        <div className={mode === 'import' ? undefined : 'hidden'}>
                            <BookImportField
                                value={value}
                                disabled={busy || locked}
                                allowReorder
                                onBusyChange={setPreparing}
                                onChange={(next) => {
                                    if (source.current?.source !== next?.source)
                                        source.current?.source.dispose();
                                    source.current = next;
                                    setValue(next);
                                    setError(null);
                                }}
                            />
                        </div>
                        {locked && (
                            <div
                                role="status"
                                aria-live="polite"
                                className="mt-5 flex flex-col gap-3 rounded-lg bg-muted p-4"
                            >
                                <span className="flex items-center gap-2 text-sm">
                                    {busy && <Spinner aria-hidden="true" />}
                                    {busy ? stage : `Đã thêm ${completed}/${count} trang.`}
                                </span>
                                <Progress
                                    value={completed}
                                    max={count}
                                    aria-label="Tiến độ thêm trang"
                                    getValueLabel={() => `${completed}/${count} trang đã thêm`}
                                />
                                {!busy && !checkpoint.current.uncertain && completed < count && (
                                    <p className="m-0 text-muted-foreground text-xs">
                                        Tiếp tục sẽ bỏ qua trang đã thêm và giữ nguyên thứ tự bạn đã
                                        chọn.
                                    </p>
                                )}
                            </div>
                        )}
                        {error && (
                            <div className="mt-4 [&_.feedback]:m-0">
                                <Feedback error={error} />
                            </div>
                        )}
                        {checkpoint.current.uncertain && (
                            <div className="mt-4 flex flex-col items-start gap-3">
                                <p className="m-0 text-sm">
                                    Máy chủ có thể đã thêm trang nhưng chưa trả kết quả. Kiểm tra
                                    danh sách trước khi thêm lần nữa để tránh trùng.
                                </p>
                                <Button
                                    variant="secondary"
                                    disabled={pending}
                                    onClick={async () => {
                                        if (active.current) return;
                                        active.current = true;
                                        setBusy(true);
                                        try {
                                            await onInspect();
                                        } catch (cause) {
                                            if (alive.current) setError(errorMessage(cause));
                                        } finally {
                                            active.current = false;
                                            if (alive.current) setBusy(false);
                                        }
                                    }}
                                >
                                    Xem danh sách trang
                                </Button>
                            </div>
                        )}
                    </div>
                    <Separator className="h-px w-full" />
                    <footer className="flex items-center justify-between gap-4 px-7 py-5">
                        <span className="text-muted-foreground text-sm">
                            {count} trang · Thêm vào cuối sách
                        </span>
                        <div className="flex items-center gap-3">
                            <Button variant="secondary" disabled={pending} onClick={requestClose}>
                                Hủy
                            </Button>
                            <Button
                                disabled={
                                    pending ||
                                    Boolean(checkpoint.current.uncertain) ||
                                    (mode === 'import' && !count)
                                }
                                onClick={() => void submit()}
                            >
                                {busy ? (
                                    <Spinner data-icon="inline-start" />
                                ) : (
                                    <Plus data-icon="inline-start" />
                                )}
                                {busy
                                    ? 'Đang thêm trang…'
                                    : locked
                                      ? 'Tiếp tục thêm trang'
                                      : mode === 'blank'
                                        ? 'Thêm trang trắng'
                                        : `Thêm ${count} trang`}
                            </Button>
                        </div>
                    </footer>
                </DialogContent>
            </Dialog>
            {discard && (
                <ConfirmationDialog
                    title={locked ? 'Dừng thêm trang?' : 'Bỏ tài liệu đã chọn?'}
                    description={
                        locked
                            ? `Các trang đã thêm vẫn được giữ trong sách. Phần còn lại và tiến độ của lần nhập này chỉ được giữ khi bạn ở lại hộp thoại.`
                            : 'Tài liệu bạn đã chọn chưa được thêm vào sách.'
                    }
                    busy={false}
                    onClose={() => setDiscard(false)}
                >
                    <div className="mt-6 flex justify-end gap-3">
                        <Button variant="secondary" onClick={() => setDiscard(false)}>
                            Ở lại
                        </Button>
                        <Button variant="destructive" onClick={onClose}>
                            Đóng hộp thoại
                        </Button>
                    </div>
                </ConfirmationDialog>
            )}
        </>
    );
}
