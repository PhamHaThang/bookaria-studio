import { fetchBytes } from './fetchBytes';

type Download = typeof fetchBytes;
export const ASSET_CACHE_LIMITS = {
    totalBytes: 24 * 1024 * 1024,
    fileBytes: 8 * 1024 * 1024,
} as const;

/** Completed file bytes only. Decoded textures, models and media belong to their page runtime. */
export class AssetCache {
    private entries = new Map<string, ArrayBuffer>();
    private size = 0;
    private generation = 0;
    private download: Download;
    private limits: { totalBytes: number; fileBytes: number };
    constructor(
        download: Download = fetchBytes,
        limits: { totalBytes: number; fileBytes: number } = ASSET_CACHE_LIMITS,
    ) {
        this.download = download;
        this.limits = limits;
    }
    async get(url: string, signal: AbortSignal, maxBytes = 50 * 1024 * 1024) {
        signal.throwIfAborted();
        const cached = this.entries.get(url);
        if (cached) {
            if (cached.byteLength > maxBytes) throw new Error('Tài nguyên vượt giới hạn tải.');
            this.entries.delete(url);
            this.entries.set(url, cached);
            return cached;
        }
        const generation = this.generation;
        const bytes = await this.download(url, signal, maxBytes);
        signal.throwIfAborted();
        if (bytes.byteLength > maxBytes) throw new Error('Tài nguyên vượt giới hạn tải.');
        if (
            generation === this.generation &&
            bytes.byteLength > 0 &&
            bytes.byteLength <= this.limits.fileBytes &&
            bytes.byteLength <= this.limits.totalBytes
        ) {
            this.delete(url);
            this.entries.set(url, bytes);
            this.size += bytes.byteLength;
            while (this.size > this.limits.totalBytes) {
                const oldest = this.entries.keys().next().value as string;
                this.delete(oldest);
            }
        }
        return bytes;
    }
    delete(url: string) {
        const previous = this.entries.get(url);
        if (!previous) return;
        this.size -= previous.byteLength;
        this.entries.delete(url);
    }
    clear() {
        this.generation++;
        this.entries.clear();
        this.size = 0;
    }
}
