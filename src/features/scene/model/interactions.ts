import type {
    Action,
    ActionType,
    InteractionRule,
    SceneObject,
    Trigger,
} from '../../../shared/contracts/scene.schema';
import { SCENE_LIMITS } from '../../../shared/contracts/scene.schema';

export const triggerLabels: Record<Trigger['type'], string> = {
    onPageEnter: 'Khi vào trang',
    onPageLeave: 'Khi rời trang',
    onTap: 'Khi chạm đối tượng',
};
export const actionLabels: Record<ActionType, string> = {
    playAudio: 'Phát âm thanh',
    stopAudio: 'Dừng âm thanh',
    playAnimation: 'Chạy animation',
    setVisible: 'Đặt trạng thái hiển thị',
    toggleVisible: 'Đảo trạng thái hiển thị',
    playVideo: 'Phát video',
    openUrl: 'Mở liên kết',
    wait: 'Chờ',
    transformTo: 'Di chuyển, xoay, đổi tỉ lệ',
};
export function targetObjects(objects: SceneObject[], type: Trigger['type'] | ActionType) {
    return objects.filter((object) =>
        type === 'onTap'
            ? object.type !== 'audio'
            : type === 'playAnimation'
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
    return appendRule(rules, {
        ...structuredClone(rule),
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
