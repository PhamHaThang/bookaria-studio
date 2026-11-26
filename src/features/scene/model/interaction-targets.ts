import type { AssetRef } from '@/shared/contracts/asset.schema';
import type { BookDetail } from '@/shared/contracts/dto.schema';
import type { Action, Scene, SceneObject, Trigger } from '@/shared/contracts/scene.schema';
import { objectName } from './interaction-templates';
import { targetObjects } from './interactions';

type TargetOption = { value: string; label: string; disabled?: boolean };
export type WorkflowTargetChoices = { label: string; value: string; options: TargetOption[] };
/** Keep the node and inspector audio choices consistent; empty playback is guidance, never a target. */
export function audioActionChoices(
    action: Extract<Action, { type: 'playAudio' | 'stopAudio' }>,
    objects: SceneObject[],
    assets: Record<string, AssetRef>,
    selectedName?: string,
): { value: string; options: TargetOption[] } {
    const sources = objects.filter((object) => object.type === 'audio');
    const unique = sources.filter(
        (object, index) => sources.findIndex((item) => item.assetId === object.assetId) === index,
    );
    const options: TargetOption[] = unique.map((object) => ({
        value: object.assetId,
        label: objectName(object),
    }));
    if (action.type === 'stopAudio')
        options.unshift({ value: 'all-audio', label: 'Toàn bộ âm thanh của trang' });
    if (action.assetId === '' || (action.type === 'playAudio' && !action.assetId))
        options.unshift({ value: '', label: 'Chọn âm thanh trên trang', disabled: true });
    if (action.assetId && !unique.some((object) => object.assetId === action.assetId))
        options.push({
            value: action.assetId,
            label: selectedName || 'Tệp âm thanh đang chọn',
            disabled: !assets[action.assetId] && !selectedName,
        });
    return {
        value:
            action.type === 'stopAudio' && action.assetId === undefined
                ? 'all-audio'
                : action.assetId || '',
        options,
    };
}
/** Target choices use references to the existing scene, never copies of its objects. */
export function workflowTargetChoices(
    action: Action | undefined,
    trigger: Trigger,
    scene: Scene,
    assets: Record<string, AssetRef>,
    pages: BookDetail['pages'] = [],
): WorkflowTargetChoices | null {
    if (action?.type === 'navigate') {
        if (action.navigation.target !== 'page') return null;
        return complete({
            label: 'Trang đích',
            value: action.navigation.pageId ? `page:${action.navigation.pageId}` : '',
            options: pages.map((page) => ({
                value: `page:${page.id}`,
                label: page.title || `Trang ${page.orderIndex + 1}`,
            })),
        });
    }
    if (action?.type === 'playAudio' || action?.type === 'stopAudio') {
        const choices = audioActionChoices(action, scene.objects, assets);
        const reference = (assetId: string) => {
            if (assetId === 'all-audio') return assetId;
            const object = scene.objects.find(
                (item) => item.type === 'audio' && item.assetId === assetId,
            );
            return assetId ? (object ? `object:${object.id}` : `asset:${assetId}`) : '';
        };
        const value = reference(choices.value);
        const options = choices.options.map((option) => ({
            ...option,
            value: reference(option.value),
        }));
        return complete({ label: 'Âm thanh', value, options });
    }
    const conditionObject =
        (action?.type === 'condition' || action?.type === 'waitUntil') && 'objectId' in action.test
            ? action.test.objectId
            : undefined;
    if (action && !('objectId' in action) && conditionObject === undefined) return null;
    if (!action && (trigger.type === 'onAnswer' || trigger.type === 'onStateCondition'))
        return null;
    const type = action ? action.type : trigger.type === 'onAnimationEnd' ? trigger.type : 'onTap';
    const candidates = targetObjects(scene.objects, type);
    const options: TargetOption[] = candidates.map((object) => ({
        value: `object:${object.id}`,
        label: objectName(object),
        disabled:
            (type === 'playAnimation' || type === 'onAnimationEnd') &&
            (object.type !== 'model' || !assets[object.assetId]?.meta.animations?.length),
    }));
    const objectId = action
        ? 'objectId' in action
            ? action.objectId
            : conditionObject
        : 'objectId' in trigger
          ? trigger.objectId
          : undefined;
    if (!action) options.unshift({ value: 'page', label: 'Trang hiện tại (scene)' });
    return complete({
        label: action ? 'Đối tượng' : 'Phạm vi',
        value: objectId ? `object:${objectId}` : !action && !('objectId' in trigger) ? 'page' : '',
        options,
    });
}
function complete(choices: WorkflowTargetChoices): WorkflowTargetChoices {
    if (!choices.value && !choices.options.some((option) => option.value === ''))
        choices.options.unshift({ value: '', label: 'Chọn mục tiêu…', disabled: true });
    else if (!choices.options.some((option) => option.value === choices.value))
        choices.options.unshift({
            value: choices.value,
            label: 'Mục tiêu đã xóa — chọn lại',
            disabled: true,
        });
    return choices;
}
