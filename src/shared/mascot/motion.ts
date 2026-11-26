export const mascotStates = [
    'idle',
    'welcome',
    'hover',
    'pressed',
    'reading',
    'thinking',
    'searching',
    'loading',
    'uploading',
    'saving',
    'success',
    'error',
    'warning',
    'empty',
    'offline',
    'sleeping',
    'disabled',
    'scanning',
    'marker-found',
    'marker-lost',
] as const;
export type MascotState = (typeof mascotStates)[number];
export const taskStates = new Set<MascotState>([
    'thinking',
    'searching',
    'loading',
    'uploading',
    'saving',
    'scanning',
]);

/** One visible animation owns attention; static avatars never enter this registry. */
export function createMotionRegistry() {
    const candidates = new Map<symbol, number>();
    const listeners = new Set<() => void>();
    let winner: symbol | null = null;
    const update = () => {
        let next: symbol | null = null;
        let priority = -1;
        for (const [id, value] of candidates) {
            if (value > priority) {
                next = id;
                priority = value;
            }
        }
        if (winner === next) return;
        winner = next;
        for (const listener of listeners) listener();
    };
    return {
        getSnapshot: () => winner,
        subscribe(listener: () => void) {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        claim(id: symbol, priority: number) {
            candidates.set(id, priority);
            update();
            return () => {
                candidates.delete(id);
                update();
            };
        },
    };
}
export const mascotMotion = createMotionRegistry();
