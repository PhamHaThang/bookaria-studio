import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createColorChangeSession, isHexColor } from '../lib/color-change-session';
import { Input } from './primitives/input';

export function ColorInput({
    id,
    label,
    value,
    onValueChange,
    onPreview,
    disabled = false,
    onInteractionStart,
    onInteractionEnd,
}: {
    id: string;
    label: string;
    value: string;
    onValueChange: (value: string) => void;
    onPreview?: (value: string) => void;
    disabled?: boolean;
    onInteractionStart?: () => void;
    onInteractionEnd?: () => void;
}) {
    const [local, setLocal] = useState(value);
    const native = useRef<HTMLInputElement>(null),
        editing = useRef(false);
    const currentColor = useRef(value);
    const initialColor = useRef(isHexColor(value) ? value : '#252525');
    const latest = useRef({
        value,
        onValueChange,
        onPreview,
        onInteractionStart,
        onInteractionEnd,
    });
    latest.current = { value, onValueChange, onPreview, onInteractionStart, onInteractionEnd };
    const [session] = useState(() =>
        createColorChangeSession({
            onChange: (color) => {
                if (latest.current.onPreview) {
                    if (isHexColor(color)) latest.current.onPreview(color);
                } else latest.current.onValueChange(color);
            },
            onBegin: () => {
                editing.current = true;
                latest.current.onInteractionStart?.();
            },
            onEnd: (committed) => {
                if (latest.current.onPreview) {
                    if (committed && currentColor.current !== latest.current.value)
                        latest.current.onValueChange(currentColor.current);
                    else if (!committed && isHexColor(latest.current.value))
                        latest.current.onPreview(latest.current.value);
                }
                editing.current = false;
                latest.current.onInteractionEnd?.();
            },
        }),
    );
    // A throttled parent acknowledgment must not pull a running drag back to an older color.
    useLayoutEffect(() => {
        if (editing.current) return;
        currentColor.current = value;
        setLocal(value);
        if (native.current && isHexColor(value)) native.current.value = value;
    }, [value]);
    useEffect(() => {
        const input = native.current;
        const commit = () => {
            if (input && !input.disabled) {
                currentColor.current = input.value;
                setLocal(input.value);
                session.change(input.value);
            }
            session.finish();
        };
        // Native `change` fires when the picker confirms; React may suppress it after `input`.
        input?.addEventListener('change', commit);
        return () => {
            input?.removeEventListener('change', commit);
            session.cancel();
        };
    }, [session]);
    useEffect(() => {
        if (disabled) session.cancel();
    }, [disabled, session]);
    const update = (color: string) => {
        if (disabled) return;
        currentColor.current = color;
        setLocal(color);
        if (native.current && isHexColor(color)) native.current.value = color;
        session.change(color);
    };
    return (
        <div className="flex min-w-0 items-center gap-2" data-color-input>
            <Input
                ref={native}
                type="color"
                defaultValue={initialColor.current}
                aria-label={`Chọn ${label.toLowerCase()}`}
                disabled={disabled}
                onInput={(event) => update(event.currentTarget.value)}
                onBlur={() => session.finish()}
                className="mt-0 size-10 shrink-0 basis-10 cursor-pointer p-1"
            />
            <Input
                id={id}
                value={local}
                maxLength={7}
                spellCheck={false}
                autoComplete="off"
                aria-label={label}
                aria-invalid={!isHexColor(local)}
                disabled={disabled}
                onFocus={() => session.begin()}
                onChange={(event) => update(event.currentTarget.value)}
                onBlur={() => session.finish()}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') session.finish();
                }}
                className="mt-0 flex-1"
            />
        </div>
    );
}
