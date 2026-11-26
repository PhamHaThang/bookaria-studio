import type { Action, WorkflowCondition, WorkflowVariable } from '../contracts/scene.schema';

type Value = boolean | number | string;
/** Shared cause follows reactions across async steps; a new reader event starts a fresh chain. */
export type WorkflowChange = { reactions: number; stopped?: boolean };
export type Answer = { choiceId: string; correct: boolean };
/** Per-reader progress, shared between pages. Storage failure only disables persistence. */
export class WorkflowState {
    private values = new Map<string, Value>();
    private answers = new Map<string, Answer>();
    private counts = new Map<string, number>();
    private listeners = new Set<(change: WorkflowChange) => void>();
    private key?: string;
    private defaults: WorkflowVariable[];
    constructor(key?: string, definitions: WorkflowVariable[] = []) {
        this.key = key;
        this.defaults = definitions;
        this.initialize();
        if (!key) return;
        try {
            const text = localStorage.getItem(key);
            if (!text || text.length > 256000) return;
            const saved = JSON.parse(text);
            if (saved.version !== 1) return;
            for (const [name, value] of Object.entries(saved.values || {}).slice(0, 200))
                if (
                    /^[a-zA-Z][a-zA-Z0-9_.:-]{0,63}$/.test(name) &&
                    (typeof value === 'boolean' ||
                        (typeof value === 'string' && value.length <= 500) ||
                        (typeof value === 'number' &&
                            Number.isFinite(value) &&
                            Math.abs(value) <= 1e9))
                )
                    if (
                        !this.defaults.some(
                            (definition) =>
                                definition.key === name && definition.type !== typeof value,
                        )
                    )
                        this.values.set(name, value);
            for (const [name, answer] of Object.entries(saved.answers || {}).slice(0, 200)) {
                const value = answer as Answer;
                if (
                    name.length <= 64 &&
                    typeof value?.choiceId === 'string' &&
                    typeof value.correct === 'boolean'
                )
                    this.answers.set(name, { choiceId: value.choiceId, correct: value.correct });
            }
            for (const [name, count] of Object.entries(saved.counts || {}).slice(0, 1000))
                if (
                    name.length <= 140 &&
                    typeof count === 'number' &&
                    Number.isSafeInteger(count) &&
                    count >= 0
                )
                    this.counts.set(name, Math.min(count, 1000000));
        } catch {
            /* Private browsing or unavailable storage: keep an in-memory session. */
        }
    }
    private initialize() {
        for (const definition of this.defaults)
            this.values.set(definition.key, definition.initialValue);
    }
    private save() {
        if (!this.key) return;
        try {
            localStorage.setItem(this.key, JSON.stringify({ version: 1, ...this.snapshot() }));
        } catch {
            /* Reading must remain available without storage. */
        }
    }
    /** Notify pending conditions, including scene visibility changes. */
    notify(change: WorkflowChange = { reactions: 0 }) {
        for (const listener of [...this.listeners]) listener(change);
    }
    subscribe(listener: (change: WorkflowChange) => void) {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }
    snapshot() {
        return {
            values: Object.fromEntries(this.values),
            answers: Object.fromEntries(this.answers),
            counts: Object.fromEntries(this.counts),
        };
    }
    reset() {
        this.values.clear();
        this.answers.clear();
        this.counts.clear();
        this.initialize();
        this.save();
        this.notify();
    }
    set(action: Extract<Action, { type: 'setState' }>, change?: WorkflowChange) {
        if (!this.values.has(action.key) && this.values.size >= 200)
            throw new Error('Sách đã đạt giới hạn thông tin ghi nhớ.');
        const definition = this.defaults.find((item) => item.key === action.key);
        if (
            definition &&
            (typeof action.value !== definition.type ||
                (action.operation === 'increment' && definition.type !== 'number') ||
                (action.operation === 'toggle' && definition.type !== 'boolean'))
        )
            throw new Error(`Thông tin “${definition.name}” không phù hợp với thao tác này.`);
        const previous = this.values.get(action.key);
        let next: Value = action.value;
        if (action.operation === 'increment') {
            if (previous !== undefined && typeof previous !== 'number')
                throw new Error('Thông tin ghi nhớ này không phải điểm số.');
            next = Math.max(
                -1e9,
                Math.min(1e9, (typeof previous === 'number' ? previous : 0) + Number(action.value)),
            );
        }
        if (action.operation === 'toggle') {
            if (previous !== undefined && typeof previous !== 'boolean')
                throw new Error('Thông tin ghi nhớ này không phải trạng thái Đúng / Sai.');
            next = !(previous ?? false);
        }
        this.values.set(action.key, next);
        this.save();
        this.notify(change);
    }
    answer(id: string, answer: Answer, change?: WorkflowChange) {
        if (!this.answers.has(id) && this.answers.size >= 200)
            this.answers.delete(this.answers.keys().next().value as string);
        this.answers.set(id, answer);
        this.save();
        this.notify(change);
    }
    tap(pageId: string, objectId: string, change?: WorkflowChange) {
        const key = `${pageId}:${objectId}`;
        if (!this.counts.has(key) && this.counts.size >= 1000) return;
        this.counts.set(key, Math.min(1000000, (this.counts.get(key) || 0) + 1));
        this.save();
        this.notify(change);
    }
    test(test: WorkflowCondition, pageId: string, visible: (id: string) => boolean = () => false) {
        if (test.type === 'answer') {
            const answer = this.answers.get(test.questionId);
            return !!answer && answer.correct === (test.result === 'correct');
        }
        if (test.type === 'interactionCount')
            return (this.counts.get(`${pageId}:${test.objectId}`) || 0) >= test.min;
        if (test.type === 'visible') return visible(test.objectId) === test.value;
        const value =
            this.values.get(test.key) ??
            (typeof test.value === 'number' ? 0 : typeof test.value === 'boolean' ? false : '');
        if (test.operator === 'eq') return value === test.value;
        if (test.operator === 'ne') return value !== test.value;
        if (typeof value !== 'number' || typeof test.value !== 'number') return false;
        if (test.operator === 'gt') return value > test.value;
        if (test.operator === 'gte') return value >= test.value;
        if (test.operator === 'lt') return value < test.value;
        return value <= test.value;
    }
}
