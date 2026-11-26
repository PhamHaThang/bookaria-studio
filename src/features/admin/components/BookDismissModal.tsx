import { useQueryClient } from '@tanstack/react-query';
import { BookOpen, CheckCircle2 } from 'lucide-react';
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
import { useAdminMutation as useMutation } from '../use-admin-mutation';
import type { BookTarget } from './BookTakedownModal';

interface BookDismissModalProps {
    book: BookTarget | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export function BookDismissModal({ book, isOpen, onClose, onSuccess }: BookDismissModalProps) {
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

    const dismissMutation = useMutation({
        mutationFn: async () => {
            if (!book?.id) throw new Error('Không tìm thấy thông tin sách');
            return adminApi.dismiss(book.id, { note: note.trim() });
        },
        onSuccess: () => {
            toast.success(`Đã bỏ qua các báo cáo của sách "${book?.title}".`);
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

        dismissMutation.mutate();
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open && !dismissMutation.isPending) {
                    onClose();
                }
            }}
        >
            <DialogContent className="max-h-[88dvh] max-w-[420px] space-y-4 overflow-y-auto p-5">
                <DialogHeader className="gap-1 pb-0.5">
                    <DialogTitle className="m-0 flex items-center gap-2 font-semibold text-base text-foreground leading-tight sm:text-lg">
                        <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-success-foreground" />
                        <span>Bỏ qua báo cáo vi phạm</span>
                    </DialogTitle>
                    <DialogDescription className="m-0 text-muted-foreground text-xs leading-normal">
                        Đánh dấu các báo cáo là không vi phạm hoặc đã được kiểm chứng an toàn.
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
                            {book.reportCount !== undefined && (
                                <Badge
                                    tone="neutral"
                                    className="h-4.5 shrink-0 justify-center gap-1 px-1.5 text-center font-normal text-[10px] leading-none"
                                >
                                    {book.reportCount} báo cáo
                                </Badge>
                            )}
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
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success-foreground" />
                        Thông tin xử lý
                    </span>
                    <p className="m-0 mt-1 text-[11px] text-foreground/80 leading-relaxed">
                        Tất cả báo cáo đang mở đối với đầu sách này sẽ được đánh dấu đã xử lý/bỏ
                        qua. Trạng thái và quyền hiển thị của sách được giữ nguyên.
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
                            <FieldLabel htmlFor="dismiss-note" className="m-0 font-medium text-xs">
                                <span>Ghi chú xử lý (không bắt buộc)</span>
                            </FieldLabel>
                            <Textarea
                                id="dismiss-note"
                                value={note}
                                onChange={(e) => {
                                    setNote(e.target.value);
                                    if (fieldError) setFieldError(null);
                                }}
                                placeholder="Ví dụ: Đã kiểm duyệt nội dung, sách hợp lệ không vi phạm chính sách cộng đồng..."
                                rows={2}
                                maxLength={1000}
                                disabled={dismissMutation.isPending}
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
                            disabled={dismissMutation.isPending}
                            onClick={onClose}
                        >
                            Hủy bỏ
                        </Button>
                        <Button
                            type="submit"
                            variant="default"
                            size="sm"
                            className="h-8 px-3.5 font-medium text-xs"
                            disabled={dismissMutation.isPending}
                        >
                            {dismissMutation.isPending ? 'Đang xử lý…' : 'Xác nhận bỏ qua'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
