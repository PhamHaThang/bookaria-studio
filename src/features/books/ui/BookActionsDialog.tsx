import { ChartNoAxesCombined, FileText, Pencil, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import type { BookSummary } from '../../../shared/contracts/dto.schema';
import { Badge } from '../../../shared/ui/Badge';
import { Button as ActionButton } from '../../../shared/ui/primitives/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '../../../shared/ui/primitives/dialog';
import { Separator } from '../../../shared/ui/primitives/separator';
import { BookStatusBadge } from './BookStatusBadge';

export function BookActionsDialog({
    book,
    opener,
    onClose,
    onDelete,
    onInfo,
    onStats,
}: {
    book: BookSummary;
    opener: HTMLElement | null;
    onClose: () => void;
    onDelete: () => void;
    onInfo: () => void;
    onStats: () => void;
}) {
    const handoff = useRef(false);

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                className="max-w-100 p-0"
                onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    if (handoff.current) return;
                    if (opener?.isConnected) opener.focus({ preventScroll: true });
                    else document.querySelector<HTMLElement>('a[href^="/books/new"]')?.focus();
                }}
            >
                <DialogHeader className="gap-3 px-5 pt-6 pr-12 pb-4">
                    <DialogTitle className="wrap-anywhere leading-snug">{book.title}</DialogTitle>
                    <DialogDescription asChild>
                        <div className="flex flex-wrap items-center gap-2">
                            <BookStatusBadge status={book.status} />
                            {book.takenDown && <Badge tone="danger">Đã bị gỡ</Badge>}
                            <span>{book.pageCount} trang</span>
                        </div>
                    </DialogDescription>
                </DialogHeader>
                <Separator />
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
                        onClick={() => {
                            handoff.current = true;
                            onStats();
                        }}
                    >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-primary">
                            <ChartNoAxesCombined aria-hidden="true" />
                        </span>
                        Thống kê
                    </ActionButton>
                    <ActionButton
                        variant="ghost"
                        className="min-h-14 justify-start gap-3 px-3 text-destructive/90 hover:not-disabled:bg-destructive/5"
                        onClick={onDelete}
                    >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-destructive/40">
                            <Trash2 aria-hidden="true" />
                        </span>
                        Chuyển vào thùng rác
                    </ActionButton>
                </div>
            </DialogContent>
        </Dialog>
    );
}
