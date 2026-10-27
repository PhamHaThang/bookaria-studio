import type { SceneObject } from '@/shared/contracts/scene.schema';
import { objectLabels } from './objects';

export function sceneObjectLabel(object: SceneObject) {
    if (object.type === 'text' || object.type === 'label') {
        const kind = object.presentation?.kind;
        if (kind === 'screen') return 'Thẻ thông tin';
        if (kind === 'bubble') return 'Bong bóng';
        if (kind === 'annotation') return 'Chú thích';
        if (kind === 'extruded') return 'Văn bản 3D';
    }
    return objectLabels[object.type];
}
const searchable = (value: string) =>
    value
        .trim()
        .toLocaleLowerCase('vi')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replaceAll('đ', 'd');
export function findSceneObjects(objects: SceneObject[], query: string) {
    const term = searchable(query);
    return term
        ? objects.filter((object) =>
              searchable(
                  `${object.name || ''} ${sceneObjectLabel(object)} ${object.type === 'audio' ? object.audioKind || 'BGM' : ''}`,
              ).includes(term),
          )
        : objects;
}
export function objectListSelection(objects: SceneObject[], selectedIds: string[]) {
    const ids = objects
        .filter((object) => !object.locked && !object.editorHidden)
        .map((object) => object.id);
    const selected = new Set(selectedIds);
    const count = ids.filter((id) => selected.has(id)).length;
    return {
        ids,
        checked:
            ids.length > 0 && count === ids.length
                ? true
                : count > 0
                  ? ('indeterminate' as const)
                  : false,
    };
}
export function toggleObjectListSelection(
    selectedIds: string[],
    eligibleIds: string[],
    checked: boolean,
) {
    const eligible = new Set(eligibleIds);
    return checked
        ? [...new Set([...selectedIds, ...eligibleIds])]
        : selectedIds.filter((id) => !eligible.has(id));
}
