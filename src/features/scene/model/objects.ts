import { audioKindFromTags } from '@/shared/scene/audio-kind';
import type { Asset } from '../../../shared/contracts/dto.schema';
import {
    type PageSettings,
    SCENE_LIMITS,
    type Scene,
    type SceneObject,
    SceneObjectSchema,
    type SceneObjectType,
    SceneSchema,
} from '../../../shared/contracts/scene.schema';

export const objectLabels: Record<SceneObjectType, string> = {
    model: 'Mô hình 3D',
    image: 'Hình ảnh',
    text: 'Văn bản',
    video: 'Video',
    audio: 'Âm thanh',
    hotspot: 'Vùng chạm',
    label: 'Chú thích',
};
export const objectAssetTypes = {
    model: 'MODEL',
    image: 'IMAGE',
    video: 'VIDEO',
    audio: 'AUDIO',
} as const;
export type AssetObjectType = keyof typeof objectAssetTypes;
export function usesAsset(type: SceneObjectType): type is AssetObjectType {
    return type in objectAssetTypes;
}
export function newObject(type: SceneObjectType, id: string, asset?: Asset): SceneObject {
    if (
        usesAsset(type) &&
        (!asset || asset.type !== objectAssetTypes[type] || asset.status !== 'READY')
    )
        throw new Error('Chọn đúng loại tài nguyên đã sẵn sàng.');
    return SceneObjectSchema.parse({
        id,
        type,
        name: usesAsset(type) ? asset?.name : objectLabels[type],
        transform: {
            position: [0, 0, 0],
            rotation: type === 'model' ? [90, 0, 0] : [0, 0, 0],
            scale: [1, 1, 1],
        },
        ...(usesAsset(type) ? { assetId: asset?.id } : {}),
        ...(type === 'audio'
            ? { billboard: true, autoplay: false, audioKind: audioKindFromTags(asset?.tags) }
            : {}),
        ...(type === 'text' || type === 'label'
            ? { text: type === 'text' ? 'Văn bản mới' : 'Chú thích mới' }
            : {}),
    });
}
export function addObject(scene: Scene, object: SceneObject): Scene {
    if (scene.objects.length >= SCENE_LIMITS.hardMaxObjects)
        throw new Error(`Mỗi trang tối đa ${SCENE_LIMITS.hardMaxObjects} đối tượng.`);
    if (scene.objects.some((item) => item.id === object.id))
        throw new Error('Mã đối tượng đã tồn tại.');
    return { ...scene, objects: [...scene.objects, object] };
}
export function duplicateObject(scene: Scene, id: string, newId: string): Scene {
    const object = scene.objects.find((item) => item.id === id);
    if (!object || object.locked) throw new Error('Mở khóa đối tượng trước khi nhân bản.');
    return addObject(scene, {
        ...structuredClone(object),
        id: newId,
        name: `${object.name || objectLabels[object.type]} (bản sao)`.slice(0, 100),
    });
}
export function removeObject(scene: Scene, id: string): Scene {
    if (scene.objects.find((item) => item.id === id)?.locked)
        throw new Error('Mở khóa đối tượng trước khi xóa.');
    // References intentionally remain: the backend reports dangling interaction rules.
    return { ...scene, objects: scene.objects.filter((item) => item.id !== id) };
}
export function moveObject(scene: Scene, id: string, direction: -1 | 1): Scene {
    const index = scene.objects.findIndex((item) => item.id === id),
        target = index + direction;
    if (index < 0 || target < 0 || target >= scene.objects.length || scene.objects[index].locked)
        return scene;
    const objects = [...scene.objects];
    [objects[index], objects[target]] = [objects[target], objects[index]];
    return { ...scene, objects };
}
export function replaceObjectAsset(object: SceneObject, asset: Asset): SceneObject {
    if (
        !('assetId' in object) ||
        !usesAsset(object.type) ||
        asset.status !== 'READY' ||
        objectAssetTypes[object.type] !== asset.type
    )
        throw new Error('Tài nguyên không đúng loại hoặc chưa sẵn sàng.');
    if (object.locked) throw new Error('Mở khóa đối tượng trước khi đổi tài nguyên.');
    return {
        ...object,
        assetId: asset.id,
        ...(object.type === 'model' ? { animation: undefined } : {}),
        ...(object.type === 'audio' ? { audioKind: audioKindFromTags(asset.tags) } : {}),
    };
}
export function sceneFingerprint(scene: Scene) {
    return JSON.stringify(scene);
}
export function validatedScene(scene: Scene) {
    return SceneSchema.parse(scene);
}
export function settingsPatch(before: PageSettings, after: PageSettings): Partial<PageSettings> {
    return Object.fromEntries(
        Object.entries(after).filter(([key, value]) => before[key as keyof PageSettings] !== value),
    );
}
export function previewPosition(object: SceneObject, aspect: number) {
    const [x, y] = object.transform.position;
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(aspect) || aspect <= 0)
        return null;
    const left = (x + 0.5) * 100,
        top = (0.5 - y / aspect) * 100;
    return left >= 0 && left <= 100 && top >= 0 && top <= 100 ? { left, top } : null;
}
