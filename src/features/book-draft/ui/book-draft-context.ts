import { createContext, useContext, useSyncExternalStore } from 'react';
import type { BookDraftStore } from '../model/book-draft-store';

// Share the same context when Vite loads an updated provider module.
export const BookDraftContext = createContext<BookDraftStore | null>(null);
export function useOptionalBookDraft() {
    return useContext(BookDraftContext);
}
export function useBookDraft() {
    const store = useContext(BookDraftContext);
    if (!store) throw new Error('Thiếu bản nháp sách.');
    const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
    return { store, state };
}
