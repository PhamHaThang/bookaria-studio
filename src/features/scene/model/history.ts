import type { Scene } from '../../../shared/contracts/scene.schema';

export type History = { past: Scene[]; present: Scene; future: Scene[] };
export const historyLimit = 80;
export function createHistory(scene: Scene): History {
    return { past: [], present: structuredClone(scene), future: [] };
}
export function commitHistory(history: History, scene: Scene): History {
    if (JSON.stringify(history.present) === JSON.stringify(scene)) return history;
    return {
        past: [...history.past, history.present].slice(-historyLimit),
        present: structuredClone(scene),
        future: [],
    };
}
export function undoHistory(history: History): History {
    const previous = history.past.at(-1);
    return previous
        ? {
              past: history.past.slice(0, -1),
              present: previous,
              future: [history.present, ...history.future].slice(0, historyLimit),
          }
        : history;
}
export function redoHistory(history: History): History {
    const next = history.future[0];
    return next
        ? {
              past: [...history.past, history.present].slice(-historyLimit),
              present: next,
              future: history.future.slice(1),
          }
        : history;
}
