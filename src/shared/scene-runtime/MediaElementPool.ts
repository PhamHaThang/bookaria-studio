// A real, silent PCM track: unmuted play() can grant this element later audible playback.
const silence =
    'data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';

type Entry = {
    kind: 'audio' | 'video';
    slot: string;
    element: HTMLMediaElement;
    leased: boolean;
    primed: boolean;
    priming?: symbol;
};

/** Reuse the media elements granted playback by a reader's gesture across page changes. */
export class MediaElementPool {
    private entries: Entry[] = [];

    private create(kind: Entry['kind'], slot: string): Entry {
        const entry = {
            kind,
            slot,
            element: kind === 'audio' ? new Audio() : document.createElement('video'),
            leased: false,
            primed: false,
        };
        this.entries.push(entry);
        return entry;
    }

    /** Must run directly in the click handler, before awaiting camera permission or assets. */
    primeAudio(slots: Iterable<string>) {
        for (const slot of slots) {
            const entry =
                this.entries.find((item) => item.kind === 'audio' && item.slot === slot) ??
                this.create('audio', slot);
            if (entry.leased || entry.primed || entry.priming) continue;
            const token = Symbol();
            entry.priming = token;
            const element = entry.element;
            element.src = silence;
            element.muted = false;
            element.volume = 1;
            const finish = (permitted: boolean) => {
                // Loading a page or disposing the pool may have taken over this element.
                if (entry.priming !== token) return;
                entry.primed = permitted;
                this.reset(entry);
            };
            try {
                const playing = element.play();
                if (playing)
                    void playing.then(
                        () => finish(true),
                        () => finish(false),
                    );
                else finish(true);
            } catch {
                finish(false);
            }
        }
    }

    private acquire(kind: 'audio' | 'video', slot: string): HTMLMediaElement {
        let entry = this.entries.find(
            (item) => item.kind === kind && item.slot === slot && !item.leased,
        );
        entry ??= this.entries.find((item) => item.kind === kind && !item.leased);
        entry ??= this.create(kind, slot);
        if (entry.priming) this.reset(entry);
        entry.slot = slot;
        entry.leased = true;
        return entry.element;
    }

    audio(slot: string): HTMLAudioElement {
        return this.acquire('audio', slot) as HTMLAudioElement;
    }
    video(slot: string): HTMLVideoElement {
        return this.acquire('video', slot) as HTMLVideoElement;
    }

    release(element: HTMLMediaElement) {
        const entry = this.entries.find((item) => item.element === element);
        if (!entry?.leased) return;
        this.reset(entry);
        entry.leased = false;
    }

    private reset(entry: Entry) {
        entry.priming = undefined;
        const element = entry.element;
        element.pause();
        element.removeAttribute('src');
        element.load();
        element.loop = false;
        element.muted = false;
        element.volume = 1;
    }

    dispose() {
        for (const entry of this.entries) this.reset(entry);
        this.entries = [];
    }
}
