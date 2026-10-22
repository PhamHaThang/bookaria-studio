import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BookDetail } from '../../../shared/contracts/dto.schema';
import { Feedback } from '../../../shared/ui/Feedback';

export function BookForm({
    book,
    busy,
    error,
    success,
    onSubmit,
}: {
    book?: BookDetail;
    busy: boolean;
    error: string | null;
    success?: string | null;
    onSubmit: (form: FormData) => void;
}) {
    const [format, setFormat] = useState(book?.pageFormat || 'A4');
    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!busy) onSubmit(new FormData(event.currentTarget));
    }
    return (
        <form className="editor-form" onSubmit={submit} aria-busy={busy}>
            <Feedback error={error} success={success} />
            <fieldset disabled={busy}>
                <label htmlFor="title">
                    Tên sách
                    <input
                        id="title"
                        name="title"
                        defaultValue={book?.title}
                        maxLength={200}
                        required
                    />
                </label>
                <label htmlFor="description">
                    Mô tả
                    <textarea
                        id="description"
                        name="description"
                        defaultValue={book?.description || ''}
                        maxLength={2000}
                        rows={4}
                    />
                </label>
                <div className="form-grid">
                    <label htmlFor="pageFormat">
                        Khổ sách
                        <select
                            id="pageFormat"
                            name="pageFormat"
                            value={format}
                            onChange={(e) => setFormat(e.target.value as typeof format)}
                        >
                            <option value="A4">A4</option>
                            <option value="A5">A5</option>
                            <option value="SQUARE">Hình vuông</option>
                            <option value="CUSTOM">Tùy chỉnh</option>
                        </select>
                    </label>
                    {format === 'CUSTOM' && (
                        <label htmlFor="pageAspect">
                            Tỷ lệ cao / rộng
                            <input
                                id="pageAspect"
                                name="pageAspect"
                                type="number"
                                min="0.2"
                                max="5"
                                step="any"
                                defaultValue={book?.pageAspect}
                                required
                            />
                            <span className="field-hint">
                                Ví dụ: 1,5 nếu chiều cao bằng 1,5 lần chiều rộng.
                            </span>
                        </label>
                    )}
                    <label htmlFor="language">
                        Ngôn ngữ
                        <input
                            id="language"
                            name="language"
                            defaultValue={book?.language || 'vi'}
                            maxLength={5}
                            required
                            placeholder="vi"
                        />
                        <span className="field-hint">Mã ngôn ngữ, ví dụ: vi, en.</span>
                    </label>
                    <label htmlFor="topic">
                        Chủ đề
                        <input
                            id="topic"
                            name="topic"
                            defaultValue={book?.topic || ''}
                            maxLength={50}
                        />
                    </label>
                    <label htmlFor="ageMin">
                        Độ tuổi từ
                        <input
                            id="ageMin"
                            name="ageMin"
                            type="number"
                            min="0"
                            max="150"
                            defaultValue={book?.ageMin ?? ''}
                        />
                    </label>
                    <label htmlFor="ageMax">
                        Đến độ tuổi
                        <input
                            id="ageMax"
                            name="ageMax"
                            type="number"
                            min="0"
                            max="150"
                            defaultValue={book?.ageMax ?? ''}
                        />
                    </label>
                </div>
                <div className="form-actions">
                    <button className="button compact" type="submit">
                        {busy ? 'Đang lưu…' : book ? 'Lưu thông tin sách' : 'Tạo sách trống'}
                    </button>
                    <Link to="/books">Quay về sách của tôi</Link>
                </div>
            </fieldset>
        </form>
    );
}
