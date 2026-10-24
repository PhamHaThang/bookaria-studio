import {
    type ComponentPropsWithoutRef,
    type ReactNode,
    useEffect,
    useId,
    useRef,
    useState,
} from 'react';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from './primitives/select';

export type SelectOption = { value: string | number; label: ReactNode; disabled?: boolean };
type FormSelectProps = Omit<
    ComponentPropsWithoutRef<typeof SelectTrigger>,
    'value' | 'defaultValue' | 'onChange' | 'children'
> & {
    options: readonly SelectOption[];
    value?: string | number;
    defaultValue?: string | number;
    onValueChange?: (value: string) => void;
    name?: string;
    placeholder?: string;
    submitOnChange?: boolean;
};

export function FormSelect({
    options,
    value,
    defaultValue,
    onValueChange,
    name,
    form,
    disabled,
    id,
    placeholder = 'Chọn…',
    submitOnChange = false,
    ...triggerProps
}: FormSelectProps) {
    const generatedId = useId();
    const trigger = useRef<HTMLButtonElement>(null);
    const submit = useRef<string | null>(null);
    const initial = String(defaultValue ?? options.find((option) => !option.disabled)?.value ?? '');
    const [internal, setInternal] = useState(initial);
    const current = value === undefined ? internal : String(value);
    const selected = options.find((option) => String(option.value) === current);
    // Radix items require nonempty values; the prefix also keeps real values collision-free.
    const encode = (item: string | number) => `option:${item}`;

    useEffect(() => {
        const owner = trigger.current?.form;
        if (!owner || value !== undefined) return;
        function reset(event: Event) {
            queueMicrotask(() => {
                if (!event.defaultPrevented) setInternal(initial);
            });
        }
        owner.addEventListener('reset', reset);
        return () => owner.removeEventListener('reset', reset);
    }, [initial, value]);
    useEffect(() => {
        if (submit.current !== current) return;
        submit.current = null;
        // Run after the real form value has committed, including an empty "all" choice.
        trigger.current?.form?.requestSubmit();
    }, [current]);

    return (
        <>
            <Select
                value={encode(current)}
                disabled={disabled}
                form={form}
                onValueChange={(encoded) => {
                    const next = encoded.slice('option:'.length);
                    if (next === current) return;
                    submit.current = submitOnChange ? next : null;
                    setInternal(next);
                    onValueChange?.(next);
                }}
            >
                <SelectTrigger
                    {...triggerProps}
                    ref={trigger}
                    id={id ?? generatedId}
                    disabled={disabled}
                    form={form}
                >
                    <SelectValue>{selected?.label ?? placeholder}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        {options.map((option) => (
                            <SelectItem
                                key={String(option.value)}
                                value={encode(option.value)}
                                disabled={option.disabled}
                            >
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                </SelectContent>
            </Select>
            {/* Submit the original API value, never the internal Radix item identifier. */}
            {name && (
                <input type="hidden" name={name} form={form} value={current} disabled={disabled} />
            )}
        </>
    );
}
