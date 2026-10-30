import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Page } from '@/shared/contracts/dto.schema';
import type { Scene, SceneWarning } from '@/shared/contracts/scene.schema';
import { useBookDraft } from '../../book-draft/ui/BookDraftProvider';
export function useSceneDraft(page: Page) {
    const { store, state } = useBookDraft(),
        navigate = useNavigate();
    const setDraft = useCallback(
        (update: Scene | ((scene: Scene) => Scene)) => store.setScene(page.id, update),
        [store, page.id],
    );
    const begin = useCallback(() => store.begin(), [store]);
    const end = useCallback(() => store.end(), [store]);
    const move = useCallback(
        (id: string) => {
            if (id && id !== page.id) navigate(`/books/${page.bookId}/pages/${id}`);
        },
        [navigate, page.id, page.bookId],
    );
    const undo = useCallback(() => move(store.undo()), [store, move]);
    const redo = useCallback(() => move(store.redo()), [store, move]);
    const save = useCallback(() => store.save(), [store]);
    const readLatest = useCallback((replace: boolean) => store.readLatest(replace), [store]);
    return {
        draft: page.scene,
        setDraft,
        begin,
        end,
        undo,
        redo,
        reset: setDraft,
        canUndo: state.canUndo,
        canRedo: state.canRedo,
        save,
        readLatest,
        busy: state.saving && !state.autosaving,
        saving: state.saving,
        autosaving: state.autosaving,
        dirty: state.dirty,
        conflict: state.conflict,
        uncertain: state.uncertain,
        error: state.error,
        notice: state.notice,
        warning: null as string | null,
        warnings: [] as SceneWarning[],
    };
}
