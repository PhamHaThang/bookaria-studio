export type SceneLoadState = { status: 'loading' | 'failed'; message?: string };

/** Transient renderer state, kept outside scene JSON and the undo history. */
export class SceneLoadStore {
    private state: ReadonlyMap<string, SceneLoadState> = new Map();
    private listeners = new Set<() => void>();
    getSnapshot = () => this.state;
    subscribe = (listener: () => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };
    set(id: string, value?: SceneLoadState) {
        if (!value && !this.state.has(id)) return;
        const next = new Map(this.state);
        if (value) next.set(id, value);
        else next.delete(id);
        this.state = next;
        for (const listener of this.listeners) listener();
    }
    clear() {
        if (!this.state.size) return;
        this.state = new Map();
        for (const listener of this.listeners) listener();
    }
}
