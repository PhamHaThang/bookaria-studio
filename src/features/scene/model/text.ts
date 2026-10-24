/** Keep author-entered paragraph breaks; wrap words using the canvas's actual font metrics. */
export function wrapText(text: string, measure: (text: string) => number, maxWidth: number) {
    const lines: string[] = [];
    for (const paragraph of text.split(/\r?\n/)) {
        let line = '';
        for (const word of paragraph.split(/\s+/).filter(Boolean)) {
            const next = `${line} ${word}`.trim();
            if (measure(next) > maxWidth && line) {
                lines.push(line);
                line = word;
            } else line = next;
        }
        lines.push(line);
    }
    return lines;
}
