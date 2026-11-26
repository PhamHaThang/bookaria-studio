const edits = new Set<() => void>();

export function registerPendingTextEdit(flush: () => void) {
    edits.add(flush);
    return () => {
        edits.delete(flush);
    };
}

/** Action/checkpoint owners flush explicitly; window listener order is not reliable. */
export function flushPendingTextEdits() {
    for (const flush of [...edits]) flush();
}
