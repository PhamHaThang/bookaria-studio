import type {
    Action,
    InteractionRule,
    Trigger,
    WorkflowNavigation,
    WorkflowQuestion,
} from '../contracts/scene.schema';

import { WorkflowState } from './WorkflowState';

export type WorkflowEnvironment = {
    state?: WorkflowState;
    pageId?: string;
    visible?: (id: string) => boolean;
    question?: (question: WorkflowQuestion, signal: AbortSignal) => Promise<string | null>;
    navigate?: (navigation: WorkflowNavigation) => void;
};

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
export type InteractionStepEvent = {
    ruleId: string;
    index: number;
    nodeId?: string;
    branch?: 'true' | 'false';
    state: 'waiting' | 'running' | 'done' | 'error' | 'cancelled';
    message?: string;
};
export class InteractionRunner {
    /** Optional authoring observer; no effect on execution or public reader behavior. */
    onStep?: (event: InteractionStepEvent) => void;
    private active = new Map<string, { controller: AbortController; task: Promise<void> }>();
    private disposed = false;
    private rules: InteractionRule[];
    private execute: ActionExecutor;
    private onError: (message: string) => void;
    private delay: typeof sleep;
    private environment: WorkflowEnvironment;
    readonly progress: WorkflowState;
    constructor(
        rules: InteractionRule[],
        execute: ActionExecutor,
        onError: (message: string) => void = () => {},
        delay = sleep,
        environment: WorkflowEnvironment = {},
    ) {
        this.rules = rules;
        this.execute = execute;
        this.onError = onError;
        this.delay = delay;
        this.environment = environment;
        this.progress = environment.state || new WorkflowState();
    }
    private report(event: InteractionStepEvent) {
        try {
            this.onStep?.(event);
        } catch {
            /* Diagnostic UI must never affect execution. */
        }
    }
    fire(trigger: Trigger) {
        if (this.disposed) return Promise.resolve([]);
        if (trigger.type === 'onTap')
            this.progress.tap(this.environment.pageId || '', trigger.objectId);
        return Promise.all(
            this.rules
                .filter((rule) => {
                    const wanted = rule.trigger;
                    if (wanted.type !== trigger.type) return false;
                    if (
                        'objectId' in wanted &&
                        (!('objectId' in trigger) || wanted.objectId !== trigger.objectId)
                    )
                        return false;
                    if (wanted.type === 'onAnimationEnd' && trigger.type === 'onAnimationEnd')
                        return !wanted.clip || wanted.clip === trigger.clip;
                    if (wanted.type === 'onAnswer' && trigger.type === 'onAnswer')
                        return (
                            wanted.questionId === trigger.questionId &&
                            (wanted.answer === 'any' || wanted.answer === trigger.answer)
                        );
                    return true;
                })
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
        let index = 0;
        // Defer to a microtask so registration happens before a synchronous chain can finish.
        const task = Promise.resolve()
            .then(async () => {
                const layout = rule.editorLayout;
                const next = (from: string, port = 'next') =>
                    rule.workflow?.edges.find((edge) => edge.source === from && edge.port === port)
                        ?.target;
                let nodeId = rule.workflow ? next('start') : layout?.[1]?.id;
                const visited = new Set<string>();
                for (let count = 0; count < rule.actions.length; count++) {
                    if (rule.workflow) {
                        if (!nodeId) break;
                        if (visited.has(nodeId)) throw new Error('Luồng có vòng lặp không hợp lệ.');
                        visited.add(nodeId);
                        index = (layout?.findIndex((node) => node.id === nodeId) ?? 0) - 1;
                    } else index = count;
                    const action = rule.actions[index];
                    if (!action) throw new Error('Không tìm thấy bước trong luồng.');
                    const detail = { ruleId: id, index, nodeId: layout?.[index + 1]?.id };
                    controller.signal.throwIfAborted();
                    const delay = action.type === 'wait' ? action.ms : action.delayMsSchema;
                    if (delay) {
                        this.report({ ...detail, state: 'waiting' });
                        await this.delay(delay, controller.signal);
                    }
                    controller.signal.throwIfAborted();
                    let branch: 'true' | 'false' | undefined;
                    let terminal = false;
                    if (action.type !== 'wait') this.report({ ...detail, state: 'running' });
                    if (action.type === 'condition') {
                        branch = this.progress.test(
                            action.test,
                            this.environment.pageId || '',
                            this.environment.visible,
                        )
                            ? 'true'
                            : 'false';
                    } else if (action.type === 'setState') this.progress.set(action);
                    else if (action.type === 'askQuestion') {
                        if (!this.environment.question)
                            throw new Error('Chế độ xem này chưa mở được câu hỏi.');
                        const choiceId = await this.environment.question(
                            action.question,
                            controller.signal,
                        );
                        controller.signal.throwIfAborted();
                        if (choiceId === null) {
                            this.report({ ...detail, state: 'cancelled' });
                            break;
                        } else {
                            if (!action.question.choices.some((choice) => choice.id === choiceId))
                                throw new Error('Đáp án không hợp lệ.');
                            const correct = choiceId === action.question.correctChoiceId;
                            this.progress.answer(action.question.questionId, { choiceId, correct });
                            void this.fire({
                                type: 'onAnswer',
                                questionId: action.question.questionId,
                                answer: correct ? 'correct' : 'incorrect',
                            });
                        }
                    } else if (action.type === 'navigate') {
                        if (!this.environment.navigate)
                            throw new Error('Chế độ xem này chưa hỗ trợ chuyển trang.');
                        this.environment.navigate(action.navigation);
                        terminal = true;
                    } else if (action.type !== 'wait')
                        await this.execute(action, controller.signal);
                    controller.signal.throwIfAborted();
                    this.report({ ...detail, branch, state: 'done' });
                    if (terminal) break;
                    if (rule.workflow) nodeId = next(nodeId as string, branch || 'next');
                }
            })
            .catch((error) => {
                this.report({
                    ruleId: id,
                    index,
                    state: controller.signal.aborted ? 'cancelled' : 'error',
                    message: error instanceof Error ? error.message : undefined,
                });
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
