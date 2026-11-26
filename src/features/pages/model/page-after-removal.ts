/** Keep reading forwards after deletion, or return to the preceding surviving page. */
export function pageAfterRemoval(
    previous: readonly { id: string }[],
    remaining: readonly { id: string }[],
    removedId: string,
): string | undefined {
    const available = new Set(remaining.map((page) => page.id));
    const index = previous.findIndex((page) => page.id === removedId);
    if (index >= 0) {
        for (let next = index + 1; next < previous.length; next++)
            if (available.has(previous[next].id)) return previous[next].id;
        for (let next = index - 1; next >= 0; next--)
            if (available.has(previous[next].id)) return previous[next].id;
    }
    return remaining[0]?.id;
}
