import { Search, X } from 'lucide-react';
import { type ComponentProps, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from './primitives/input-group';
import { Spinner } from './primitives/spinner';

type SearchInputProps = Omit<
    ComponentProps<'input'>,
    'type' | 'value' | 'defaultValue' | 'onChange' | 'size'
> & {
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    onClear?: () => void;
    loading?: boolean;
};

/** Shared search appearance; each screen owns when its query is submitted. */
export function SearchInput({
    value,
    defaultValue = '',
    onValueChange,
    onClear,
    loading = false,
    className,
    disabled,
    readOnly,
    ref,
    ...props
}: SearchInputProps) {
    const input = useRef<HTMLInputElement>(null);
    const [draft, setDraft] = useState(defaultValue);
    const current = value ?? draft;
    useImperativeHandle(ref, () => input.current as HTMLInputElement);
    useEffect(() => {
        const form = input.current?.form;
        if (value !== undefined || !form) return;
        const reset = () => setDraft(defaultValue);
        form.addEventListener('reset', reset);
        return () => form.removeEventListener('reset', reset);
    }, [value, defaultValue]);
    function change(next: string) {
        if (value === undefined) setDraft(next);
        onValueChange?.(next);
    }
    return (
        <InputGroup
            className={className}
            data-search-input=""
            data-disabled={disabled || undefined}
        >
            <InputGroupInput
                {...props}
                ref={input}
                type="search"
                value={current}
                disabled={disabled}
                readOnly={readOnly}
                aria-busy={loading || undefined}
                className="[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
                onChange={(event) => change(event.currentTarget.value)}
            />
            <InputGroupAddon align="inline-start" className="pl-3">
                <Search aria-hidden="true" />
            </InputGroupAddon>
            {(loading || (current && !readOnly)) && (
                <InputGroupAddon align="inline-end" className="pr-2">
                    {loading && <Spinner aria-hidden="true" />}
                    {current && !readOnly && (
                        <InputGroupButton
                            size="icon-xs"
                            aria-label="Xóa từ khóa"
                            title="Xóa từ khóa"
                            disabled={disabled}
                            onClick={() => {
                                change('');
                                onClear?.();
                                input.current?.focus();
                            }}
                        >
                            <X aria-hidden="true" />
                        </InputGroupButton>
                    )}
                </InputGroupAddon>
            )}
        </InputGroup>
    );
}
