export type PageDropTarget = { id: string; after: boolean };

/** Insert at an edge of the target card, preserving every other page's order. */
export function droppedPageIds(
    pages: readonly { id: string }[],
    sourceId: string,
    target: PageDropTarget,
): string[] | null {
    const original = pages.map((page) => page.id);
    if (new Set(original).size !== original.length) return null;
    if (!original.includes(sourceId) || !original.includes(target.id) || sourceId === target.id)
        return null;
    const ids = original.filter((id) => id !== sourceId);
    const index = ids.indexOf(target.id) + (target.after ? 1 : 0);
    ids.splice(index, 0, sourceId);
    return ids.every((id, position) => id === original[position]) ? null : ids;
}
