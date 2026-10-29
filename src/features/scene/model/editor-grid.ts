import { type Color, GridHelper, type LineBasicMaterial } from 'three';

export type EditorGridSettings = {
    visible: boolean;
    spacingMm: number;
    opacity: number;
};

export const DEFAULT_EDITOR_GRID: EditorGridSettings = {
    visible: true,
    spacingMm: 20,
    opacity: 1,
};

/** Even divisions keep a grid line at the page origin and preserve the exact physical cell size. */
export function editorGridLayout(widthMm: number, aspect: number, spacingMm: number) {
    if (
        !Number.isFinite(widthMm) ||
        widthMm < 0.1 ||
        widthMm > 1000 ||
        !Number.isFinite(aspect) ||
        aspect <= 0 ||
        aspect > 5 ||
        !Number.isFinite(spacingMm) ||
        spacingMm < 1 ||
        spacingMm > 1000
    )
        throw new RangeError('Kích thước lưới không hợp lệ.');
    const cell = spacingMm / widthMm;
    const divisions = Math.max(2, 2 * Math.ceil(Math.max(4, aspect + 1) / (cell * 2)));
    return { cell, divisions, size: divisions * cell };
}

export function createEditorGrid(
    widthMm: number,
    aspect: number,
    initial: EditorGridSettings,
    colors: { center: Color; line: Color },
) {
    const first = editorGridLayout(widthMm, aspect, initial.spacingMm);
    const grid = new GridHelper(first.size, first.divisions, colors.center, colors.line);
    grid.name = 'editor-grid';
    grid.rotation.x = Math.PI / 2;
    grid.position.z = -0.008;
    const material = grid.material as LineBasicMaterial;
    material.transparent = true;
    material.depthWrite = false;
    let layout = first;
    let disposed = false;
    function update(settings: EditorGridSettings, pageWidthMm: number, pageAspect: number) {
        if (disposed) return;
        const next = editorGridLayout(pageWidthMm, pageAspect, settings.spacingMm);
        if (next.cell !== layout.cell || next.divisions !== layout.divisions) {
            const replacement = new GridHelper(
                next.size,
                next.divisions,
                colors.center,
                colors.line,
            );
            grid.geometry.dispose();
            grid.geometry = replacement.geometry;
            (replacement.material as LineBasicMaterial).dispose();
            layout = next;
        }
        grid.visible = settings.visible;
        material.opacity = settings.opacity;
    }
    update(initial, widthMm, aspect);
    return {
        grid,
        update,
        dispose() {
            if (disposed) return;
            disposed = true;
            grid.geometry.dispose();
            material.dispose();
        },
    };
}
