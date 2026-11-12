import type {
    Action,
    ActionType,
    InteractionRule,
    Scene,
    SceneObject,
    Trigger,
} from '../../../shared/contracts/scene.schema';
import { SCENE_LIMITS } from '../../../shared/contracts/scene.schema';

export const triggerLabels: Record<Trigger['type'], string> = {
    onPageEnter: 'Khi vào trang',
    onPageLeave: 'Khi rời trang',
    onTap: 'Khi chạm đối tượng',
    onMarkerFound: 'Khi nhận diện trang AR',
    onMarkerLost: 'Khi mất dấu trang AR',
    onAnimationEnd: 'Khi hoạt ảnh kết thúc',
    onAnswer: 'Khi trả lời câu hỏi',
    onStateCondition: 'Khi ghi nhớ đạt điều kiện',
};
export const actionLabels: Record<ActionType, string> = {
    controlModel: 'Điều khiển mô hình',
    playAudio: 'Phát âm thanh',
    stopAudio: 'Dừng âm thanh',
    playAnimation: 'Chạy hoạt cảnh 3D',
    setVisible: 'Hiện hoặc ẩn đối tượng',
    toggleVisible: 'Đổi hiện / ẩn mỗi lần chạm',
    playVideo: 'Phát video',
    openUrl: 'Mở liên kết',
    wait: 'Đợi một khoảng thời gian',
    waitUntil: 'Chờ đến khi điều kiện đúng',
    transformTo: 'Di chuyển, xoay hoặc đổi kích thước',
    condition: 'Nếu điều kiện đúng',
    setState: 'Ghi nhớ',
    askQuestion: 'Hiển thị câu hỏi',
    navigate: 'Chuyển trang / kết thúc',
};
export function targetObjects(objects: SceneObject[], type: Trigger['type'] | ActionType) {
    return objects.filter((object) =>
        type === 'onTap'
            ? object.type !== 'audio'
            : type === 'controlModel' || type === 'playAnimation' || type === 'onAnimationEnd'
              ? object.type === 'model'
              : type === 'playVideo'
                ? object.type === 'video'
                : true,
    );
}
// Incomplete new actions stay local until the author chooses their required resource/target.
export function newAction(type: ActionType): Action {
    const delayMsSchema = 0;
    switch (type) {
        case 'controlModel':
            return { type, objectId: '', operation: 'enable', delayMsSchema };
        case 'waitUntil':
        case 'condition':
            return {
                type,
                test: { type: 'variable', key: 'score', operator: 'gte', value: 1 },
                delayMsSchema,
            };
        case 'setState':
            return { type, key: 'score', operation: 'increment', value: 1, delayMsSchema };
        case 'askQuestion':
            return {
                type,
                question: {
                    questionId: `q-${crypto.randomUUID().slice(0, 12)}`,
                    title: 'Bạn đã tìm thấy chi tiết được đánh dấu chưa?',
                    choices: [
                        { id: 'yes', text: 'Đã tìm thấy' },
                        { id: 'no', text: 'Chưa tìm thấy' },
                    ],
                    correctChoiceId: 'yes',
                },
                delayMsSchema,
            };
        case 'navigate':
            return { type, navigation: { target: 'next' }, delayMsSchema };
        case 'playAudio':
            return { type, assetId: '', volume: 1, loop: false, delayMsSchema };
        case 'stopAudio':
            return { type, delayMsSchema };
        case 'playAnimation':
            return { type, objectId: '', clip: '', loop: false, delayMsSchema };
        case 'setVisible':
            return { type, objectId: '', value: true, durationMs: 0, delayMsSchema };
        case 'toggleVisible':
            return { type, objectId: '', durationMs: 0, delayMsSchema };
        case 'playVideo':
            return { type, objectId: '', delayMsSchema };
        case 'openUrl':
            return { type, url: '', delayMsSchema };
        case 'wait':
            return { type, ms: 500 };
        case 'transformTo':
            return {
                type,
                objectId: '',
                position: [0, 0, 0],
                durationMs: 500,
                easing: 'easeInOut',
                delayMsSchema,
            };
    }
}
export function newRule(id: string): InteractionRule {
    return {
        id,
        name: 'Quy tắc mới',
        enabled: true,
        trigger: { type: 'onPageEnter' },
        actions: [newAction('wait')],
        onRetrigger: 'ignore',
    };
}
export function appendRule(rules: InteractionRule[], rule: InteractionRule) {
    if (rules.length >= SCENE_LIMITS.maxRules)
        throw new Error(`Mỗi trang tối đa ${SCENE_LIMITS.maxRules} quy tắc.`);
    if (rules.some((item) => item.id === rule.id)) throw new Error('Mã quy tắc đã tồn tại.');
    return [...rules, rule];
}
export function copyRule(rules: InteractionRule[], id: string, newId: string) {
    const rule = rules.find((item) => item.id === id);
    if (!rule) throw new Error('Không tìm thấy quy tắc.');
    const copied = structuredClone(rule);
    const questionIds = new Map(
        copied.actions.flatMap((action) =>
            action.type === 'askQuestion'
                ? [[action.question.questionId, `q-${crypto.randomUUID().slice(0, 12)}`] as const]
                : [],
        ),
    );
    copied.actions = copied.actions.map((action) =>
        action.type === 'askQuestion'
            ? {
                  ...action,
                  question: {
                      ...action.question,
                      questionId:
                          questionIds.get(action.question.questionId) || action.question.questionId,
                  },
              }
            : (action.type === 'condition' || action.type === 'waitUntil') &&
                action.test.type === 'answer'
              ? {
                    ...action,
                    test: {
                        ...action.test,
                        questionId:
                            questionIds.get(action.test.questionId) || action.test.questionId,
                    },
                }
              : action,
    );
    if (copied.trigger.type === 'onAnswer')
        copied.trigger = {
            ...copied.trigger,
            questionId: questionIds.get(copied.trigger.questionId) || copied.trigger.questionId,
        };
    return appendRule(rules, {
        ...copied,
        id: newId,
        name: `${rule.name || 'Quy tắc'} (bản sao)`.slice(0, 100),
    });
}
export function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
    const target = index + direction;
    if (index < 0 || index >= items.length || target < 0 || target >= items.length) return items;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
}
export function appendAction(actions: Action[], action: Action) {
    if (actions.length >= SCENE_LIMITS.maxActionsPerRule)
        throw new Error(`Mỗi quy tắc tối đa ${SCENE_LIMITS.maxActionsPerRule} hành động.`);
    return [...actions, action];
}
export function removeAction(actions: Action[], index: number) {
    if (index < 0 || index >= actions.length) return actions;
    if (actions.length === 1) throw new Error('Quy tắc cần ít nhất một hành động.');
    return actions.filter((_, i) => i !== index);
}

/** A copied question is a new prompt; references outside the copied step stay unchanged. */
export function copyStepAction<T extends Action>(action: T): T {
    const copy = structuredClone(action);
    if (copy.type === 'askQuestion')
        copy.question.questionId = `q-${crypto.randomUUID().slice(0, 12)}`;
    return copy;
}

export function defaultWorkflowTrigger(type: Trigger['type'], scene: Scene): Trigger {
    if (type === 'onTap' || type === 'onAnimationEnd')
        return { type, objectId: targetObjects(scene.objects, type)[0]?.id || '' };
    if (type === 'onAnswer')
        return {
            type,
            questionId:
                scene.interactions
                    .flatMap((rule) => rule.actions)
                    .find((action) => action.type === 'askQuestion')?.question.questionId || '',
            answer: 'any',
        };
    if (type === 'onStateCondition')
        return { type, test: { type: 'variable', key: 'score', operator: 'gte', value: 3 } };
    return { type };
}
