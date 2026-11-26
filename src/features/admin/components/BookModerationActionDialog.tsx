import { BookOpen } from 'lucide-react';
import type { FormEvent } from 'react';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Feedback } from '@/shared/ui/Feedback';
import { DialogFooter } from '@/shared/ui/primitives/dialog';
import { FieldError, FieldLabel } from '@/shared/ui/primitives/field';
import { Textarea } from '@/shared/ui/primitives/textarea';
import { AdminDialog } from './AdminDialog';

export interface BookTarget {
    id: string;
    title: string;
    author?: { displayName: string };
    reportCount?: number;
    takenDown?: boolean;
}

interface BookModerationActionDialogProps {
    book: BookTarget;
    open: boolean;
    busy: boolean;
    title: string;
    description: string;
    actionLabel: string;
    noteId: string;
    noteLabel: string;
    note: string;
    placeholder: string;
    required?: boolean;
    fieldError: string | null;
    apiError: string | null;
    onNoteChange: (note: string) => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
    onClose: () => void;
}

export function BookModerationActionDialog({
    book,
    open,
    busy,
    title,
    description,
    actionLabel,
    noteId,
    noteLabel,
    note,
    placeholder,
    required = false,
    fieldError,
    apiError,
    onNoteChange,
    onSubmit,
    onClose,
}: BookModerationActionDialogProps) {
    const formId = `${noteId}-form`;
    const errorId = `${noteId}-error`;

    return (
        <AdminDialog
            open={open}
            busy={busy}
            title={title}
            description={description}
            onClose={onClose}
        >
            <div className="-mx-1 min-h-0 space-y-4 overflow-y-auto px-1 pb-1">
                <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface text-muted-foreground">
                        <BookOpen className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <p className="m-0 font-medium text-sm">{book.title}</p>
                            {book.takenDown && <Badge tone="danger">Đã gỡ</Badge>}
                            {!!book.reportCount && (
                                <Badge tone="warning">{book.reportCount} báo cáo chờ</Badge>
                            )}
                        </div>
                        {book.author && (
                            <p className="m-0 mt-0.5 text-muted-foreground text-xs">
                                {book.author.displayName}
                            </p>
                        )}
                    </div>
                </div>
                <Feedback error={apiError} errorMode="toast" />
                <form id={formId} onSubmit={onSubmit} noValidate className="grid gap-2">
                    <FieldLabel htmlFor={noteId} className="m-0">
                        {noteLabel}{' '}
                        {required ? (
                            <span className="text-destructive" aria-hidden="true">
                                *
                            </span>
                        ) : (
                            <span className="font-normal text-muted-foreground">
                                (không bắt buộc)
                            </span>
                        )}
                    </FieldLabel>
                    <Textarea
                        id={noteId}
                        value={note}
                        onChange={(event) => onNoteChange(event.target.value)}
                        placeholder={placeholder}
                        rows={3}
                        maxLength={1000}
                        disabled={busy}
                        required={required}
                        aria-invalid={Boolean(fieldError)}
                        aria-describedby={fieldError ? errorId : undefined}
                        className="m-0 resize-y"
                    />
                    <div className="flex items-start justify-between gap-3 text-muted-foreground text-xs">
                        {fieldError ? (
                            <FieldError id={errorId} className="m-0 text-xs">
                                {fieldError}
                            </FieldError>
                        ) : (
                            <span>
                                {required
                                    ? 'Lý do được gửi đến tác giả và lưu vào nhật ký.'
                                    : 'Ghi chú được lưu vào nhật ký.'}
                            </span>
                        )}
                        <span className="shrink-0 tabular-nums">{note.length}/1000</span>
                    </div>
                </form>
            </div>
            <DialogFooter className="mt-0 shrink-0 flex-row flex-wrap items-center justify-end border-0 pt-0">
                <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
                    Hủy
                </Button>
                <Button
                    type="submit"
                    form={formId}
                    variant={required ? 'destructive' : 'default'}
                    disabled={busy}
                >
                    {busy ? 'Đang xử lý…' : actionLabel}
                </Button>
            </DialogFooter>
        </AdminDialog>
    );
}
