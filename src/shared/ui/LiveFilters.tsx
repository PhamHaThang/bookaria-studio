import {
    type ComponentProps,
    useEffect,
    useEffectEvent,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { updateFilterSearch } from '@/shared/lib/filter-search';
import { FormSelect } from './FormSelect';
import { Input } from './primitives/input';
import { SearchInput } from './SearchInput';

function useFilterValue(name: string, applied: string, pattern?: string) {
    const [, setParams] = useSearchParams();
    const location = useLocation();
    const resetKey = location.state?.resetFilters === true ? location.key : null;
    const [value, setValue] = useState(applied);
    const [composing, setComposing] = useState(false);
    const pendingCommit = useRef<string | null>(null);
    // Acknowledge our URL update without replacing newer text typed while navigation was settling.
    useLayoutEffect(() => {
        if (pendingCommit.current === applied) {
            pendingCommit.current = null;
            return;
        }
        pendingCommit.current = null;
        setValue(applied);
    }, [applied]);
    useLayoutEffect(() => {
        if (resetKey !== null) {
            pendingCommit.current = null;
            setValue(applied);
        }
    }, [applied, resetKey]);
    function commit(next: string) {
        const trimmed = next.trim();
        if (
            (trimmed === applied && pendingCommit.current === null) ||
            (trimmed && pattern && !new RegExp(`^(?:${pattern})$`, 'u').test(trimmed))
        )
            return;
        pendingCommit.current = trimmed;
        setParams((current) => updateFilterSearch(current, { [name]: trimmed }), { replace: true });
    }
    const apply = useEffectEvent(commit);
    useEffect(() => {
        if (composing || value.trim() === applied) return;
        const timer = setTimeout(() => apply(value), 300);
        return () => clearTimeout(timer);
    }, [applied, composing, value]);
    return {
        value,
        pending: !composing && value.trim() !== applied,
        change: setValue,
        clear: () => {
            setValue('');
            commit('');
        },
        onCompositionStart: () => setComposing(true),
        onCompositionEnd: (event: React.CompositionEvent<HTMLInputElement>) => {
            setValue(event.currentTarget.value);
            setComposing(false);
        },
        onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            if (
                !composing &&
                !event.nativeEvent.isComposing &&
                event.currentTarget.reportValidity()
            )
                commit(value);
        },
    };
}

type SearchProps = Omit<
    ComponentProps<typeof SearchInput>,
    'value' | 'defaultValue' | 'name' | 'onValueChange' | 'onClear'
> & { name: string; value?: string };

/** URL-backed list search: debounce typing, preserve focus, and apply clear/Enter immediately. */
export function SearchFilter({ name, value = '', loading, ...props }: SearchProps) {
    const filter = useFilterValue(name, value);
    return (
        <SearchInput
            {...props}
            name={name}
            value={filter.value}
            loading={loading || filter.pending}
            onValueChange={filter.change}
            onInput={(event) => filter.change(event.currentTarget.value)}
            onClear={filter.clear}
            onCompositionStart={filter.onCompositionStart}
            onCompositionEnd={filter.onCompositionEnd}
            onKeyDown={filter.onKeyDown}
        />
    );
}

export function TextFilter({
    name,
    value = '',
    pattern,
    ...props
}: Omit<ComponentProps<typeof Input>, 'value' | 'defaultValue' | 'name' | 'onChange'> & {
    name: string;
    value?: string;
}) {
    const filter = useFilterValue(name, value, pattern);
    return (
        <Input
            {...props}
            pattern={pattern}
            name={name}
            value={filter.value}
            onChange={(event) => filter.change(event.currentTarget.value)}
            onInput={(event) => filter.change(event.currentTarget.value)}
            onCompositionStart={filter.onCompositionStart}
            onCompositionEnd={filter.onCompositionEnd}
            onKeyDown={filter.onKeyDown}
        />
    );
}

export function SelectFilter({
    name,
    value,
    ...props
}: Omit<
    ComponentProps<typeof FormSelect>,
    'name' | 'defaultValue' | 'submitOnChange' | 'onValueChange'
> & { name: string }) {
    const [, setParams] = useSearchParams();
    return (
        <FormSelect
            {...props}
            name={name}
            value={value}
            onValueChange={(next) => {
                if (String(value ?? '') === next) return;
                setParams((current) => updateFilterSearch(current, { [name]: next }));
            }}
        />
    );
}
