import type { BookDraftStore } from './book-draft-store';
export const BOOK_AUTOSAVE_DELAY_MS = 5000;

/** Debounce authored edits; do not retry a failed or ambiguous write on a timer. */
export function startBookAutosave(
    store: BookDraftStore,
    {
        delay = BOOK_AUTOSAVE_DELAY_MS,
        isBlocked = () => false,
    }: { delay?: number; isBlocked?: () => boolean } = {},
) {
    let stopped = false,
        timer: ReturnType<typeof setTimeout> | undefined;
    let version = store.getSnapshot().editVersion,
        changedAt = Date.now(),
        attempted = -1;
    const clear = () => {
        if (timer !== undefined) clearTimeout(timer);
        timer = undefined;
    };
    const eligible = () => {
        const state = store.getSnapshot();
        return (
            state.dirty &&
            !state.loading &&
            !state.recovery &&
            !state.error &&
            !state.conflict &&
            !state.uncertain
        );
    };
    function schedule() {
        if (stopped) return;
        const state = store.getSnapshot();
        if (state.editVersion !== version) {
            version = state.editVersion;
            changedAt = Date.now();
            attempted = -1;
        }
        clear();
        if (!eligible() || state.saving || attempted === version) return;
        timer = setTimeout(tick, Math.max(0, delay - (Date.now() - changedAt)));
    }
    function tick() {
        timer = undefined;
        if (stopped || !eligible() || store.getSnapshot().saving) return;
        if (isBlocked() || !store.canAutosave()) {
            timer = setTimeout(tick, 500);
            return;
        }
        attempted = version;
        void store
            .save(
                'auto',
                () =>
                    !stopped &&
                    !isBlocked() &&
                    Date.now() - changedAt >= delay &&
                    store.canAutosave(true),
            )
            .then((saved) => {
                if (!saved && eligible()) attempted = -1;
                schedule();
            });
    }
    const unsubscribe = store.subscribe(schedule);
    schedule();
    return {
        wake: schedule,
        stop() {
            stopped = true;
            clear();
            unsubscribe();
        },
    };
}
