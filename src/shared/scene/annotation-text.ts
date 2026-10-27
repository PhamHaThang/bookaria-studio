import * as THREE from 'three';
import { ANNOTATION_DESCRIPTION_DEFAULTS, type TextPresentation } from '../contracts/scene.schema';
import { type AnnotationConnectorSide, annotationConnectorSide } from './annotation-connector';
import { wrapText } from './text-layout';

type Annotation = Extract<TextPresentation, { kind: 'annotation' }>;

/** A compact label expands in place; only explicit newlines split annotation descriptions. */
export function createAnnotationText(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    annotation: Annotation,
    content: string,
    color: string,
    family: string,
    bold: boolean,
    size: number,
    target: [number, number, number],
    initiallyExpanded = false,
) {
    const circle = annotation.shape === 'circle';
    const font = `${bold ? 700 : 400} 64px ${family}`;
    const description = annotation.description.normalize('NFC').trim();
    const descriptionFont = `400 48px ${family}`;
    const descriptionLines = description ? description.split(/\r?\n/) : [];
    const descriptionLineHeight = 66;
    ctx.font = descriptionFont;
    const descriptionWidth = Math.max(
        0,
        ...descriptionLines.map((line) => ctx.measureText(line).width),
    );
    const descriptionHeight = descriptionLines.length * descriptionLineHeight;
    ctx.font = font;
    const normalized = content.normalize('NFC');
    const lines = circle ? wrapText(normalized, ctx, 336) : normalized.split(/\r?\n/);
    const textWidth = Math.max(0, ...lines.map((line) => ctx.measureText(line).width));
    const lineHeight = 86,
        textHeight = lines.length * lineHeight;
    const diameter = Math.ceil(Math.max(128, Math.hypot(textWidth, textHeight) + 48));
    const compactWidth = circle
        ? diameter
        : Math.ceil(Math.max(128, textWidth + 64 + (description ? 64 : 0)));
    const compactHeight = circle ? diameter : Math.ceil(Math.max(128, textHeight + 48));
    const expandedWidth = Math.ceil(Math.max(compactWidth, descriptionWidth + 64));
    const expandedHeight = compactHeight - 16 + descriptionHeight + 24;
    const tooltipWidth = Math.ceil(Math.max(128, descriptionWidth + 64));
    const tooltipHeight = Math.ceil(Math.max(128, descriptionHeight + 64));
    const unit = size / 64;
    const group = new THREE.Group();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const card = new THREE.Mesh(
        new THREE.PlaneGeometry(compactWidth * unit, compactHeight * unit),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide }),
    );
    card.name = 'annotation-label';
    group.add(card);
    let expanded = Boolean(description && initiallyExpanded);
    const labelOffset = new THREE.Vector2(...(annotation.labelOffset ?? [0, 0]));
    let connectorSide = annotationConnectorSide(annotation, target);
    let ink = color,
        background = annotation.background;
    let descriptionInk = annotation.descriptionColor ?? ANNOTATION_DESCRIPTION_DEFAULTS.color;
    let descriptionFill =
        annotation.descriptionBackground ?? ANNOTATION_DESCRIPTION_DEFAULTS.background;
    let tooltipCanvas: HTMLCanvasElement | undefined,
        tooltipContext: CanvasRenderingContext2D | undefined;
    let tooltipTexture: THREE.CanvasTexture | undefined, tooltip: THREE.Mesh | undefined;
    if (circle && description) {
        tooltipCanvas = document.createElement('canvas');
        const context = tooltipCanvas.getContext('2d');
        if (!context) throw new Error('Không vẽ được mô tả chú thích.');
        tooltipContext = context;
        tooltipTexture = new THREE.CanvasTexture(tooltipCanvas);
        tooltipTexture.colorSpace = THREE.SRGBColorSpace;
        tooltip = new THREE.Mesh(
            new THREE.PlaneGeometry(tooltipWidth * unit, tooltipHeight * unit),
            new THREE.MeshBasicMaterial({
                map: tooltipTexture,
                transparent: true,
                side: THREE.DoubleSide,
            }),
        );
        tooltip.name = 'annotation-description';
        group.add(tooltip);
    }
    const end = new THREE.Vector3(...target),
        start = new THREE.Vector3(),
        delta = new THREE.Vector3();
    const accents: THREE.MeshBasicMaterial[] = [];
    let leader: THREE.Mesh | undefined;
    if (!circle && end.lengthSq() > 1e-12) {
        const material = new THREE.MeshBasicMaterial({ color: background });
        accents.push(material);
        leader = new THREE.Mesh(
            new THREE.CylinderGeometry(size * 0.04, size * 0.04, 1, 12),
            material,
        );
        leader.name = 'annotation-leader';
        const marker = new THREE.Mesh(new THREE.SphereGeometry(size * 0.15, 20, 12), material);
        marker.name = 'annotation-marker';
        marker.position.copy(end);
        group.add(leader, marker);
    }
    if (!circle && annotation.anchorAtTarget) group.position.copy(end).negate();
    function layout(width: number, height: number) {
        card.scale.set(width / compactWidth, height / compactHeight, 1);
        // Horizontal presets keep the card centre level with the placement marker,
        // including when the description expands the card vertically.
        card.position.set(0, 0, 0);
        const halfWidth = (compactWidth * unit) / 2,
            halfHeight = (compactHeight * unit) / 2,
            gap = size * 1.5;
        if (!circle && Math.abs(end.x) > 1e-6) {
            const side = Math.sign(end.x);
            const base = side * end.x - halfWidth < gap ? end.x - side * (halfWidth + gap) : 0;
            card.position.x = base + (side * (compactWidth - width) * unit) / 2;
        } else if (!circle && Math.abs(end.y) > 1e-6) {
            const side = Math.sign(end.y);
            const base = side * end.y - halfHeight < gap ? end.y - side * (halfHeight + gap) : 0;
            card.position.y = base + (side * (compactHeight - height) * unit) / 2;
        }
        if (!circle) {
            card.position.x += labelOffset.x;
            card.position.y += labelOffset.y;
            // Keep the attachment at the chosen edge midpoint while the label is dragged.
            start.copy(card.position);
            if (connectorSide === 'left') start.x -= (width * unit) / 2;
            else if (connectorSide === 'right') start.x += (width * unit) / 2;
            else if (connectorSide === 'top') start.y += (height * unit) / 2;
            else start.y -= (height * unit) / 2;
        }
        if (leader) {
            delta.copy(end).sub(start);
            const length = delta.length();
            leader.visible = length > 1e-6;
            leader.position.copy(start).lerp(end, 0.5);
            leader.scale.y = length;
            if (length > 1e-6)
                leader.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
        }
        if (tooltip) {
            tooltip.visible = expanded;
            tooltip.scale.setScalar(expanded ? 1 : 0);
            tooltip.position.set(
                expanded
                    ? (compactWidth * unit) / 2 +
                          48 * unit +
                          (tooltipWidth * unit) / 2 +
                          labelOffset.x
                    : 0,
                expanded ? labelOffset.y : 0,
                0,
            );
        }
        group.userData.annotationExpanded = expanded;
    }
    function draw() {
        const width = !circle && expanded ? expandedWidth : compactWidth;
        const height = !circle && expanded ? expandedHeight : compactHeight;
        const resolution = Math.min(2, 4096 / Math.max(width, height));
        const pixelWidth = Math.ceil(width * resolution),
            pixelHeight = Math.ceil(height * resolution);
        // r161 uses immutable texture storage. Reallocate it when the canvas dimensions change.
        if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) texture.dispose();
        if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
        if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(resolution, 0, 0, resolution, 0, 0);
        ctx.fillStyle = background;
        ctx.beginPath();
        if (circle) ctx.arc(width / 2, height / 2, width / 2 - 6, 0, Math.PI * 2);
        else ctx.roundRect(0, 0, width, height, expanded ? 28 : compactHeight / 2);
        ctx.fill();
        if (circle) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 10;
            ctx.stroke();
        }
        ctx.font = font;
        ctx.textAlign = !circle && description ? 'left' : 'center';
        ctx.textBaseline = circle ? 'middle' : 'alphabetic';
        ctx.fillStyle = ink;
        lines.forEach((line, index) => {
            // Align the visible glyphs, including Vietnamese accents, with the info icon.
            const metrics = ctx.measureText(line);
            const glyphOffset =
                ((metrics.actualBoundingBoxAscent ?? 48) -
                    (metrics.actualBoundingBoxDescent ?? 16)) /
                2;
            ctx.fillText(
                line,
                !circle && description ? 32 : width / 2,
                circle
                    ? (height - textHeight) / 2 + (index + 0.5) * lineHeight
                    : 24 + (index + 0.5) * lineHeight + glyphOffset,
            );
        });
        if (!circle && description) {
            const iconX = 32 + textWidth + 40,
                iconY = 24 + lineHeight / 2;
            ctx.beginPath();
            ctx.arc(iconX, iconY, 24, 0, Math.PI * 2);
            ctx.fillStyle = ink;
            ctx.fill();
            ctx.strokeStyle = background;
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(iconX, iconY - 1);
            ctx.lineTo(iconX, iconY + 12);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(iconX, iconY - 12, 3, 0, Math.PI * 2);
            ctx.fillStyle = background;
            ctx.fill();
            if (expanded) {
                ctx.font = descriptionFont;
                ctx.textBaseline = 'middle';
                ctx.fillStyle = ink;
                descriptionLines.forEach((line, index) => {
                    ctx.fillText(
                        line,
                        32,
                        compactHeight - 16 + (index + 0.5) * descriptionLineHeight,
                    );
                });
            }
        }
        if (tooltipCanvas && tooltipContext) {
            const scale = Math.min(2, 4096 / Math.max(tooltipWidth, tooltipHeight));
            const tw = Math.ceil(tooltipWidth * scale),
                th = Math.ceil(tooltipHeight * scale);
            if (tooltipCanvas.width !== tw) tooltipCanvas.width = tw;
            if (tooltipCanvas.height !== th) tooltipCanvas.height = th;
            tooltipContext.setTransform(1, 0, 0, 1, 0, 0);
            tooltipContext.clearRect(0, 0, tw, th);
            tooltipContext.setTransform(scale, 0, 0, scale, 0, 0);
            tooltipContext.fillStyle = descriptionFill;
            tooltipContext.beginPath();
            tooltipContext.roundRect(0, 0, tooltipWidth, tooltipHeight, 28);
            tooltipContext.fill();
            tooltipContext.font = descriptionFont;
            tooltipContext.textAlign = 'left';
            tooltipContext.textBaseline = 'middle';
            tooltipContext.fillStyle = descriptionInk;
            descriptionLines.forEach((line, index) => {
                tooltipContext?.fillText(
                    line,
                    32,
                    (tooltipHeight - descriptionHeight) / 2 + (index + 0.5) * descriptionLineHeight,
                );
            });
            if (tooltipTexture) tooltipTexture.needsUpdate = true;
        }
        layout(width, height);
        texture.needsUpdate = true;
    }
    function setExpanded(value: boolean) {
        const next = Boolean(description && value);
        if (next === expanded) return expanded;
        expanded = next;
        draw();
        return expanded;
    }
    draw();
    return {
        group,
        setExpanded,
        setAnnotationConnectorSide(side: AnnotationConnectorSide) {
            if (connectorSide === side) return;
            connectorSide = side;
            layout(
                !circle && expanded ? expandedWidth : compactWidth,
                !circle && expanded ? expandedHeight : compactHeight,
            );
        },
        setAnnotationOffset(offset: [number, number]) {
            labelOffset.fromArray(offset);
            layout(
                !circle && expanded ? expandedWidth : compactWidth,
                !circle && expanded ? expandedHeight : compactHeight,
            );
        },
        toggleDescription: () => setExpanded(!expanded),
        updateColors(colors: {
            color: string;
            background?: string;
            descriptionColor?: string;
            descriptionBackground?: string;
        }) {
            ink = colors.color;
            background = colors.background ?? annotation.background;
            descriptionInk =
                colors.descriptionColor ??
                annotation.descriptionColor ??
                ANNOTATION_DESCRIPTION_DEFAULTS.color;
            descriptionFill =
                colors.descriptionBackground ??
                annotation.descriptionBackground ??
                ANNOTATION_DESCRIPTION_DEFAULTS.background;
            draw();
            for (const material of accents) material.color.set(background);
        },
    };
}
