import { FormSelect } from '@/shared/ui/FormSelect';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { BOOK_AGE_MAX } from '../../../shared/contracts/common.schema';
import type { BookDetail } from '../../../shared/contracts/dto.schema';
import { bookLanguageOptions } from '../model/languages';

export function BookAudienceFields({
    prefix,
    book,
    disabled,
    onChange,
}: {
    prefix: string;
    book?: Pick<BookDetail, 'language' | 'ageMin' | 'ageMax'> | undefined;
    disabled: boolean;
    onChange: () => void;
}) {
    const language = book?.language || 'vi';
    return (
        <FieldGroup className="gap-2 [container-type:normal]">
            <FieldGroup className="grid grid-cols-2 gap-4 [container-type:normal] sm:grid-cols-[minmax(0,1.25fr)_repeat(2,minmax(0,1fr))]">
                <Field className="col-span-2 min-w-0 sm:col-span-1">
                    <FieldLabel className="mb-0" htmlFor={`${prefix}-language`}>
                        Ngôn ngữ
                    </FieldLabel>
                    <FormSelect
                        id={`${prefix}-language`}
                        name="language"
                        defaultValue={language}
                        options={bookLanguageOptions(language)}
                        disabled={disabled}
                        onValueChange={onChange}
                    />
                </Field>
                <Field className="min-w-0">
                    <FieldLabel className="mb-0" htmlFor={`${prefix}-age-min`}>
                        Độ tuổi từ
                    </FieldLabel>
                    <Input
                        id={`${prefix}-age-min`}
                        name="ageMin"
                        type="number"
                        min={0}
                        max={BOOK_AGE_MAX}
                        step={1}
                        defaultValue={book?.ageMin ?? ''}
                        disabled={disabled}
                        onChange={onChange}
                    />
                </Field>
                <Field className="min-w-0">
                    <FieldLabel className="mb-0" htmlFor={`${prefix}-age-max`}>
                        Độ tuổi đến
                    </FieldLabel>
                    <Input
                        id={`${prefix}-age-max`}
                        name="ageMax"
                        type="number"
                        min={0}
                        max={BOOK_AGE_MAX}
                        step={1}
                        defaultValue={book?.ageMax ?? ''}
                        disabled={disabled}
                        onChange={onChange}
                    />
                </Field>
            </FieldGroup>
        </FieldGroup>
    );
}
