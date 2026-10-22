import {
    CreateBookBodySchema,
    UpdateBookBodySchema,
} from '../../../shared/contracts/api/books.schema';

function fields(form: FormData, editing: boolean) {
    const text = (key: string) => String(form.get(key) ?? '');
    const age = (key: string) =>
        text(key) === '' ? (editing ? null : undefined) : Number(text(key));
    return {
        title: text('title'),
        description: text('description'),
        topic: text('topic'),
        ageMin: age('ageMin'),
        ageMax: age('ageMax'),
        language: text('language'),
        pageFormat: text('pageFormat'),
        pageAspect:
            text('pageFormat') === 'CUSTOM' && text('pageAspect') !== ''
                ? Number(text('pageAspect'))
                : undefined,
    };
}
export function createBookForm(form: FormData) {
    return CreateBookBodySchema.parse({ ...fields(form, false), source: { type: 'BLANK' } });
}
export function updateBookForm(form: FormData) {
    return UpdateBookBodySchema.parse(fields(form, true));
}
