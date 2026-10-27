import { SCREEN_BORDER_DEFAULTS, type TextPresentation } from '../contracts/scene.schema';
import { wrapText } from './text-layout';

type Screen = Extract<TextPresentation, { kind: 'screen' }>;
type TypeStyle = NonNullable<Screen['titleStyle']>;
type Block = { lines: string[]; y: number; lineHeight: number; style: TypeStyle; inset: number };

/** Draw the same content-sized Screen Text card in Studio and Viewer. */
export function drawScreenText(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    screen: Screen,
    body: string,
    color: string,
    family: string,
    bold: boolean,
    image?: ImageBitmap | HTMLCanvasElement,
) {
    const width = 640,
        padding = 40,
        inner = width - padding * 2;
    const font = (style: TypeStyle) => `${style.weight} ${style.size * 2}px ${family}`;
    const titleStyle = screen.titleStyle ?? { size: 17, weight: 600 };
    const bodyStyle = screen.bodyStyle ?? { size: 14, weight: bold ? 700 : 400 };
    const buttonStyle = screen.buttonStyle ?? { size: 14, weight: 600 };
    let cursor = padding;
    const imageSize = image
        ? {
              width: image.width * Math.min(inner / image.width, 320 / image.height),
              height: image.height * Math.min(inner / image.width, 320 / image.height),
          }
        : undefined;
    const imageY = cursor;
    if (imageSize) cursor += imageSize.height;
    const block = (
        value: string,
        style: TypeStyle,
        gapBefore: number,
        inset = 0,
    ): Block | undefined => {
        if (!value.trim()) return undefined;
        if (cursor > padding) cursor += gapBefore;
        ctx.font = font(style);
        const lines = wrapText(value, ctx, inner - inset * 2);
        const lineHeight = style.size * 2 * 1.4;
        const result = { lines, y: cursor, lineHeight, style, inset };
        cursor += lines.length * lineHeight;
        return result;
    };
    const title = block(screen.title, titleStyle, 24);
    const description = block(body, bodyStyle, title ? 12 : 24);
    const button = block(screen.buttonLabel, buttonStyle, 28, 24);
    // Button has its own vertical padding, separate from the content gap.
    const buttonHeight = button ? button.lines.length * button.lineHeight + 28 : 0;
    if (button) cursor += 28;
    const height = Math.ceil(Math.max(120, cursor + padding));
    // Keep unusually long cards within a mobile-friendly texture budget, preserving layout.
    const resolution = Math.min(1, 2048 / height);
    const pixelWidth = Math.ceil(width * resolution),
        pixelHeight = Math.ceil(height * resolution);
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(resolution, 0, 0, resolution, 0, 0);
    ctx.fillStyle = screen.background;
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, 28);
    ctx.fill();
    const border = screen.border ?? SCREEN_BORDER_DEFAULTS;
    if (border.enabled) {
        const inset = border.width;
        ctx.strokeStyle = border.color;
        ctx.lineWidth = border.width * 2;
        ctx.beginPath();
        ctx.roundRect(inset, inset, width - inset * 2, height - inset * 2, Math.max(0, 28 - inset));
        ctx.stroke();
    }
    if (image && imageSize)
        ctx.drawImage(
            image,
            (width - imageSize.width) / 2,
            imageY,
            imageSize.width,
            imageSize.height,
        );
    const paint = (item: Block | undefined, fill: string, offset = 0) => {
        if (!item) return;
        ctx.font = font(item.style);
        ctx.textAlign = item.style.align ?? 'center';
        const edge = padding + item.inset;
        const x =
            ctx.textAlign === 'left' ? edge : ctx.textAlign === 'right' ? width - edge : width / 2;
        ctx.textBaseline = 'middle';
        ctx.fillStyle = fill;
        item.lines.forEach((line, index) => {
            ctx.fillText(line, x, item.y + offset + (index + 0.5) * item.lineHeight);
        });
    };
    paint(title, color);
    paint(description, color);
    if (button) {
        const background = screen.buttonBackground ?? color;
        ctx.fillStyle = background;
        ctx.beginPath();
        ctx.roundRect(padding, button.y, inner, buttonHeight, Math.min(buttonHeight / 2, 52));
        ctx.fill();
        // Choose readable ink independently of the card background.
        const rgb = background
            .slice(1)
            .match(/../g)
            ?.map((channel) => {
                const s = Number.parseInt(channel, 16) / 255;
                return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
            }) ?? [0, 0, 0];
        const luminance = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
        paint(button, luminance > 0.179 ? '#000000' : '#ffffff', 14);
    }
}
