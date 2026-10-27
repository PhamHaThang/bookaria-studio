/** Wrap long identifiers as well as words; never squeeze glyphs horizontally. */
export function wrapText(text: string, ctx: CanvasRenderingContext2D, width: number) {
    const lines: string[] = [];
    for (const paragraph of text.split(/\r?\n/)) {
        let line = '';
        for (const word of paragraph.split(/\s+/).filter(Boolean)) {
            if (line && ctx.measureText(`${line} ${word}`).width <= width) {
                line += ` ${word}`;
                continue;
            }
            if (line) lines.push(line);
            line = '';
            for (const char of Array.from(word)) {
                if (line && ctx.measureText(line + char).width > width) {
                    lines.push(line);
                    line = '';
                }
                line += char;
            }
        }
        lines.push(line);
    }
    return lines;
}
