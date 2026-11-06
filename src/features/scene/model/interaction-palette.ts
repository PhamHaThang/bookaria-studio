import type { AssetRef } from '@/shared/contracts/asset.schema';
import type { Action, SceneObject } from '@/shared/contracts/scene.schema';
import { scopedAction } from './interaction-scope';
import { targetObjects } from './interactions';

export const TRIGGER_MIME = 'application/bookaria-trigger';
export const OBJECT_MIME = 'application/bookaria-object';
export const ACTION_MIME = 'application/bookaria-action';
export const actionPalette = [
    { id: 'condition', type: 'condition', label: 'Kiểm tra điều kiện', group: 'Điều kiện — Nếu' },
    {
        id: 'setState',
        type: 'setState',
        label: 'Ghi nhớ / thay đổi điểm',
        group: 'Ghi nhớ — State',
    },
    {
        id: 'askQuestion',
        type: 'askQuestion',
        label: 'Hiển thị câu hỏi',
        group: 'Hành động — Action',
    },
    {
        id: 'navigate',
        type: 'navigate',
        label: 'Chuyển trang / kết thúc',
        group: 'Điều hướng — Navigation',
    },
    { id: 'show', type: 'setVisible', label: 'Hiện đối tượng', group: 'Hành động — Action' },
    { id: 'hide', type: 'setVisible', label: 'Ẩn đối tượng', group: 'Hành động — Action' },
    {
        id: 'toggleVisible',
        type: 'toggleVisible',
        label: 'Bật / tắt đối tượng',
        group: 'Hành động — Action',
    },
    { id: 'playAudio', type: 'playAudio', label: 'Phát âm thanh', group: 'Hành động — Action' },
    { id: 'stopAudio', type: 'stopAudio', label: 'Dừng âm thanh', group: 'Hành động — Action' },
    { id: 'playVideo', type: 'playVideo', label: 'Phát video', group: 'Hành động — Action' },
    { id: 'move', type: 'transformTo', label: 'Di chuyển', group: 'Hành động — Action' },
    { id: 'rotate', type: 'transformTo', label: 'Xoay', group: 'Hành động — Action' },
    { id: 'scale', type: 'transformTo', label: 'Đổi kích thước', group: 'Hành động — Action' },
    {
        id: 'playAnimation',
        type: 'playAnimation',
        label: 'Chạy hoạt cảnh 3D',
        group: 'Hành động — Action',
    },
    { id: 'wait', type: 'wait', label: 'Chờ', group: 'Hành động — Action' },
    { id: 'openUrl', type: 'openUrl', label: 'Mở liên kết', group: 'Điều hướng — Navigation' },
    {
        id: 'controlModel',
        type: 'controlModel',
        label: 'Điều khiển mô hình',
        group: 'Hành động — Action',
    },
] as const;
export type PaletteId = (typeof actionPalette)[number]['id'];
export function isPaletteId(value: string): value is PaletteId {
    return actionPalette.some((item) => item.id === value);
}
export function paletteUnavailable(
    id: PaletteId,
    objects: SceneObject[],
    assets: Record<string, AssetRef>,
) {
    if (id === 'controlModel' && !objects.some((o) => o.type === 'model'))
        return 'Thêm mô hình 3D vào trang trước.';
    if (id === 'playVideo' && !objects.some((o) => o.type === 'video'))
        return 'Thêm video vào trang trước.';
    if (
        id === 'playAnimation' &&
        !objects.some((o) => o.type === 'model' && assets[o.assetId]?.meta.animations?.length)
    )
        return 'Cần mô hình có hoạt cảnh.';
    if (
        ['show', 'hide', 'toggleVisible', 'move', 'rotate', 'scale'].includes(id) &&
        !objects.length
    )
        return 'Thêm đối tượng vào trang trước.';
    return undefined;
}
export function assignActionObject(
    action: Action,
    object: SceneObject,
    assets: Record<string, AssetRef>,
): Action {
    if (
        action.type === 'condition' &&
        (action.test.type === 'visible' || action.test.type === 'interactionCount')
    )
        return { ...action, test: { ...action.test, objectId: object.id } };
    if ((action.type === 'playAudio' || action.type === 'stopAudio') && object.type === 'audio')
        return { ...action, assetId: object.assetId };
    if (!('objectId' in action) || !targetObjects([object], action.type).length)
        throw new Error(
            action.type === 'playAudio' || action.type === 'stopAudio'
                ? 'Kéo một đối tượng âm thanh vào đây.'
                : 'Đối tượng không phù hợp với bước này.',
        );
    if (action.type === 'playAnimation') {
        const clips = object.type === 'model' ? assets[object.assetId]?.meta.animations : undefined;
        if (!clips?.length) throw new Error('Mô hình này chưa có hoạt cảnh.');
        return { ...action, objectId: object.id, clip: clips[0] };
    }
    if (action.type === 'transformTo')
        return {
            ...action,
            objectId: object.id,
            ...(action.position ? { position: [...object.transform.position] } : {}),
            ...(action.rotation ? { rotation: [...object.transform.rotation] } : {}),
            ...(action.scale ? { scale: [...object.transform.scale] } : {}),
        };
    return { ...action, objectId: object.id };
}
export function paletteAction(
    id: PaletteId,
    object: SceneObject | undefined,
    objects: SceneObject[],
    assets: Record<string, AssetRef>,
): Action {
    const item = actionPalette.find((entry) => entry.id === id);
    if (!item) throw new Error('Không tìm thấy hành động.');
    let action = scopedAction(item.type, object);
    if (action.type === 'setVisible') action.value = id !== 'hide';
    if (action.type === 'transformTo') {
        delete action.position;
        if (id === 'move') action.position = [...(object?.transform.position || [0, 0, 0])];
        if (id === 'rotate') action.rotation = [...(object?.transform.rotation || [0, 0, 0])];
        if (id === 'scale') action.scale = [...(object?.transform.scale || [1, 1, 1])];
    }
    const target =
        object &&
        (action.type === 'playAudio' || action.type === 'stopAudio'
            ? object.type === 'audio'
            : 'objectId' in action && targetObjects([object], action.type).length)
            ? object
            : objects.find((o) =>
                  action.type === 'playAudio' || action.type === 'stopAudio'
                      ? o.type === 'audio'
                      : 'objectId' in action &&
                        targetObjects([o], action.type).length &&
                        (action.type !== 'playAnimation' ||
                            (o.type === 'model' && assets[o.assetId]?.meta.animations?.length)),
              );
    if (target && ('objectId' in action || action.type === 'playAudio'))
        action = assignActionObject(action, target, assets);
    return action;
}
export function actionTitle(action: Action) {
    if (action.type === 'controlModel')
        return { enable: 'Bật điều khiển', disable: 'Tắt điều khiển', reset: 'Đặt lại vị trí' }[
            action.operation
        ];
    if (action.type === 'setVisible') return action.value ? 'Hiện đối tượng' : 'Ẩn đối tượng';
    if (action.type === 'transformTo')
        return (
            [
                action.position && 'Di chuyển',
                action.rotation && 'Xoay',
                action.scale && 'Đổi kích thước',
            ]
                .filter(Boolean)
                .join(' + ') || 'Chuyển động'
        );
    return actionPalette.find((entry) => entry.type === action.type)?.label || 'Hành động';
}
