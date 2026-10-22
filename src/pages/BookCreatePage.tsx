import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookForm, bookKeys, booksApi, createBookForm } from '../features/books';
import { errorMessage } from '../shared/api/errors';

export function BookCreatePage() {
    const navigate = useNavigate();
    const cache = useQueryClient();
    const [error, setError] = useState<string | null>(null);
    const mutation = useMutation({ mutationFn: booksApi.create });
    async function submit(form: FormData) {
        setError(null);
        try {
            const result = await mutation.mutateAsync(createBookForm(form));
            await cache.invalidateQueries({ queryKey: bookKeys.all });
            navigate(`/books/${result.book.id}`, { replace: true, state: { created: true } });
        } catch (cause) {
            setError(errorMessage(cause));
        }
    }
    return (
        <>
            <div className="page-heading">
                <div>
                    <h1>Tạo sách mới</h1>
                    <p>Bắt đầu với sách trống. Sau khi tạo, bạn có thể thêm ảnh bìa và nội dung.</p>
                </div>
            </div>
            <BookForm
                busy={mutation.isPending}
                error={error}
                onSubmit={(form) => {
                    void submit(form);
                }}
            />
        </>
    );
}
