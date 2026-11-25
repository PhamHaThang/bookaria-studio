import { LoaderCircle, Pause, Play } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { audioTime } from '@/shared/scene/audio-card';
import { Button } from '@/shared/ui/primitives/button';
import { Progress } from '@/shared/ui/primitives/progress';
import type { SceneAudioStore } from '../model/scene-audio-store';

export function SceneAudioControls({
    id,
    store,
    disabled,
}: {
    id: string;
    store: SceneAudioStore;
    disabled: boolean;
}) {
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot).get(id);
    const duration = state?.duration || 0;
    const currentTime = state?.currentTime || 0;
    return (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-2.5">
            <div className="flex min-w-0 items-center gap-3">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={disabled || !state}
                    onClick={() => void store.toggle(id)}
                >
                    {state?.waiting ? (
                        <LoaderCircle
                            data-icon="inline-start"
                            className="animate-spin motion-reduce:animate-none"
                        />
                    ) : state?.playing ? (
                        <Pause data-icon="inline-start" />
                    ) : (
                        <Play data-icon="inline-start" />
                    )}
                    {state?.playing ? 'Tạm dừng' : 'Nghe thử'}
                </Button>
                <div className="grid min-w-0 flex-1 gap-1.5">
                    <span className="text-muted-foreground text-xs tabular-nums">
                        {audioTime(currentTime)} / {duration > 0 ? audioTime(duration) : '–:––'}
                    </span>
                    <Progress
                        className="h-1"
                        aria-label="Tiến độ nghe thử"
                        value={duration > 0 ? (currentTime / duration) * 100 : 0}
                    />
                </div>
            </div>
            {state?.waiting && (
                <p className="m-0 text-muted-foreground text-xs" role="status">
                    Đang tải âm thanh…
                </p>
            )}
            {state?.error && (
                <p className="m-0 text-destructive text-xs" role="alert">
                    {state.error}
                </p>
            )}
        </div>
    );
}
