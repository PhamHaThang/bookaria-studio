import { type Ref, useEffect, useRef, useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { Boki } from '@/shared/ui/Boki';

export type LauncherReaction = { state: 'success' | 'error'; id: string };

/** The launcher reacts; chat author portraits stay still and front-facing. */
export function AssistantLauncher({
    ref,
    open,
    disabled,
    className,
    onToggle,
    reaction,
}: {
    ref: Ref<HTMLButtonElement>;
    open: boolean;
    disabled: boolean;
    className?: string;
    onToggle: () => void;
    reaction?: LauncherReaction;
}) {
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);
    const [attentive, setAttentive] = useState(false);
    const [pressed, setPressed] = useState(false);
    const [feedback, setFeedback] = useState<'success' | 'error'>();
    const release = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => {
        const watching = hovered || focused;
        if (!watching) {
            setAttentive(false);
            return;
        }
        const timer = setTimeout(() => setAttentive(true), 120);
        return () => clearTimeout(timer);
    }, [hovered, focused]);
    useEffect(() => {
        if (!reaction) return;
        setFeedback(reaction.state);
        const timer = setTimeout(
            () => setFeedback(undefined),
            reaction.state === 'success' ? 1800 : 2400,
        );
        return () => clearTimeout(timer);
    }, [reaction]);
    useEffect(() => () => clearTimeout(release.current), []);
    const state = disabled
        ? 'disabled'
        : feedback
          ? feedback
          : pressed
            ? 'pressed'
            : attentive
              ? 'hover'
              : 'idle';
    return (
        <button
            ref={ref}
            type="button"
            data-assistant-launcher
            aria-label={open ? 'Thu gọn trợ lý AI' : 'Trợ lý Boki'}
            title={open ? 'Thu gọn trợ lý AI' : 'Trợ lý Boki'}
            aria-expanded={open}
            disabled={disabled}
            className={cn(
                'pointer-events-auto inline-flex size-16 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-foreground shadow-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
                className,
            )}
            onPointerEnter={(event) => {
                if (event.pointerType === 'mouse') {
                    setFocused(false);
                    setHovered(true);
                }
            }}
            onPointerLeave={() => {
                setHovered(false);
                setAttentive(false);
                clearTimeout(release.current);
                release.current = setTimeout(() => setPressed(false), 760);
            }}
            onPointerDown={() => {
                clearTimeout(release.current);
                setPressed(true);
            }}
            onPointerUp={() => {
                release.current = setTimeout(() => setPressed(false), 760);
            }}
            onPointerCancel={() => setPressed(false)}
            onFocus={(event) => setFocused(event.currentTarget.matches(':focus-visible'))}
            onBlur={() => {
                setFocused(false);
            }}
            onClick={() => {
                clearTimeout(release.current);
                setPressed(true);
                release.current = setTimeout(() => setPressed(false), 760);
                onToggle();
            }}
        >
            <Boki
                className="pointer-events-none"
                state={state}
                size={64}
                animate={!disabled}
                followPointer={!disabled}
            />
        </button>
    );
}
