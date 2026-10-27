import { type AudioPlaybackState, observeAudio } from '@/shared/scene/audio-card';

export class SceneAudioStore {
    private state: ReadonlyMap<string, AudioPlaybackState> = new Map();
    private listeners = new Set<() => void>();
    private players = new Map<
        string,
        {
            element: HTMLAudioElement;
            update: (state: AudioPlaybackState) => void;
            failed: (message: string) => void;
            attempt: number;
        }
    >();
    getSnapshot = () => this.state;
    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };
    private publish(id: string, value?: AudioPlaybackState) {
        const next = new Map(this.state);
        if (value) next.set(id, value);
        else next.delete(id);
        this.state = next;
        for (const listener of this.listeners) listener();
    }
    register(
        id: string,
        element: HTMLAudioElement,
        update: (state: AudioPlaybackState) => void,
        failed: (message: string) => void,
    ) {
        const player = { element, update, failed, attempt: 0 };
        this.players.set(id, player);
        const stop = observeAudio(element, (state) => {
            if (this.players.get(id) !== player) return;
            const previous = this.state.get(id);
            update(state);
            this.publish(id, state);
            if (state.error && state.error !== previous?.error) failed(state.error);
        });
        return () => {
            stop();
            if (this.players.get(id) === player) {
                this.players.delete(id);
                this.publish(id);
            }
        };
    }
    pause(id: string) {
        const player = this.players.get(id);
        if (!player) return;
        player.attempt++;
        player.element.pause();
    }
    async toggle(id: string) {
        const player = this.players.get(id);
        if (!player) return;
        const attempt = ++player.attempt;
        if (!player.element.paused && !player.element.error) {
            player.element.pause();
            return;
        }
        if (player.element.error) player.element.load();
        try {
            await player.element.play();
        } catch {
            if (this.players.get(id) !== player || attempt !== player.attempt) return;
            const error = 'Không phát được âm thanh. Hãy thử lại.';
            const state = {
                playing: false,
                waiting: false,
                currentTime: player.element.currentTime || 0,
                duration: Number.isFinite(player.element.duration) ? player.element.duration : 0,
                error,
            };
            player.update(state);
            this.publish(id, state);
            player.failed(error);
        }
    }
}
