import { type SetStateAction, useRef, useState } from 'react';
import type { Scene } from '../../../shared/contracts/scene.schema';
import { commitHistory, createHistory, redoHistory, undoHistory } from './history';

export function useSceneHistory(initial: Scene) {
    const [history, render] = useState(() => createHistory(initial));
    const current = useRef(history);
    const gesture = useRef<Scene | null>(null);
    function publish(next: typeof history) {
        current.current = next;
        render(next);
    }
    function setDraft(update: SetStateAction<Scene>) {
        const next = typeof update === 'function' ? update(current.current.present) : update;
        if (gesture.current) publish({ ...current.current, present: structuredClone(next) });
        else publish(commitHistory(current.current, next));
    }
    function begin() {
        if (!gesture.current) gesture.current = structuredClone(current.current.present);
    }
    function end() {
        if (!gesture.current) return;
        const before = gesture.current;
        gesture.current = null;
        publish(commitHistory({ ...current.current, present: before }, current.current.present));
    }
    function reset(scene: Scene) {
        gesture.current = null;
        publish(createHistory(scene));
    }
    return {
        draft: history.present,
        setDraft,
        reset,
        begin,
        end,
        canUndo: history.past.length > 0,
        canRedo: history.future.length > 0,
        undo() {
            end();
            publish(undoHistory(current.current));
        },
        redo() {
            end();
            publish(redoHistory(current.current));
        },
    };
}
