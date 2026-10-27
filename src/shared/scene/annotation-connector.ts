import type { TextPresentation } from '../contracts/scene.schema';

type Annotation = Extract<TextPresentation, { kind: 'annotation' }>;
export type AnnotationConnectorSide = NonNullable<Annotation['connectorSide']>;

/** Infer a stable edge for legacy callouts from their original target, never their dragged offset. */
export function annotationConnectorSide(
    annotation: Pick<Annotation, 'connectorSide'>,
    target: [number, number, number],
): AnnotationConnectorSide {
    if (annotation.connectorSide) return annotation.connectorSide;
    if (Math.abs(target[0]) > 1e-6) return target[0] < 0 ? 'left' : 'right';
    if (Math.abs(target[1]) > 1e-6) return target[1] < 0 ? 'bottom' : 'top';
    return 'left';
}
