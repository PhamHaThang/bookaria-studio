import type { Action, InteractionRule, Trigger } from '../contracts/scene.schema';

export function sleep(ms: number, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
        const abort = () => {
            clearTimeout(timer);
            reject(signal.reason);
        };
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', abort);
            resolve();
        }, ms);
        signal.addEventListener('abort', abort, { once: true });
    });
}
export type ActionExecutor = (
    action: Exclude<Action, { type: 'wait' }>,
    signal: AbortSignal,
) => void | Promise<void>;
export class InteractionRunner {
    private active = new Map<string, { controller: AbortController; task: Promise<void> }>();
    private disposed = false;
    private rules: InteractionRule[];
    private execute: ActionExecutor;
    private onError: (message: string) => void;
    private delay: typeof sleep;
    constructor(
        rules: InteractionRule[],
        execute: ActionExecutor,
        onError: (message: string) => void = () => {},
        delay = sleep,
    ) {
        this.rules = rules;
        this.execute = execute;
        this.onError = onError;
        this.delay = delay;
    }
    fire(trigger: Trigger) {
        return Promise.all(
            this.rules
                .filter(
                    (rule) =>
                        rule.trigger.type === trigger.type &&
                        (trigger.type !== 'onTap' ||
                            (rule.trigger.type === 'onTap' &&
                                rule.trigger.objectId === trigger.objectId)),
                )
                .map((rule) => this.run(rule.id)),
        );
    }
    run(id: string): Promise<void> {
        const rule = this.rules.find((item) => item.id === id);
        if (this.disposed || !rule?.enabled) return Promise.resolve();
        const previous = this.active.get(id);
        if (previous && rule.onRetrigger === 'ignore') return previous.task;
        previous?.controller.abort();
        const controller = new AbortController();
        // Defer to a microtask so registration happens before a synchronous chain can finish.
        const task = Promise.resolve()
            .then(async () => {
                for (const action of rule.actions) {
                    controller.signal.throwIfAborted();
                    const delay = action.type === 'wait' ? action.ms : action.delayMsSchema;
                    if (delay) await this.delay(delay, controller.signal);
                    controller.signal.throwIfAborted();
                    if (action.type !== 'wait') await this.execute(action, controller.signal);
                }
            })
            .catch((error) => {
                if (!controller.signal.aborted)
                    this.onError(
                        error instanceof Error ? error.message : 'Không chạy được tương tác.',
                    );
            })
            .finally(() => {
                if (this.active.get(id)?.controller === controller) this.active.delete(id);
            });
        this.active.set(id, { controller, task });
        return task;
    }
    cancelAll() {
        for (const run of this.active.values()) run.controller.abort();
        this.active.clear();
    }
    dispose() {
        this.disposed = true;
        this.cancelAll();
    }
}
