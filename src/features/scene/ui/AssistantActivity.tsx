import { type Ref, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Boki, type MascotState } from '@/shared/ui/Boki';

// These are expressive poses while one request is pending, not server progress stages.
const poses = ['thinking', 'searching', 'saving'] satisfies MascotState[];
const introDuration = 1100;
// Avatar Core's pencil draws and lifts over 2.5s; the Busy body clip is a separate 2.4s loop.
const draftDuration = 2500;

export type AssistantActivityHandle = { finish: (signal: AbortSignal) => Promise<void> };

function waitForPose(milliseconds: number, signal: AbortSignal) {
    signal.throwIfAborted();
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    if (milliseconds <= 0 || media.matches || document.hidden) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
        const clean = () => {
            clearTimeout(timer);
            signal.removeEventListener('abort', abort);
            media.removeEventListener('change', preference);
            document.removeEventListener('visibilitychange', preference);
        };
        const done = () => {
            clean();
            resolve();
        };
        const abort = () => {
            clean();
            reject(signal.reason);
        };
        const preference = () => {
            if (media.matches || document.hidden) done();
        };
        const timer = setTimeout(done, milliseconds);
        signal.addEventListener('abort', abort, { once: true });
        media.addEventListener('change', preference);
        document.addEventListener('visibilitychange', preference);
    });
}

export function AssistantActivity({
    paused = false,
    ref,
}: {
    paused?: boolean;
    ref?: Ref<AssistantActivityHandle>;
}) {
    const [pose, setPose] = useState(-1);
    const [closing, setClosing] = useState<'waiting' | 'draft' | 'idle'>('waiting');
    const current = useRef({ pose: -1, started: performance.now() });
    const finishing = useRef(false);
    const loop = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useImperativeHandle(
        ref,
        () => ({
            async finish(signal) {
                signal.throwIfAborted();
                finishing.current = true;
                clearTimeout(loop.current);
                if (
                    paused ||
                    matchMedia('(prefers-reduced-motion: reduce)').matches ||
                    document.hidden
                )
                    return;
                // A quick response still gives the opening idle pose its full beat.
                if (current.current.pose === -1)
                    await waitForPose(
                        introDuration - (performance.now() - current.current.started),
                        signal,
                    );
                signal.throwIfAborted();
                const elapsed =
                    current.current.pose === 2 ? performance.now() - current.current.started : 0;
                setClosing('draft');
                // Finish the current pencil stroke, even if it has already started another loop.
                await waitForPose(draftDuration - (elapsed % draftDuration), signal);
                signal.throwIfAborted();
                setClosing('idle');
                await waitForPose(760, signal);
            },
        }),
        [paused],
    );
    useEffect(() => {
        const media = matchMedia('(prefers-reduced-motion: reduce)');
        const sync = () => {
            clearTimeout(loop.current);
            loop.current = undefined;
            if (finishing.current) return;
            if (media.matches) {
                current.current.pose = 0;
                setPose(0);
            }
            if (!paused && !media.matches && !document.hidden) {
                const advance = () => {
                    const next = (current.current.pose + 1) % poses.length;
                    current.current = { pose: next, started: performance.now() };
                    setPose(next);
                    loop.current = setTimeout(advance, next === 2 ? draftDuration : 3200);
                };
                const delay =
                    current.current.pose === -1
                        ? Math.max(0, introDuration - (performance.now() - current.current.started))
                        : 3200;
                loop.current = setTimeout(advance, delay);
            }
        };
        sync();
        media.addEventListener('change', sync);
        document.addEventListener('visibilitychange', sync);
        return () => {
            clearTimeout(loop.current);
            media.removeEventListener('change', sync);
            document.removeEventListener('visibilitychange', sync);
        };
    }, [paused]);
    const state =
        closing === 'idle' ? 'idle' : closing === 'draft' ? 'saving' : (poses[pose] ?? 'idle');
    // The native morphs have different footprints; balance their apparent size in this chat slot.
    const scale = state === 'idle' ? 1 : state === 'saving' ? 1.7 : 1.4;
    return (
        <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-assistant-activity
            data-assistant-phase={closing === 'waiting' && pose === -1 ? 'intro' : closing}
            className="flex min-h-6 items-center gap-2 font-medium text-muted-foreground text-xs"
        >
            <span className="inline-flex size-6 shrink-0 items-center justify-center">
                <span
                    className="inline-flex transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
                    style={{ transform: `scale(${scale})` }}
                >
                    <Boki state={state} size={24} animate task paused={paused} />
                </span>
            </span>
            <span>{closing === 'waiting' ? 'Đang suy nghĩ…' : 'Đang chuẩn bị phản hồi…'}</span>
        </div>
    );
}
