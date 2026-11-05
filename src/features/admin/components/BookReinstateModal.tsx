import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, RotateCcw, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth';
import { errorMessage } from '@/shared/api/errors';
import { ModerationNoteBodySchema } from '@/shared/contracts/api/admin.schema';
import { Alert } from '@/shared/ui/Alert';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/shared/ui/primitives/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Textarea } from '@/shared/ui/primitives/textarea';
import { adminApi } from '../client';
import { adminKeys } from '../model';
import type { BookTarget } from './BookTakedownModal';

interface BookReinstateModalProps {
    book: BookTarget | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export function BookReinstateModal({ book, isOpen, onClose, onSuccess }: BookReinstateModalProps) {
    const { user: currentAdmin } = useAuth();
    const queryClient = useQueryClient();

    const [note, setNote] = useState('');
    const [fieldError, setFieldError] = useState<string | null>(null);
    const [apiError, setApiError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setNote('');
            setFieldError(null);
            setApiError(null);
        }
    }, [isOpen]);

    const reinstateMutation = useMutation({
        mutationFn: async () => {
            if (!book?.id) throw new Error('Không tìm thấy thông tin sách');
            return adminApi.reinstate(book.id, { note: note.trim() });
        },
        onSuccess: () => {
            toast.success(`Đã khôi phục sách "${book?.title}" thành công.`);
            if (currentAdmin?.id) {
                queryClient.invalidateQueries({ queryKey: adminKeys.all(currentAdmin.id) });
            }
            onSuccess?.();
            onClose();
        },
        onError: (err) => {
            setApiError(errorMessage(err));
        },
    });

    if (!book) return null;

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        setFieldError(null);
        setApiError(null);

        const parseResult = ModerationNoteBodySchema.safeParse({ note: note.trim() });
        if (!parseResult.success) {
            setFieldError(parseResult.error.issues[0]?.message ?? 'Ghi chú không hợp lệ.');
            return;
        }

        reinstateMutation.mutate();
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open && !reinstateMutation.isPending) {
                    onClose();
                }
            }}
        >
            <DialogContent className="max-h-[88dvh] max-w-[420px] space-y-4 overflow-y-auto p-5">
                <DialogHeader className="gap-1 pb-0.5">
                    <DialogTitle className="m-0 flex items-center gap-2 font-semibold text-base text-foreground leading-tight sm:text-lg">
                        <RotateCcw className="h-4.5 w-4.5 shrink-0 text-success-foreground" />
                        <span>Khôi phục sách</span>
                    </DialogTitle>
                    <DialogDescription className="m-0 text-muted-foreground text-xs leading-normal">
                        Gỡ bỏ lệnh hạn chế và phục hồi quyền hiển thị của sách về trạng thái ban
                        đầu.
                    </DialogDescription>
                </DialogHeader>

                {/* Banner tóm tắt đầu sách */}
                <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 shadow-xs">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-primary">
                        <BookOpen className="h-4 w-4 text-primary/80" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                            <p className="m-0 truncate font-semibold text-foreground text-sm leading-snug">
                                {book.title}
                            </p>
                            <Badge
                                tone="danger"
                                className="h-4.5 shrink-0 justify-center gap-1 px-1.5 text-center font-normal text-[10px] leading-none"
                            >
                                Đã bị gỡ
                            </Badge>
                        </div>
                        {book.author?.displayName && (
                            <p className="m-0 truncate text-[11px] text-muted-foreground">
                                Tác giả: {book.author.displayName}
                            </p>
                        )}
                    </div>
                </div>

                {/* Thông báo thông tin */}
                <Alert tone="info" className="m-0 p-3 text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-success-foreground" />
                        Điều kiện khôi phục
                    </span>
                    <p className="m-0 mt-1 text-[11px] text-foreground/80 leading-relaxed">
                        Hệ thống sẽ gỡ bỏ trạng thái bị gỡ và khôi phục quyền hiển thị trước đó nếu
                        tài khoản của tác giả vẫn đang hoạt động. Tác giả sẽ nhận thông báo.
                    </p>
                </Alert>

                {apiError && (
                    <Alert tone="danger" className="m-0 p-2.5 text-xs">
                        {apiError}
                    </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-3.5 pt-0.5">
                    <FieldGroup className="gap-2">
                        <Field>
                            <FieldLabel
                                htmlFor="reinstate-note"
                                className="m-0 font-medium text-xs"
                            >
                                <span>Ghi chú khôi phục (không bắt buộc)</span>
                            </FieldLabel>
                            <Textarea
                                id="reinstate-note"
                                value={note}
                                onChange={(e) => {
                                    setNote(e.target.value);
                                    if (fieldError) setFieldError(null);
                                }}
                                placeholder="Ví dụ: Tác giả đã bổ sung bản quyền hợp lệ, đã gỡ nội dung phản cảm..."
                                rows={2}
                                maxLength={1000}
                                disabled={reinstateMutation.isPending}
                                className={`mt-1.5 min-h-[68px] resize-none px-3 py-2 text-xs leading-relaxed placeholder:text-muted-foreground/70 placeholder:text-xs ${
                                    fieldError ? 'border-destructive' : ''
                                }`}
                            />
                            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                                {fieldError ? (
                                    <FieldError className="m-0 text-[11px]">
                                        {fieldError}
                                    </FieldError>
                                ) : (
                                    <span className="text-[11px]">
                                        Ghi chú sẽ được lưu trong lịch sử kiểm duyệt.
                                    </span>
                                )}
                                <span className="font-mono text-[11px]">{note.length}/1000</span>
                            </div>
                        </Field>
                    </FieldGroup>

                    <DialogFooter className="flex items-center justify-end gap-2 border-border border-t pt-3.5">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 text-xs"
                            disabled={reinstateMutation.isPending}
                            onClick={onClose}
                        >
                            Hủy bỏ
                        </Button>
                        <Button
                            type="submit"
                            variant="default"
                            size="sm"
                            className="h-8 px-3.5 font-medium text-xs"
                            disabled={reinstateMutation.isPending}
                        >
                            {reinstateMutation.isPending ? 'Đang xử lý…' : 'Xác nhận khôi phục'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
