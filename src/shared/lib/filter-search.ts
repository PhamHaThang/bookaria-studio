/** Apply list filters without losing the active section or unrelated filters. */
export function updateFilterSearch(
    current: URLSearchParams,
    changes: Record<string, string | undefined>,
) {
    const next = new URLSearchParams(current);
    for (const [key, value] of Object.entries(changes)) {
        const trimmed = value?.trim();
        if (trimmed) next.set(key, trimmed);
        else next.delete(key);
    }
    if (!('page' in changes)) next.delete('page');
    return next;
}
