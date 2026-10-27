import type { SceneObject } from '../../../shared/contracts/scene.schema';

export type AnnotationObject = Extract<SceneObject, { type: 'label' }>;
export type AnnotationPlacement = {
    position: SceneObject['transform']['position'];
    rotation: SceneObject['transform']['rotation'];
};

/** Store the surface anchor as the root so camera-facing content cannot move its marker. */
export function placeAnnotation(
    object: AnnotationObject,
    placement: AnnotationPlacement,
): AnnotationObject {
    if (object.presentation?.kind !== 'annotation')
        throw new Error('Đối tượng không phải chú thích.');
    return {
        ...object,
        snapToPaper: false,
        presentation: { ...object.presentation, anchorAtTarget: true },
        transform: {
            ...object.transform,
            position: [...placement.position],
            rotation: [...placement.rotation],
        },
    };
}
