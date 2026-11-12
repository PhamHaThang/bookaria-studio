import { useId } from 'react';
import { FieldLabel } from '@/shared/ui/primitives/field';

export function InteractionChoices<Value extends string>({
    label,
    value,
    options,
    disabled,
    onChange,
}: {
    label: string;
    value: Value;
    options: readonly { value: Value; label: string; disabled?: boolean }[];
    disabled: boolean;
    onChange: (value: Value) => void;
}) {
    const id = useId();
    return (
        <fieldset className="grid grid-cols-2 gap-1.5" disabled={disabled}>
            <legend className="mb-2.5 font-medium text-sm leading-5">{label}</legend>
            {options.map((option) => (
                <FieldLabel
                    key={option.value}
                    htmlFor={`${id}-${option.value}`}
                    data-disabled={disabled || option.disabled || undefined}
                    className="m-0 flex min-h-11 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs leading-4 hover:bg-hover has-checked:border-input has-checked:bg-muted data-[disabled=true]:cursor-not-allowed"
                >
                    <input
                        type="radio"
                        data-slot="radio"
                        id={`${id}-${option.value}`}
                        name={id}
                        value={option.value}
                        checked={value === option.value}
                        disabled={option.disabled}
                        className="size-3.5 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                        onChange={() => onChange(option.value)}
                    />
                    <span className="text-balance">{option.label}</span>
                </FieldLabel>
            ))}
        </fieldset>
    );
}
