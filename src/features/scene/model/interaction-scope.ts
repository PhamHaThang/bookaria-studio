import type {
    Action,
    ActionType,
    InteractionRule,
    SceneObject,
} from '@/shared/contracts/scene.schema';
import { newAction, newRule, targetObjects, triggerLabels } from './interactions';
import { objectLabels } from './objects';

export type InteractionScope =
    | { type: 'all' }
    | { type: 'page' }
    | { type: 'object'; objectId: string };

export function rulesInScope(rules: InteractionRule[], scope: InteractionScope) {
    return rules.filter(
        (rule) =>
            scope.type === 'all' ||
            (scope.type === 'page'
                ? rule.trigger.type !== 'onTap'
                : rule.trigger.type === 'onTap' && rule.trigger.objectId === scope.objectId),
    );
}

export function scopedRule(id: string, scope: InteractionScope, objects: SceneObject[]) {
    const rule = newRule(id);
    if (scope.type !== 'object') return rule;
    const object = targetObjects(objects, 'onTap').find((item) => item.id === scope.objectId);
    if (!object) throw new Error('Chọn đối tượng có thể chạm để thêm tương tác.');
    return {
        ...rule,
        name: `Chạm ${object.name || objectLabels[object.type]}`.slice(0, 100),
        trigger: { type: 'onTap' as const, objectId: object.id },
    };
}

export function scopedAction(type: ActionType, object?: SceneObject): Action {
    const action = newAction(type);
    if (!object || !('objectId' in action) || !targetObjects([object], type).length) return action;
    return {
        ...action,
        objectId: object.id,
        ...(action.type === 'transformTo'
            ? { position: [...object.transform.position] as [number, number, number] }
            : {}),
    };
}

/** Reorder within a filtered list while keeping unrelated rule slots unchanged. */
export function moveScopedRule(
    rules: InteractionRule[],
    scope: InteractionScope,
    id: string,
    direction: -1 | 1,
) {
    const visible = rulesInScope(rules, scope),
        index = visible.findIndex((rule) => rule.id === id),
        other = visible[index + direction];
    if (index < 0 || !other) return rules;
    const a = rules.findIndex((rule) => rule.id === id),
        b = rules.findIndex((rule) => rule.id === other.id),
        next = [...rules];
    [next[a], next[b]] = [next[b], next[a]];
    return next;
}

export function ruleTriggerLabel(rule: InteractionRule, objects: SceneObject[]) {
    if (rule.trigger.type !== 'onTap') return triggerLabels[rule.trigger.type];
    const id = rule.trigger.objectId,
        object = objects.find((item) => item.id === id);
    return `Khi chạm ${object ? object.name || objectLabels[object.type] : id ? 'đối tượng đã xóa' : 'đối tượng chưa chọn'}`;
}
