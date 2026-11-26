import {
    type ComponentProps,
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from 'react';
import { flushSync } from 'react-dom';
import { registerPendingTextEdit } from '../lib/pending-text-edits';
import { Input } from './primitives/input';
import { Textarea } from './primitives/textarea';

type Control = HTMLInputElement | HTMLTextAreaElement;
type BufferedProps = { value: string; onValueChange: (value: string) => void };
type Managed =
    | 'value'
    | 'defaultValue'
    | 'onChange'
    | 'ref'
    | 'onBlur'
    | 'onCompositionStart'
    | 'onCompositionEnd'
    | 'onKeyDown';

/** Only the expensive model update waits. Native text/caret and IME stay local. */
function useBufferedText<T extends Control>(
    value: string,
    onValueChange: BufferedProps['onValueChange'],
) {
    const [text, setText] = useState(value);
    const input = useRef<T>(null);
    const latest = useRef(value),
        sent = useRef(value);
    const composing = useRef(false);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const callback = useRef(onValueChange);
    callback.current = onValueChange;
    const cancel = useCallback(() => {
        clearTimeout(timer.current);
        timer.current = undefined;
    }, []);
    const publish = useCallback(() => {
        cancel();
        // A focus change may precede React's final IME change event.
        latest.current = input.current?.value ?? latest.current;
        if (sent.current === latest.current) return;
        sent.current = latest.current;
        callback.current(latest.current);
    }, [cancel]);
    const flush = useCallback(() => {
        if (latest.current !== sent.current || input.current?.value !== sent.current)
            flushSync(publish);
    }, [publish]);
    function schedule() {
        cancel();
        timer.current = setTimeout(publish, 180);
    }
    useLayoutEffect(() => {
        if (value === sent.current) return;
        // Schemas trim titles/names. Keep a typed trailing space while focused so
        // pausing between words doesn't move the caret or join the next word.
        if (document.activeElement === input.current && value === sent.current.trim()) return;
        cancel();
        latest.current = value;
        sent.current = value;
        setText(value);
    }, [value, cancel]);
    useEffect(() => {
        const unregister = registerPendingTextEdit(flush);
        const outside = (event: Event) => {
            if (event.target !== input.current) flush();
        };
        const keyboard = (event: KeyboardEvent) => {
            if (
                !event.isComposing &&
                (event.ctrlKey || event.metaKey) &&
                event.key.toLowerCase() === 's'
            )
                flush();
        };
        const visibility = () => {
            if (document.visibilityState === 'hidden') flush();
        };
        window.addEventListener('pointerdown', outside, true);
        // Keyboard activation and HTMLElement.click() don't necessarily use a pointer.
        window.addEventListener('click', outside, true);
        window.addEventListener('keydown', keyboard, true);
        // Also support controls outside an editor; checkpoint owners use the registry.
        window.addEventListener('beforeunload', flush, true);
        window.addEventListener('pagehide', flush, true);
        window.addEventListener('popstate', flush, true);
        document.addEventListener('visibilitychange', visibility, true);
        return () => {
            unregister();
            cancel();
            window.removeEventListener('pointerdown', outside, true);
            window.removeEventListener('click', outside, true);
            window.removeEventListener('keydown', keyboard, true);
            window.removeEventListener('beforeunload', flush, true);
            window.removeEventListener('pagehide', flush, true);
            window.removeEventListener('popstate', flush, true);
            document.removeEventListener('visibilitychange', visibility, true);
        };
    }, [cancel, flush]);
    return {
        ref: input,
        value: text,
        onChange: (event: React.ChangeEvent<T>) => {
            latest.current = event.currentTarget.value;
            setText(latest.current);
            if (!composing.current) schedule();
        },
        onCompositionStart: () => {
            composing.current = true;
            cancel();
        },
        onCompositionEnd: (event: React.CompositionEvent<T>) => {
            composing.current = false;
            latest.current = event.currentTarget.value;
            setText(latest.current);
            schedule();
        },
        onBlur: () => {
            composing.current = false;
            flush();
        },
        onKeyDown: (event: React.KeyboardEvent<T>) => {
            if (
                event.key === 'Enter' &&
                !event.nativeEvent.isComposing &&
                !composing.current &&
                event.currentTarget.tagName === 'INPUT'
            )
                flush();
        },
    };
}

export function BufferedInput({
    value,
    onValueChange,
    ...props
}: Omit<ComponentProps<typeof Input>, Managed> & BufferedProps) {
    const input = useBufferedText<HTMLInputElement>(value, onValueChange);
    return <Input {...props} {...input} />;
}

export function BufferedTextarea({
    value,
    onValueChange,
    ...props
}: Omit<ComponentProps<typeof Textarea>, Managed> & BufferedProps) {
    const input = useBufferedText<HTMLTextAreaElement>(value, onValueChange);
    return <Textarea {...props} {...input} />;
}
