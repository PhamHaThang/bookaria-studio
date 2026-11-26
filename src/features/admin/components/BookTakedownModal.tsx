import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth';
import { errorMessage } from '@/shared/api/errors';
import { TakedownBodySchema } from '@/shared/contracts/api/admin.schema';
import { adminApi } from '../client';
import { adminKeys } from '../model';
import { useAdminMutation as useMutation } from '../use-admin-mutation';
import { BookModerationActionDialog, type BookTarget } from './BookModerationActionDialog';

export type { BookTarget } from './BookModerationActionDialog';

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
        <BookModerationActionDialog
            book={book}
            open={isOpen}
            busy={takedownMutation.isPending}
            title="Gỡ sách vi phạm"
            description="Sách sẽ chuyển sang riêng tư và các báo cáo đang chờ sẽ được xử lý."
            actionLabel="Xác nhận gỡ sách"
            noteId="takedown-reason"
            noteLabel="Lý do gỡ sách"
            note={reason}
            placeholder="Ví dụ: Hình minh họa được sử dụng khi chưa có giấy phép."
            required
            fieldError={fieldError}
            apiError={apiError}
            onNoteChange={(value) => {
                setReason(value);
                setFieldError(null);
            }}
            onSubmit={handleSubmit}
            onClose={onClose}
        />
    );
}
