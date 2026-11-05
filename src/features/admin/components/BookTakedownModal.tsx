import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ban, BookOpen, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth';
import { errorMessage } from '@/shared/api/errors';
import { TakedownBodySchema } from '@/shared/contracts/api/admin.schema';
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

export interface BookTarget {
    id: string;
    title: string;
    author?: {
        displayName: string;
    };
    reportCount?: number;
}

interface BookTakedownModalProps {
    book: BookTarget | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export function BookTakedownModal({ book, isOpen, onClose, onSuccess }: BookTakedownModalProps) {
    const { user: currentAdmin } = useAuth();
    const queryClient = useQueryClient();

    const [reason, setReason] = useState('');
    const [fieldError, setFieldError] = useState<string | null>(null);
    const [apiError, setApiError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setReason('');
            setFieldError(null);
            setApiError(null);
        }
    }, [isOpen]);

    const takedownMutation = useMutation({
        mutationFn: async () => {
            if (!book?.id) throw new Error('Không tìm thấy thông tin sách');
            return adminApi.takedown(book.id, { reason: reason.trim() });
        },
        onSuccess: () => {
            toast.success(`Đã gỡ sách "${book?.title}" thành công.`);
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

        if (!reason.trim()) {
            setFieldError('Vui lòng nhập lý do gỡ sách để lưu vào biên bản kiểm duyệt.');
            return;
        }

        const parseResult = TakedownBodySchema.safeParse({ reason: reason.trim() });
        if (!parseResult.success) {
            setFieldError(parseResult.error.issues[0]?.message ?? 'Lý do không hợp lệ.');
            return;
        }

        takedownMutation.mutate();
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open && !takedownMutation.isPending) {
                    onClose();
                }
            }}
        >
            <DialogContent className="max-h-[88dvh] max-w-[420px] space-y-4 overflow-y-auto p-5">
                <DialogHeader className="gap-1 pb-0.5">
                    <DialogTitle className="m-0 flex items-center gap-2 font-semibold text-base text-destructive leading-tight sm:text-lg">
                        <Ban className="h-4.5 w-4.5 shrink-0 text-destructive" />
                        <span>Gỡ sách vi phạm</span>
                    </DialogTitle>
                    <DialogDescription className="m-0 text-muted-foreground text-xs leading-normal">
                        Thực hiện gỡ sách khỏi chế độ công khai và giải quyết các báo cáo vi phạm
                        liên quan.
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
                            {book.reportCount !== undefined && book.reportCount > 0 && (
                                <Badge
                                    tone="warning"
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

                {/* Hộp cảnh báo hậu quả thao tác */}
                <Alert tone="danger" className="m-0 p-3 text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-destructive">
                        <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                        Hậu quả sau khi gỡ sách
                    </span>
                    <p className="m-0 mt-1 text-[11px] text-foreground/80 leading-relaxed">
                        Sách sẽ lập tức chuyển sang chế độ riêng tư; tất cả báo cáo đang mở đối với
                        đầu sách này được đánh dấu đã xử lý. Tác giả sẽ nhận được thông báo giải
                        trình.
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
                                htmlFor="takedown-reason"
                                className="m-0 font-medium text-xs"
                            >
                                <span>
                                    Lý do gỡ sách <span className="text-destructive">*</span>
                                </span>
                            </FieldLabel>
                            <Textarea
                                id="takedown-reason"
                                value={reason}
                                onChange={(e) => {
                                    setReason(e.target.value);
                                    if (fieldError) setFieldError(null);
                                }}
                                placeholder="Ví dụ: Nội dung vi phạm bản quyền hình ảnh, vi phạm quy tắc tiêu chuẩn cộng đồng..."
                                rows={2}
                                maxLength={1000}
                                disabled={takedownMutation.isPending}
                                className={`mt-1.5 min-h-[68px] resize-none px-3 py-2 text-xs leading-relaxed placeholder:text-muted-foreground/70 placeholder:text-xs ${
                                    fieldError ? 'border-destructive' : ''
                                }`}
                                required
                            />
                            <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
                                {fieldError ? (
                                    <FieldError className="m-0 text-[11px]">
                                        {fieldError}
                                    </FieldError>
                                ) : (
                                    <span className="text-[11px]">
                                        Lý do này sẽ được gửi tới tác giả và lưu nhật ký.
                                    </span>
                                )}
                                <span className="font-mono text-[11px]">{reason.length}/1000</span>
                            </div>
                        </Field>
                    </FieldGroup>

                    <DialogFooter className="flex items-center justify-end gap-2 border-border border-t pt-3.5">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 text-xs"
                            disabled={takedownMutation.isPending}
                            onClick={onClose}
                        >
                            Hủy bỏ
                        </Button>
                        <Button
                            type="submit"
                            variant="destructive"
                            size="sm"
                            className="h-8 px-3.5 font-medium text-xs"
                            disabled={takedownMutation.isPending || !reason.trim()}
                        >
                            {takedownMutation.isPending ? 'Đang xử lý…' : 'Xác nhận gỡ sách'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
