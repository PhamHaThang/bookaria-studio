import type { SceneObject } from '@/shared/contracts/scene.schema';
import { isHexColor } from '@/shared/lib/color-change-session';
import type { TextVisualColors } from '@/shared/scene/text-renderer';

export function textVisualColors(
    spec: Extract<SceneObject, { type: 'text' | 'label' }>,
): TextVisualColors {
    const presentation = spec.presentation;
    return {
        color: isHexColor(spec.style.color) ? spec.style.color : '#252525',
        background:
            presentation && 'background' in presentation ? presentation.background : undefined,
        buttonBackground:
            presentation?.kind === 'screen' ? presentation.buttonBackground : undefined,
        border: presentation && 'border' in presentation ? presentation.border : undefined,
        descriptionColor:
            presentation?.kind === 'annotation' ? presentation.descriptionColor : undefined,
        descriptionBackground:
            presentation?.kind === 'annotation' ? presentation.descriptionBackground : undefined,
    };
}
