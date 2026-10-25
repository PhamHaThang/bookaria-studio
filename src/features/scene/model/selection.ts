import type { Scene, SceneObject } from '../../../shared/contracts/scene.schema';
import { SCENE_LIMITS } from '../../../shared/contracts/scene.schema';
import { objectLabels } from './objects';

export type SelectionMode = 'replace' | 'add' | 'toggle';

export function updateSelection(current: string[], ids: string[], mode: SelectionMode): string[] {
    const unique = [...new Set(ids)];
    if (mode === 'replace') return unique;
    const next = new Set(current);
    for (const id of unique) {
        if (mode === 'toggle' && next.has(id)) next.delete(id);
        else next.add(id);
    }
    return [...next];
}

function members(scene: Scene, ids: string[]) {
    const wanted = new Set(ids);
    const selected = scene.objects.filter((object) => wanted.has(object.id));
    if (selected.length !== wanted.size) throw new Error('Một đối tượng đã không còn trong trang.');
    return selected;
}

export function assertUnlocked(objects: SceneObject[]) {
    if (objects.some((object) => object.locked))
        throw new Error('Mở khóa tất cả đối tượng đã chọn trước khi thực hiện thao tác này.');
}

export function removeSelection(scene: Scene, ids: string[]): Scene {
    const selected = members(scene, ids);
    assertUnlocked(selected);
    const wanted = new Set(ids);
    // Retain interaction rules, as for single-object deletion; reference warnings remain visible.
    return { ...scene, objects: scene.objects.filter((object) => !wanted.has(object.id)) };
}

export function setSelectionFlag(
    scene: Scene,
    ids: string[],
    flag: 'locked' | 'editorHidden',
    value: boolean,
): Scene {
    const selected = members(scene, ids);
    if (flag !== 'locked') assertUnlocked(selected);
    const wanted = new Set(ids);
    return {
        ...scene,
        objects: scene.objects.map((object) =>
            wanted.has(object.id) ? { ...object, [flag]: value } : object,
        ),
    };
}

export function duplicateSelection(scene: Scene, ids: string[], newId: () => string) {
    const selected = members(scene, ids);
    assertUnlocked(selected);
    if (scene.objects.length + selected.length > SCENE_LIMITS.hardMaxObjects)
        throw new Error(
            `Không đủ chỗ để nhân bản cả nhóm. Mỗi trang tối đa ${SCENE_LIMITS.hardMaxObjects} đối tượng.`,
        );
    const used = new Set(scene.objects.map((object) => object.id));
    const groups = new Map<string, string>();
    const copies = selected.map((object) => {
        const id = newId();
        if (used.has(id)) throw new Error('Mã đối tượng đã tồn tại.');
        used.add(id);
        if (object.groupId && !groups.has(object.groupId)) groups.set(object.groupId, newId());
        return {
            ...structuredClone(object),
            id,
            name: `${object.name || objectLabels[object.type]} (bản sao)`.slice(0, 100),
            ...(object.groupId ? { groupId: groups.get(object.groupId) } : {}),
        };
    });
    return {
        scene: { ...scene, objects: [...scene.objects, ...copies] },
        ids: copies.map((object) => object.id),
    };
}
