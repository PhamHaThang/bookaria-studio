import {
    SCREEN_BORDER_DEFAULTS,
    type ScreenBorder,
    type TextPresentation,
} from '../contracts/scene.schema';
import { wrapText } from './text-layout';

type Bubble = Extract<TextPresentation, { kind: 'bubble' }>;
type Point = { x: number; y: number };

/** Measure all turns once so navigation updates only pixels, never scene geometry. */
export function createBubbleText(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    bubble: Bubble,
    content: string,
    color: string,
    family: string,
    bold: boolean,
    initialPage = 0,
) {
    let ink = color,
        background = bubble.background,
        pointerPosition = bubble.pointerPosition ?? 0.5,
        border = bubble.border ?? SCREEN_BORDER_DEFAULTS;
    const pages = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    if (!pages.length) pages.push('');
    const width = 640,
        margin = 24,
        padding = 32,
        bodyWidth = width - margin * 2;
    const textWidth = bodyWidth - padding * 2;
    const bodyFont = `${bold ? 700 : 400} 28px ${family}`;
    const titleFont = `700 28px ${family}`;
    ctx.font = titleFont;
    const title = bubble.title.trim() ? wrapText(bubble.title, ctx, textWidth) : [];
    ctx.font = bodyFont;
    const turns = pages.map((page) => wrapText(page, ctx, textWidth));
    const titleHeight = title.length ? title.length * 39 + 16 : 0;
    const contentHeight = Math.max(...turns.map((turn) => turn.length)) * 40;
    const footerHeight = pages.length > 1 ? 64 : 0;
    const bodyHeight = Math.max(150, padding * 2 + titleHeight + contentHeight + footerHeight);
    const height = bodyHeight + margin * 2;
    const resolution = Math.min(1, 2048 / height);
    canvas.width = Math.ceil(width * resolution);
    canvas.height = Math.ceil(height * resolution);
    let current = Math.max(0, Math.min(initialPage, pages.length - 1));
    const footerY = margin + bodyHeight - padding - 22;
    const previousX = width - margin - padding - 88;
    const nextX = previousX + 48;
    const draw = () => {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(resolution, 0, 0, resolution, 0, 0);
        const left = margin,
            right = width - margin,
            top = margin,
            bottom = height - margin,
            radius = 28,
            edgeGuard = radius + 22 + (border.enabled ? border.width : 0),
            position = Math.max(0, Math.min(1, pointerPosition)),
            cx = left + edgeGuard + (right - left - edgeGuard * 2) * position,
            cy = top + edgeGuard + (bottom - top - edgeGuard * 2) * position,
            inset = border.enabled ? border.width + 1 : 0;
        // One continuous silhouette avoids a seam across the base of the tail.
        ctx.beginPath();
        ctx.moveTo(left + radius, top);
        if (bubble.pointer === 'top') {
            ctx.lineTo(cx - 22, top);
            ctx.lineTo(cx, inset);
            ctx.lineTo(cx + 22, top);
        }
        ctx.lineTo(right - radius, top);
        ctx.quadraticCurveTo(right, top, right, top + radius);
        if (bubble.pointer === 'right') {
            ctx.lineTo(right, cy - 22);
            ctx.lineTo(width - inset, cy);
            ctx.lineTo(right, cy + 22);
        }
        ctx.lineTo(right, bottom - radius);
        ctx.quadraticCurveTo(right, bottom, right - radius, bottom);
        if (bubble.pointer === 'bottom') {
            ctx.lineTo(cx + 22, bottom);
            ctx.lineTo(cx, height - inset);
            ctx.lineTo(cx - 22, bottom);
        }
        ctx.lineTo(left + radius, bottom);
        ctx.quadraticCurveTo(left, bottom, left, bottom - radius);
        if (bubble.pointer === 'left') {
            ctx.lineTo(left, cy + 22);
            ctx.lineTo(inset, cy);
            ctx.lineTo(left, cy - 22);
        }
        ctx.lineTo(left, top + radius);
        ctx.quadraticCurveTo(left, top, left + radius, top);
        ctx.closePath();
        ctx.fillStyle = background;
        ctx.fill();
        if (border.enabled) {
            ctx.strokeStyle = border.color;
            ctx.lineWidth = border.width * 2;
            ctx.lineJoin = 'round';
            ctx.stroke();
        }
        ctx.fillStyle = ink;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = titleFont;
        title.forEach((line, index) => {
            ctx.fillText(line, margin + padding, margin + padding + 19.5 + index * 39);
        });
        ctx.font = bodyFont;
        turns[current].forEach((line, index) => {
            ctx.fillText(line, margin + padding, margin + padding + titleHeight + 20 + index * 40);
        });
        if (pages.length > 1) {
            ctx.font = `400 22px ${family}`;
            ctx.textAlign = 'center';
            ctx.fillText(`${current + 1} / ${pages.length}`, width / 2, footerY);
            const arrow = (x: number, direction: -1 | 1, enabled: boolean) => {
                ctx.globalAlpha = enabled ? 1 : 0.3;
                ctx.strokeStyle = ink;
                ctx.lineWidth = 2.5;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.beginPath();
                ctx.moveTo(x - direction * 4, footerY - 7);
                ctx.lineTo(x + direction * 4, footerY);
                ctx.lineTo(x - direction * 4, footerY + 7);
                ctx.stroke();
                ctx.globalAlpha = 1;
            };
            arrow(previousX, -1, current > 0);
            arrow(nextX, 1, current < pages.length - 1);
        }
    };
    const setPage = (page: number) => {
        current = Math.max(0, Math.min(Math.trunc(page), pages.length - 1));
        draw();
        return current;
    };
    const tap = (uv?: Point) => {
        if (uv) {
            const x = uv.x * width,
                y = (1 - uv.y) * height;
            if (x < margin || x > width - margin || y < margin || y > height - margin)
                return current;
            if (pages.length > 1 && Math.abs(y - footerY) <= 22) {
                if (Math.abs(x - previousX) <= 22) return setPage(current - 1);
                if (Math.abs(x - nextX) <= 22) return setPage(current + 1);
            }
        }
        return setPage((current + 1) % pages.length);
    };
    draw();
    return {
        setPage,
        setPointerPosition(position: number) {
            pointerPosition = position;
            draw();
        },
        tap,
        next: () => tap(),
        setColors(color: string, fill: string, stroke?: ScreenBorder) {
            ink = color;
            background = fill;
            border = stroke ?? bubble.border ?? SCREEN_BORDER_DEFAULTS;
            draw();
        },
    };
}
