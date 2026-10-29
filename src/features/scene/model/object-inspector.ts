import type { SceneObject } from '@/shared/contracts/scene.schema';
import { sceneObjectLabel } from './object-list';

export function objectInspectorMeta(object: SceneObject) {
    const label = sceneObjectLabel(object);
    const title = `Thuộc tính ${label.charAt(0).toLocaleLowerCase('vi')}${label.slice(1)}`;
    return {
        label,
        title,
        contentTitle: title,
        defaultSections: object.type === 'model' ? ['identity'] : ['content'],
    };
}
