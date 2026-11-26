import { type FormEvent, useId, useState } from 'react';
import { Button } from '@/shared/ui/Button';
import { FormSelect } from '@/shared/ui/FormSelect';
import { Field, FieldGroup, FieldLabel, FieldSet } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { Textarea } from '@/shared/ui/primitives/textarea';
import type { BookDetail } from '../../../shared/contracts/dto.schema';
import { Feedback } from '../../../shared/ui/Feedback';
import { bookPageSize } from '../model/page-size';
import { BookAudienceFields } from './BookAudienceFields';
import { BookSizeFields } from './BookSizeFields';
import { BookTopicField } from './BookTopicField';

export function BookForm({
    book,
    busy,
    error,
    success,
    onSubmit,
    onDirtyChange,
    id,
    hideActions = false,
}: {
    book?: BookDetail;
    busy: boolean;
    error: string | null;
    success?: string | null;
    onSubmit: (form: FormData) => void;
    onDirtyChange?: (dirty: boolean) => void;
    id?: string;
    hideActions?: boolean;
}) {
    const prefix = useId();
    const [format, setFormat] = useState(book?.pageFormat || 'A4');
    const [topic, setTopic] = useState(book?.topic || '');
    const [width, setWidth] = useState(() => String(bookPageSize(book).widthMm));
    const [height, setHeight] = useState(() => String(bookPageSize(book).heightMm));
    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!busy) onSubmit(new FormData(event.currentTarget));
    }
    return (
        <form
            className="[&_[data-slot=select-trigger]]:mt-0 [&_input]:mt-0 [&_textarea]:mt-0"
            noValidate
            id={id}
            onSubmit={submit}
            onChange={() => onDirtyChange?.(true)}
            aria-busy={busy}
        >
            <Feedback error={error} success={success} />
            <FieldSet disabled={busy} className="m-0 min-w-0 gap-5 border-0 p-0">
                <FieldGroup className="gap-5 [container-type:normal]">
                    <Field>
                        <FieldLabel className="mb-0" htmlFor={`${prefix}-title`}>
                            Tên sách <span aria-hidden="true">*</span>
                        </FieldLabel>
                        <Input
                            id={`${prefix}-title`}
                            name="title"
                            defaultValue={book?.title}
                            maxLength={200}
                            required
                        />
                    </Field>
                    <Field>
                        <FieldLabel className="mb-0" htmlFor={`${prefix}-description`}>
                            Mô tả
                        </FieldLabel>
                        <Textarea
                            id={`${prefix}-description`}
                            name="description"
                            defaultValue={book?.description || ''}
                            maxLength={2000}
                            rows={3}
                        />
                    </Field>
                    <BookTopicField
                        id={`${prefix}-topic`}
                        name="topic"
                        value={topic}
                        disabled={busy}
                        onChange={(value) => {
                            setTopic(value);
                            onDirtyChange?.(true);
                        }}
                    />
                    <BookAudienceFields
                        prefix={prefix}
                        book={book}
                        disabled={busy}
                        onChange={() => onDirtyChange?.(true)}
                    />
                    <FieldGroup className="grid grid-cols-2 items-start gap-4 [container-type:normal] sm:grid-cols-3">
                        <Field className="col-span-2 min-w-0 sm:col-span-1">
                            <FieldLabel className="mb-0" htmlFor={`${prefix}-format`}>
                                Khổ sách
                            </FieldLabel>
                            <FormSelect
                                id={`${prefix}-format`}
                                name="pageFormat"
                                value={format}
                                disabled={busy}
                                onValueChange={(value) => {
                                    setFormat(value as typeof format);
                                    onDirtyChange?.(true);
                                }}
                                options={[
                                    { value: 'A4', label: 'A4' },
                                    { value: 'A5', label: 'A5' },
                                    { value: 'SQUARE', label: 'Hình vuông' },
                                    { value: 'CUSTOM', label: 'Tùy chỉnh' },
                                ]}
                            />
                        </Field>
                        <BookSizeFields
                            className="contents"
                            format={format}
                            idPrefix={`${prefix}-size`}
                            width={width}
                            height={height}
                            onWidthChange={setWidth}
                            onHeightChange={setHeight}
                        />
                    </FieldGroup>
                </FieldGroup>
                {!hideActions && (
                    <Button type="submit" aria-busy={busy} disabled={busy}>
                        {busy && <Spinner data-icon="inline-start" />}
                        {busy ? 'Đang lưu…' : book ? 'Lưu thông tin sách' : 'Tạo sách trống'}
                    </Button>
                )}
            </FieldSet>
        </form>
    );
}
