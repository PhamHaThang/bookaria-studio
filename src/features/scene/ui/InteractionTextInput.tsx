import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Input } from '@/shared/ui/primitives/input';

/** Keep typing and IME local; publish a batch without losing pending text at action boundaries. */
export function InteractionTextInput({
    value,
    disabled,
    onValueChange,
}: {
    value: string;
    disabled: boolean;
    onValueChange: (value: string) => void;
}) {
    const [text, setText] = useState(value);
    const input = useRef<HTMLInputElement>(null);
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
        if (sent.current === latest.current) return;
        sent.current = latest.current;
        callback.current(latest.current);
    }, [cancel]);
    function schedule() {
        cancel();
        timer.current = setTimeout(publish, 180);
    }
    useLayoutEffect(() => {
        if (value === sent.current) return;
        // Undo, a different variable, or remote content replaces the pending local edit.
        cancel();
        latest.current = value;
        sent.current = value;
        setText(value);
    }, [value, cancel]);
    useEffect(() => {
        const flush = () => {
            if (latest.current !== sent.current) flushSync(publish);
        };
        const pointer = (event: PointerEvent) => {
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
        window.addEventListener('pointerdown', pointer, true);
        window.addEventListener('keydown', keyboard, true);
        window.addEventListener('pagehide', flush);
        document.addEventListener('visibilitychange', visibility);
        return () => {
            cancel();
            window.removeEventListener('pointerdown', pointer, true);
            window.removeEventListener('keydown', keyboard, true);
            window.removeEventListener('pagehide', flush);
            document.removeEventListener('visibilitychange', visibility);
        };
    }, [cancel, publish]);
    return (
        <Input
            ref={input}
            aria-label="Giá trị ghi nhớ"
            value={text}
            maxLength={500}
            disabled={disabled}
            onChange={(event) => {
                latest.current = event.target.value;
                setText(event.target.value);
                if (!composing.current) schedule();
            }}
            onCompositionStart={() => {
                composing.current = true;
                cancel();
            }}
            onCompositionEnd={(event) => {
                composing.current = false;
                latest.current = event.currentTarget.value;
                setText(latest.current);
                schedule();
            }}
            onBlur={() => {
                composing.current = false;
                flushSync(publish);
            }}
            onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) flushSync(publish);
            }}
        />
    );
}
