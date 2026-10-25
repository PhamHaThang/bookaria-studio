import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';
import { FormSelect } from '@/shared/ui/FormSelect';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { Textarea } from '@/shared/ui/primitives/textarea';
import type { BookDetail } from '../../../shared/contracts/dto.schema';
import { Feedback } from '../../../shared/ui/Feedback';
import { bookPageSize } from '../model/page-size';
import { BookSizeFields } from './BookSizeFields';

export function BookForm({
    book,
    busy,
    error,
    success,
    onSubmit,
    onDirtyChange,
}: {
    book?: BookDetail;
    busy: boolean;
    error: string | null;
    success?: string | null;
    onSubmit: (form: FormData) => void;
    onDirtyChange?: (dirty: boolean) => void;
}) {
    const [format, setFormat] = useState(book?.pageFormat || 'A4');
    const [width, setWidth] = useState(() => String(bookPageSize(book).widthMm));
    const [height, setHeight] = useState(() => String(bookPageSize(book).heightMm));
    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!busy) onSubmit(new FormData(event.currentTarget));
    }
    return (
        <form
            className="editor-form max-w-180 rounded-[var(--radius-lg)] border border-border border-solid bg-surface p-8 max-[760px]:px-5 max-[760px]:py-6 [&_.feedback]:mb-6"
            onSubmit={submit}
            onChange={() => onDirtyChange?.(true)}
            aria-busy={busy}
        >
            <FieldGroup className="contents">
                <Feedback error={error} success={success} />
                <fieldset disabled={busy}>
                    <Field orientation="contents">
                        <FieldLabel htmlFor="title">
                            Tên sách
                            <Input
                                id="title"
                                name="title"
                                defaultValue={book?.title}
                                maxLength={200}
                                required
                            />
                        </FieldLabel>
                    </Field>
                    <Field orientation="contents">
                        <FieldLabel htmlFor="description">
                            Mô tả
                            <Textarea
                                id="description"
                                name="description"
                                defaultValue={book?.description || ''}
                                maxLength={2000}
                                rows={4}
                            />
                        </FieldLabel>
                    </Field>
                    <div className="form-grid grid grid-cols-[1fr_1fr] gap-[0_var(--space-6)] max-[760px]:grid-cols-[1fr] max-[540px]:[.theme-demo-form_&]:grid-cols-[1fr]">
                        <Field orientation="contents">
                            <FieldLabel htmlFor="pageFormat">
                                Khổ sách
                                <FormSelect
                                    id="pageFormat"
                                    name="pageFormat"
                                    value={format}
                                    onValueChange={(value) => setFormat(value as typeof format)}
                                    options={[
                                        { value: 'A4', label: 'A4' },
                                        { value: 'A5', label: 'A5' },
                                        { value: 'SQUARE', label: 'Hình vuông' },
                                        { value: 'CUSTOM', label: 'Tùy chỉnh' },
                                    ]}
                                />
                            </FieldLabel>
                        </Field>
                        {format === 'CUSTOM' && (
                            <BookSizeFields
                                className="col-span-full"
                                idPrefix="book-size"
                                width={width}
                                height={height}
                                onWidthChange={setWidth}
                                onHeightChange={setHeight}
                            />
                        )}
                        <Field orientation="contents">
                            <FieldLabel htmlFor="language">
                                Ngôn ngữ
                                <Input
                                    id="language"
                                    name="language"
                                    defaultValue={book?.language || 'vi'}
                                    maxLength={5}
                                    required
                                    placeholder="vi"
                                />
                                <span className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]">
                                    Mã ngôn ngữ, ví dụ: vi, en.
                                </span>
                            </FieldLabel>
                        </Field>
                        <Field orientation="contents">
                            <FieldLabel htmlFor="topic">
                                Chủ đề
                                <Input
                                    id="topic"
                                    name="topic"
                                    defaultValue={book?.topic || ''}
                                    maxLength={50}
                                />
                            </FieldLabel>
                        </Field>
                        <Field orientation="contents">
                            <FieldLabel htmlFor="ageMin">
                                Độ tuổi từ
                                <Input
                                    id="ageMin"
                                    name="ageMin"
                                    type="number"
                                    min="0"
                                    max="150"
                                    defaultValue={book?.ageMin ?? ''}
                                />
                            </FieldLabel>
                        </Field>
                        <Field orientation="contents">
                            <FieldLabel htmlFor="ageMax">
                                Đến độ tuổi
                                <Input
                                    id="ageMax"
                                    name="ageMax"
                                    type="number"
                                    min="0"
                                    max="150"
                                    defaultValue={book?.ageMax ?? ''}
                                />
                            </FieldLabel>
                        </Field>
                    </div>
                    <div className="form-actions mt-3 flex flex-wrap items-center gap-5 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-4 max-[760px]:[&_>_a]:text-center [.confirm-dialog_&]:mt-6 [.confirm-dialog_&]:justify-end max-[760px]:[.confirm-dialog_&]:flex-row max-[760px]:[.confirm-dialog_&]:flex-wrap [.image-editor_&:empty]:hidden [.scene-object-asset_&]:gap-2">
                        <Button type="submit" aria-busy={busy} disabled={busy}>
                            {busy && <Spinner data-icon="inline-start" aria-hidden="true" />}
                            {busy ? 'Đang lưu…' : book ? 'Lưu thông tin sách' : 'Tạo sách trống'}
                        </Button>
                        <Link to="/books">Quay về sách của tôi</Link>
                    </div>
                </fieldset>
            </FieldGroup>
        </form>
    );
}
