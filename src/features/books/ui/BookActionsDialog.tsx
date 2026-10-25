import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChartNoAxesCombined, FileText, Pencil, Trash2, Type } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../../../shared/api/errors';
import type { BookSummary } from '../../../shared/contracts/dto.schema';
import { Badge } from '../../../shared/ui/Badge';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { Button as ActionButton } from '../../../shared/ui/primitives/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '../../../shared/ui/primitives/dialog';
import { Field, FieldGroup, FieldLabel } from '../../../shared/ui/primitives/field';
import { Input } from '../../../shared/ui/primitives/input';
import { Separator } from '../../../shared/ui/primitives/separator';
import { Spinner } from '../../../shared/ui/primitives/spinner';
import { auth, useAuth } from '../../auth';
import { bookKeys, booksApi } from '../model/books';
import { bookStatusLabels } from '../model/search';

export function BookActionsDialog({
    book,
    opener,
    onClose,
    onDelete,
    onInfo,
}: {
    book: BookSummary;
    opener: HTMLElement | null;
    onClose: () => void;
    onDelete: () => void;
    onInfo: () => void;
}) {
    const { user } = useAuth();
    const actor = useRef(user?.id);
    const cache = useQueryClient();
    const [renaming, setRenaming] = useState(false);
    const [title, setTitle] = useState(book.title);
    const [error, setError] = useState<string | null>(null);
    const input = useRef<HTMLInputElement>(null);
    const rename = useMutation({
        mutationFn: (name: string) => booksApi.update(book.id, { title: name }),
        onSuccess: async () => {
            if (auth.store.getState().user?.id === actor.current)
                await cache.invalidateQueries({ queryKey: bookKeys.all });
        },
    });
    const active = useRef(false);
    const handoff = useRef(false);
    useEffect(() => {
        if (renaming) input.current?.select();
    }, [renaming]);

    async function save(event: FormEvent) {
        event.preventDefault();
        if (active.current) return;
        const name = title.trim();
        if (!name) {
            setError('Nhập tên sách trước khi lưu.');
            input.current?.focus();
            return;
        }
        if (name === book.title) {
            setRenaming(false);
            return;
        }
        active.current = true;
        setError(null);
        try {
            if (auth.store.getState().user?.id !== actor.current)
                throw new Error('Phiên đăng nhập đã thay đổi. Hãy đăng nhập lại.');
            await rename.mutateAsync(name);
            if (auth.store.getState().user?.id !== actor.current) return;
            onClose();
        } catch (cause) {
            setError(errorMessage(cause));
        } finally {
            active.current = false;
        }
    }

    function close() {
        if (active.current) return;
        if (renaming) {
            setRenaming(false);
            setError(null);
        } else onClose();
    }

    return (
        <Dialog open onOpenChange={(open) => !open && close()}>
            <DialogContent
                className="max-w-100 p-0"
                showCloseButton={!rename.isPending}
                onOpenAutoFocus={(event) => {
                    if (renaming) {
                        event.preventDefault();
                        input.current?.select();
                    }
                }}
                onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    if (handoff.current) return;
                    if (opener?.isConnected) opener.focus({ preventScroll: true });
                    else document.querySelector<HTMLElement>('a[href^="/books/new"]')?.focus();
                }}
                onEscapeKeyDown={(event) => {
                    if (rename.isPending) event.preventDefault();
                }}
                onInteractOutside={(event) => {
                    if (renaming || rename.isPending) event.preventDefault();
                }}
            >
                <DialogHeader className="gap-3 px-5 pt-6 pr-12 pb-4">
                    <DialogTitle className="wrap-anywhere leading-snug">
                        {renaming ? 'Đổi tên sách' : book.title}
                    </DialogTitle>
                    <DialogDescription asChild>
                        {renaming ? (
                            <p>Đặt tên để dễ tìm lại cuốn sách của bạn.</p>
                        ) : (
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge>{bookStatusLabels[book.status]}</Badge>
                                <span>{book.pageCount} trang</span>
                                {book.takenDown && <Badge tone="danger">Đã bị gỡ</Badge>}
                            </div>
                        )}
                    </DialogDescription>
                </DialogHeader>
                <Separator />
                {renaming ? (
                    <form
                        className="flex flex-col gap-5 p-5"
                        onSubmit={(event) => void save(event)}
                    >
                        <FieldGroup>
                            <Field data-invalid={Boolean(error)}>
                                <FieldLabel htmlFor="rename-book-title">Tên sách</FieldLabel>
                                <Input
                                    ref={input}
                                    id="rename-book-title"
                                    value={title}
                                    onChange={(event) => {
                                        setTitle(event.target.value);
                                        setError(null);
                                    }}
                                    maxLength={200}
                                    required
                                    disabled={rename.isPending}
                                    aria-invalid={Boolean(error)}
                                    aria-describedby={error ? 'rename-book-error' : undefined}
                                />
                            </Field>
                        </FieldGroup>
                        <div id="rename-book-error">
                            <Feedback error={error} />
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <ActionButton
                                variant="ghost"
                                disabled={rename.isPending}
                                onClick={close}
                            >
                                <ArrowLeft data-icon="inline-start" aria-hidden="true" />
                                Quay lại
                            </ActionButton>
                            <Button type="submit" disabled={rename.isPending}>
                                {rename.isPending && (
                                    <Spinner data-icon="inline-start" aria-hidden="true" />
                                )}
                                {rename.isPending ? 'Đang lưu…' : 'Lưu tên sách'}
                            </Button>
                        </div>
                    </form>
                ) : (
                    <div className="flex flex-col gap-1 p-3">
                        <ActionButton
                            variant="ghost"
                            className="min-h-14 justify-start gap-3 px-3"
                            asChild
                        >
                            <Link to={`/books/${book.id}/edit`}>
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-primary">
                                    <Pencil aria-hidden="true" />
                                </span>
                                Mở editor
                            </Link>
                        </ActionButton>
                        <ActionButton
                            variant="ghost"
                            className="min-h-14 justify-start gap-3 px-3"
                            onClick={() => {
                                handoff.current = true;
                                onInfo();
                            }}
                        >
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-primary">
                                <FileText aria-hidden="true" />
                            </span>
                            Thông tin sách
                        </ActionButton>
                        <ActionButton
                            variant="ghost"
                            className="min-h-14 justify-start gap-3 px-3"
                            asChild
                        >
                            <Link to={`/books/${book.id}/stats`}>
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-primary">
                                    <ChartNoAxesCombined aria-hidden="true" />
                                </span>
                                Thống kê
                            </Link>
                        </ActionButton>
                        <ActionButton
                            variant="ghost"
                            className="min-h-14 justify-start gap-3 px-3"
                            onClick={() => {
                                setTitle(book.title);
                                setRenaming(true);
                                setError(null);
                            }}
                        >
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-primary">
                                <Type aria-hidden="true" />
                            </span>
                            Đổi tên
                        </ActionButton>
                        <ActionButton
                            variant="plain"
                            className="flex min-h-14 items-center gap-3 rounded-[var(--radius-md)] px-3 font-semibold text-destructive text-sm hover:bg-destructive/10"
                            onClick={onDelete}
                        >
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                                <Trash2 aria-hidden="true" />
                            </span>
                            Chuyển vào thùng rác
                        </ActionButton>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
