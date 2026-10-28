import { useEffect, useRef, useState } from 'react';
import { FormSelect } from '@/shared/ui/FormSelect';
import { Field, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { bookTopicChoice, bookTopicOptions, OTHER_BOOK_TOPIC } from '../model/topics';

export function BookTopicField({
    id,
    name,
    value,
    disabled,
    onChange,
}: {
    id: string;
    name?: string;
    value: string;
    disabled: boolean;
    onChange: (topic: string) => void;
}) {
    const [choice, setChoice] = useState(() => bookTopicChoice(value));
    const [custom, setCustom] = useState(() =>
        bookTopicChoice(value) === OTHER_BOOK_TOPIC ? value : '',
    );
    const customInput = useRef<HTMLInputElement>(null);
    const focusCustom = useRef(false);
    useEffect(() => {
        if (choice !== OTHER_BOOK_TOPIC || !focusCustom.current) return;
        focusCustom.current = false;
        const frame = requestAnimationFrame(() => customInput.current?.focus());
        return () => cancelAnimationFrame(frame);
    }, [choice]);
    return (
        <Field className="min-w-0 gap-2">
            <FieldLabel htmlFor={id} className="mb-0">
                Chủ đề
            </FieldLabel>
            <FormSelect
                id={id}
                value={choice}
                options={bookTopicOptions}
                disabled={disabled}
                onValueChange={(next) => {
                    focusCustom.current = next === OTHER_BOOK_TOPIC;
                    setChoice(next);
                    onChange(next === OTHER_BOOK_TOPIC ? custom : next);
                }}
            />
            {name && <input type="hidden" name={name} value={value} disabled={disabled} />}
            {choice === OTHER_BOOK_TOPIC && (
                <Field className="min-w-0 gap-2">
                    <FieldLabel htmlFor={`${id}-custom`} className="mb-0">
                        Tên chủ đề khác
                    </FieldLabel>
                    <Input
                        ref={customInput}
                        id={`${id}-custom`}
                        value={custom}
                        maxLength={50}
                        disabled={disabled}
                        placeholder="Nhập chủ đề của bạn"
                        onChange={(event) => {
                            const next = event.currentTarget.value;
                            setCustom(next);
                            onChange(next);
                        }}
                    />
                </Field>
            )}
        </Field>
    );
}
