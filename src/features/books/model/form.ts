import {
    CreateBookBodySchema,
    UpdateBookBodySchema,
} from '../../../shared/contracts/api/books.schema';
import { BOOK_AGE_MAX } from '../../../shared/contracts/common.schema';
import { customBookSize } from './page-size';

function fields(form: FormData, editing: boolean) {
    const text = (key: string) => String(form.get(key) ?? '');
    const age = (key: string) => {
        const raw = text(key).trim();
        if (!raw) return editing ? null : undefined;
        const value = Number(raw);
        if (!Number.isInteger(value) || value < 0 || value > BOOK_AGE_MAX)
            throw new Error(`Độ tuổi phải là số nguyên từ 0 đến ${BOOK_AGE_MAX}.`);
        return value;
    };
    const dimensions =
        text('pageFormat') === 'CUSTOM' && (form.has('pageWidthMm') || form.has('pageHeightMm'))
            ? customBookSize(text('pageWidthMm'), text('pageHeightMm'))
            : undefined;
    return {
        title: text('title'),
        description: text('description'),
        topic: text('topic'),
        ageMin: age('ageMin'),
        ageMax: age('ageMax'),
        language: text('language'),
        pageFormat: text('pageFormat'),
        pageAspect:
            dimensions?.pageAspect ??
            (text('pageFormat') === 'CUSTOM' && text('pageAspect') !== ''
                ? Number(text('pageAspect'))
                : undefined),
        pageWidthMm: dimensions?.pageWidthMm,
    };
}
export function createBookForm(form: FormData) {
    const values = fields(form, false);
    return CreateBookBodySchema.parse({
        ...values,
        description: values.description.trim() || undefined,
        topic: values.topic.trim() || undefined,
        language: values.language || undefined,
        source: { type: 'BLANK' },
    });
}
export function updateBookForm(form: FormData) {
    return UpdateBookBodySchema.parse(fields(form, true));
}
