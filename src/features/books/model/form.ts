import {
    CreateBookBodySchema,
    UpdateBookBodySchema,
} from '../../../shared/contracts/api/books.schema';
import { customBookSize } from './page-size';

function fields(form: FormData, editing: boolean) {
    const text = (key: string) => String(form.get(key) ?? '');
    const age = (key: string) =>
        text(key) === '' ? (editing ? null : undefined) : Number(text(key));
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
    return CreateBookBodySchema.parse({ ...fields(form, false), source: { type: 'BLANK' } });
}
export function updateBookForm(form: FormData) {
    return UpdateBookBodySchema.parse(fields(form, true));
}
