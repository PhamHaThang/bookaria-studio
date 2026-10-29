export async function fetchBytes(url: string, signal: AbortSignal, maxBytes = 50 * 1024 * 1024) {
    const response = await fetch(url, {
        signal,
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
    });
    if (!response.ok) throw new Error('Không tải được tài nguyên của trang.');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Tài nguyên rỗng.');
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
        while (true) {
            signal.throwIfAborted();
            const part = await reader.read();
            if (part.done) break;
            total += part.value.byteLength;
            if (total > maxBytes) throw new Error('Tài nguyên vượt giới hạn tải.');
            chunks.push(part.value);
        }
    } finally {
        await reader.cancel().catch(() => {});
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
    }
    return bytes.buffer;
}
