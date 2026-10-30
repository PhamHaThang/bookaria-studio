export const COLOR_PREVIEW_INTERVAL_MS = 50;
export const isHexColor = (value: string) => /^#[0-9a-f]{6}$/i.test(value);

/** Keep the native picker responsive; publish the latest value at most twenty times a second. */
export function createColorChangeSession({
    onChange,
    onBegin,
    onEnd,
    interval = COLOR_PREVIEW_INTERVAL_MS,
}: {
    onChange: (value: string) => void;
    onBegin?: () => void;
    onEnd?: (committed: boolean) => void;
    interval?: number;
}) {
    let timer: ReturnType<typeof setTimeout> | undefined, pending: string | undefined;
    let active = false,
        lastSent: string | undefined,
        lastAt = -Infinity;
    const clear = () => {
        if (timer !== undefined) clearTimeout(timer);
        timer = undefined;
    };
    const send = () => {
        clear();
        const value = pending;
        pending = undefined;
        if (value === undefined || value === lastSent) return;
        lastSent = value;
        lastAt = Date.now();
        onChange(value);
    };
    const begin = () => {
        if (active) return;
        active = true;
        lastSent = undefined;
        lastAt = -Infinity;
        onBegin?.();
    };
    const finish = (publish: boolean) => {
        clear();
        if (publish) send();
        else pending = undefined;
        if (active) {
            active = false;
            onEnd?.(publish);
        }
    };
    return {
        begin,
        change(value: string) {
            begin();
            pending = value;
            const remaining = interval - (Date.now() - lastAt);
            if (remaining <= 0) send();
            else if (timer === undefined) timer = setTimeout(send, remaining);
        },
        finish: () => finish(true),
        cancel: () => finish(false),
    };
}
