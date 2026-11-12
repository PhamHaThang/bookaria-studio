import type { AssetRef } from '@/shared/contracts/asset.schema';
import type { Action, SceneObject, Trigger } from '@/shared/contracts/scene.schema';
import { assignActionObject } from './interaction-palette';

export function stepReferencesObject(
    action: Action | undefined,
    trigger: Trigger,
    object?: SceneObject,
) {
    if (!object) return false;
    if (!action) return 'objectId' in trigger && trigger.objectId === object.id;
    if ('objectId' in action) return action.objectId === object.id;
    if ((action.type === 'condition' || action.type === 'waitUntil') && 'objectId' in action.test)
        return action.test.objectId === object.id;
    if (object.type === 'audio' && (action.type === 'playAudio' || action.type === 'stopAudio'))
        return !action.assetId || action.assetId === object.assetId;
    return false;
}
export function canAssignStepObject(
    action: Action | undefined,
    object: SceneObject,
    assets: Record<string, AssetRef>,
) {
    if (!action) return object.type !== 'audio';
    try {
        assignActionObject(action, object, assets);
        return true;
    } catch {
        return false;
    }
}
