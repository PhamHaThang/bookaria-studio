import type { SceneObject } from '@/shared/contracts/scene.schema';
import { sceneObjectLabel } from './object-list';

export function objectInspectorMeta(object: SceneObject) {
    const label = sceneObjectLabel(object);
    const contentTitle =
        object.type === 'audio'
            ? 'Phát âm thanh'
            : object.type === 'video'
              ? 'Phát video'
              : object.type === 'hotspot'
                ? 'Vùng chạm'
                : label;
    return {
        label,
        title: `Thuộc tính ${label.charAt(0).toLocaleLowerCase('vi')}${label.slice(1)}`,
        contentTitle,
        defaultSections: object.type === 'model' ? ['identity'] : ['content'],
    };
}
