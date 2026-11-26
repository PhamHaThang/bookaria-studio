import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth';
import { errorMessage } from '@/shared/api/errors';
import { ModerationNoteBodySchema } from '@/shared/contracts/api/admin.schema';
import { adminApi } from '../client';
import { adminKeys } from '../model';
import { useAdminMutation as useMutation } from '../use-admin-mutation';
import { BookModerationActionDialog, type BookTarget } from './BookModerationActionDialog';

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
        <BookModerationActionDialog
            book={book}
            open={isOpen}
            busy={dismissMutation.isPending}
            title="Bỏ qua báo cáo vi phạm"
            description="Đóng tất cả báo cáo đang chờ của sách. Sách giữ quyền hiển thị hiện tại."
            actionLabel="Bỏ qua báo cáo"
            noteId="dismiss-note"
            noteLabel="Ghi chú xử lý"
            note={note}
            placeholder="Ví dụ: Đã xác minh tác giả có quyền sử dụng hình minh họa."
            fieldError={fieldError}
            apiError={apiError}
            onNoteChange={(value) => {
                setNote(value);
                setFieldError(null);
            }}
            onSubmit={handleSubmit}
            onClose={onClose}
        />
    );
}
