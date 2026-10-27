import * as THREE from 'three';
import type { SceneObject, ScreenBorder } from '../contracts/scene.schema';
import type { AnnotationConnectorSide } from './annotation-connector';
import { createAnnotationText } from './annotation-text';
import { createBubbleText } from './bubble-text';
import { drawScreenText } from './screen-text';
import { paintedTextBounds } from './text-bounds';
import { textGeometry } from './text-geometry';

type Textual = Extract<SceneObject, { type: 'text' | 'label' }>;
export type TextVisualColors = {
    color: string;
    background?: string;
    buttonBackground?: string;
    descriptionColor?: string;
    descriptionBackground?: string;
    border?: ScreenBorder;
};
type TextVisual = {
    group: THREE.Group;
    updateColors?: (colors: TextVisualColors) => void;
    setPointerPosition?: (position: number) => void;
    setExpanded?: (expanded: boolean) => boolean;
    setAnnotationOffset?: (offset: [number, number]) => void;
    setAnnotationConnectorSide?: (side: AnnotationConnectorSide) => void;
    toggleDescription?: () => boolean;
    next?: () => void;
    setPage?: (page: number) => number;
    tap?: (uv?: { x: number; y: number }) => number;
};
function linesOf(text: string, ctx: CanvasRenderingContext2D, width: number) {
    const result: string[] = [];
    for (const paragraph of text.split(/\r?\n/)) {
        let line = '';
        for (const word of paragraph.split(/\s+/).filter(Boolean)) {
            const next = line ? `${line} ${word}` : word;
            if (line && ctx.measureText(next).width > width) {
                result.push(line);
                line = word;
            } else line = next;
        }
        result.push(line);
    }
    return result;
}
export function disposeTextVisual(root: THREE.Object3D) {
    const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>(),
        textures = new Set<THREE.Texture>();
    root.traverse((object) => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.Line)) return;
        geometries.add(object.geometry);
        for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material]) {
            materials.add(material);
            for (const value of Object.values(material))
                if (value instanceof THREE.Texture) textures.add(value);
        }
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
}
/** Returns an independently owned, bounded-size canvas. */
export async function loadTextImage(url: string, signal?: AbortSignal) {
    const response = await fetch(url, { signal: signal });
    if (!response.ok) throw new Error('Chưa tải được ảnh của thẻ thông tin.');
    const bitmap = await createImageBitmap(await response.blob());
    try {
        signal?.throwIfAborted();
        const scale = Math.min(1, 1024 / bitmap.width, 640 / bitmap.height);
        const image = document.createElement('canvas');
        image.width = Math.max(1, Math.ceil(bitmap.width * scale));
        image.height = Math.max(1, Math.ceil(bitmap.height * scale));
        const context = image.getContext('2d');
        if (!context) throw new Error('Không tạo được ảnh xem trước.');
        context.drawImage(bitmap, 0, 0, image.width, image.height);
        return image;
    } finally {
        bitmap.close();
    }
}
export async function createTextVisual(
    spec: Textual,
    options: {
        imageUrl?: string;
        page?: number;
        expanded?: boolean;
        signal?: AbortSignal;
        loadImage?: typeof loadTextImage;
    } = {},
): Promise<TextVisual> {
    const group = new THREE.Group();
    const content = spec.text.normalize('NFC');
    const presentation = spec.presentation;
    const family =
        spec.style.font === 'serif' ? '"Noto Serif", serif' : '"Be Vietnam Pro", sans-serif';
    let palette: TextVisualColors = {
        color: spec.style.color,
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
    if (presentation?.kind === 'extruded') {
        const geometry = await textGeometry(content, spec.style.bold, options.signal);
        const mesh = new THREE.Mesh(
            geometry,
            new THREE.MeshStandardMaterial({
                color: palette.color,
                roughness: 0.65,
                metalness: 0.05,
            }),
        );
        mesh.scale.set(spec.style.size, spec.style.size, presentation.depth);
        group.add(mesh);
        return {
            group,
            updateColors: (colors) => {
                mesh.material.color.set(colors.color);
            },
        };
    }
    await document.fonts.ready;
    options.signal?.throwIfAborted();
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = presentation?.kind === 'screen' ? 768 : 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Không vẽ được văn bản.');
    const weights = new Set(
        presentation?.kind === 'screen'
            ? [
                  presentation.titleStyle?.weight ?? 600,
                  presentation.bodyStyle?.weight ?? (spec.style.bold ? 700 : 400),
                  presentation.buttonStyle?.weight ?? 600,
              ]
            : presentation?.kind === 'bubble'
              ? [700, spec.style.bold ? 700 : 400]
              : presentation?.kind === 'annotation' && presentation.description.trim()
                ? [400, spec.style.bold ? 700 : 400]
                : [spec.style.bold ? 700 : 400],
    );
    // FontFaceSet defaults to a space; pass the content to load Vietnamese subsets before painting.
    const fontContent = [
        content,
        presentation && 'title' in presentation ? presentation.title : '',
        presentation?.kind === 'screen' ? presentation.buttonLabel : '',
        presentation?.kind === 'annotation' ? presentation.description.normalize('NFC') : '',
    ].join(' ');
    await Promise.all(
        [...weights].map((weight) => document.fonts.load(`${weight} 32px ${family}`, fontContent)),
    );
    options.signal?.throwIfAborted();
    if (presentation?.kind === 'annotation') {
        return createAnnotationText(
            canvas,
            ctx,
            presentation,
            content,
            palette.color,
            family,
            spec.style.bold,
            spec.style.size,
            spec.type === 'label' ? spec.target : [-0.3, 0, 0],
            options.expanded,
        );
    }
    let image: HTMLCanvasElement | undefined;
    if (presentation?.kind === 'screen' && options.imageUrl) {
        image = await (options.loadImage ?? loadTextImage)(options.imageUrl, options.signal);
    }
    if (options.signal?.aborted) {
        if (image) {
            image.width = 1;
            image.height = 1;
        }
        options.signal.throwIfAborted();
    }
    if (presentation?.kind === 'bubble') {
        const bubble = createBubbleText(
            canvas,
            ctx,
            presentation,
            content,
            palette.color,
            family,
            spec.style.bold,
            options.page,
        );
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        const width = spec.style.size * 16;
        group.add(
            new THREE.Mesh(
                new THREE.PlaneGeometry(width, (width * canvas.height) / canvas.width),
                new THREE.MeshBasicMaterial({
                    map: texture,
                    transparent: true,
                    side: THREE.DoubleSide,
                }),
            ),
        );
        const update = (page: number) => {
            texture.needsUpdate = true;
            return page;
        };
        return {
            group,
            next: () => {
                update(bubble.next());
            },
            setPage: (page) => update(bubble.setPage(page)),
            setPointerPosition: (position) => {
                bubble.setPointerPosition(position);
                texture.needsUpdate = true;
            },
            tap: (uv) => update(bubble.tap(uv)),
            updateColors: (colors) => {
                palette = colors;
                bubble.setColors(
                    colors.color,
                    colors.background ?? presentation.background,
                    colors.border,
                );
                texture.needsUpdate = true;
            },
        };
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    if (image)
        texture.addEventListener('dispose', () => {
            if (image) {
                image.width = 1;
                image.height = 1;
                image = undefined;
            }
        });
    const setFont = (size: number, bold = spec.style.bold) => {
        ctx.font = `${bold ? 700 : 400} ${size}px ${family}`;
    };
    const draw = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (presentation?.kind === 'screen') {
            drawScreenText(
                canvas,
                ctx,
                {
                    ...presentation,
                    background: palette.background ?? presentation.background,
                    buttonBackground: palette.buttonBackground,
                    border: palette.border,
                },
                content,
                palette.color,
                family,
                spec.style.bold,
                image,
            );
        } else {
            setFont(64);
            const lines = linesOf(content, ctx, 980);
            const height = Math.min(84, 470 / Math.max(lines.length, 1));
            if (height < 64) setFont(Math.max(1, height * 0.8));
            ctx.fillStyle = palette.color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            lines.forEach((line, index) => {
                ctx.fillText(line, 512, 256 + (index - (lines.length - 1) / 2) * height, 980);
            });
        }
        texture.needsUpdate = true;
    };
    try {
        draw();
    } catch (error) {
        texture.dispose();
        throw error;
    }
    const mat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
    });
    const bounds =
        presentation?.kind === 'screen'
            ? { left: 0, top: 0, width: canvas.width, height: canvas.height }
            : paintedTextBounds(ctx, canvas.width, canvas.height);
    const unit = (spec.style.size * 16) / canvas.width;
    texture.offset.set(
        bounds.left / canvas.width,
        1 - (bounds.top + bounds.height) / canvas.height,
    );
    texture.repeat.set(bounds.width / canvas.width, bounds.height / canvas.height);
    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(bounds.width * unit, bounds.height * unit),
        mat,
    );
    // Preserve the existing ink size and authored origin while trimming only transparent margins.
    mesh.position.set(
        (bounds.left + bounds.width / 2 - canvas.width / 2) * unit,
        (canvas.height / 2 - bounds.top - bounds.height / 2) * unit,
        0,
    );
    group.add(mesh);
    if (spec.type === 'label') {
        group.add(
            new THREE.Line(
                new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(),
                    new THREE.Vector3(...spec.target),
                ]),
                new THREE.LineBasicMaterial({ color: palette.color }),
            ),
        );
    }
    return {
        group,
        updateColors: (colors) => {
            palette = colors;
            draw();
            const ink = colors.color;
            group.traverse((object) => {
                if (
                    object instanceof THREE.Line &&
                    object.material instanceof THREE.LineBasicMaterial
                )
                    object.material.color.set(ink);
                else if (
                    object instanceof THREE.Mesh &&
                    object.material instanceof THREE.MeshBasicMaterial &&
                    !object.material.map
                )
                    object.material.color.set(ink);
            });
        },
    };
}
