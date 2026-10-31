import type { PerspectiveCamera } from 'three';

export type PreviewViewport = { left: number; top: number; width: number; height: number };
export type PreviewInsets = { left: number; top: number; right: number; bottom: number };

/** Retain the editor's optical centre when authoring chrome leaves the viewport. */
export function previewInsets(
    source: PreviewViewport | undefined,
    target: PreviewViewport,
): PreviewInsets | undefined {
    if (
        !source ||
        ![...Object.values(source), ...Object.values(target)].every(Number.isFinite) ||
        source.width <= 0 ||
        source.height <= 0 ||
        target.width <= 0 ||
        target.height <= 0
    )
        return;
    return {
        left: source.left - target.left,
        top: source.top - target.top,
        right: target.left + target.width - source.left - source.width,
        bottom: target.top + target.height - source.top - source.height,
    };
}

export function framePreviewViewport(
    camera: PerspectiveCamera,
    target: PreviewViewport,
    insets?: PreviewInsets,
): PreviewViewport {
    const view = insets
        ? {
              left: target.left + insets.left,
              top: target.top + insets.top,
              width: target.width - insets.left - insets.right,
              height: target.height - insets.top - insets.bottom,
          }
        : target;
    if (!Object.values(target).every(Number.isFinite) || target.width <= 0 || target.height <= 0)
        return target;
    if (view.width <= 0 || view.height <= 0 || !Object.values(view).every(Number.isFinite))
        return framePreviewViewport(camera, target);
    camera.aspect = view.width / view.height;
    camera.setViewOffset(
        view.width,
        view.height,
        target.left - view.left,
        target.top - view.top,
        target.width,
        target.height,
    );
    return view;
}
