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
        <BookModerationActionDialog
            book={book}
            open={isOpen}
            busy={reinstateMutation.isPending}
            title="Khôi phục sách"
            description="Khôi phục quyền hiển thị trước khi gỡ nếu tài khoản tác giả đang hoạt động."
            actionLabel="Xác nhận khôi phục"
            noteId="reinstate-note"
            noteLabel="Ghi chú khôi phục"
            note={note}
            placeholder="Ví dụ: Tác giả đã bổ sung giấy phép sử dụng hình minh họa."
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
