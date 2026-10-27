import { Pause, Play } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { audioTime } from '@/shared/scene/audio-card';
import { Button } from '@/shared/ui/primitives/button';
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
    return (
        <div className="flex flex-col gap-2">
            <Button
                variant="outline"
                disabled={disabled || !state}
                onClick={() => void store.toggle(id)}
            >
                {state?.playing ? (
                    <Pause data-icon="inline-start" />
                ) : (
                    <Play data-icon="inline-start" />
                )}
                {state?.playing ? 'Tạm dừng' : 'Nghe thử'}
            </Button>
            {state && (
                <p className="m-0 text-muted-foreground text-xs" role="status">
                    {state.error ||
                        `${audioTime(state.currentTime)} / ${audioTime(state.duration)}`}
                </p>
            )}
        </div>
    );
}
