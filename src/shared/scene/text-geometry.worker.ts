import latin from '@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-400-normal.woff?url';
import latinBold from '@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-700-normal.woff?url';
import extended from '@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-ext-400-normal.woff?url';
import extendedBold from '@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-ext-700-normal.woff?url';
import vietnamese from '@fontsource/be-vietnam-pro/files/be-vietnam-pro-vietnamese-400-normal.woff?url';
import vietnameseBold from '@fontsource/be-vietnam-pro/files/be-vietnam-pro-vietnamese-700-normal.woff?url';
import * as THREE from 'three';
import { type Font, FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';

type ShapeData = { position: Float32Array; normal: Float32Array; uv: Float32Array };
const scope = globalThis as unknown as {
    onmessage: ((event: MessageEvent<{ id: number; text: string; bold: boolean }>) => void) | null;
    postMessage: (data: unknown, transfers?: Transferable[]) => void;
};
const fonts = new Map<boolean, Promise<Font>>();
const cache = new Map<string, ShapeData>();
let cachedBytes = 0;
const bytesOf = (data: ShapeData) =>
    data.position.byteLength + data.normal.byteLength + data.uv.byteLength;
async function fontFor(bold: boolean) {
    let pending = fonts.get(bold);
    if (!pending) {
        pending = Promise.all(
            (bold ? [latinBold, extendedBold, vietnameseBold] : [latin, extended, vietnamese]).map(
                async (url) => {
                    const response = await fetch(url);
                    if (!response.ok) throw new Error('Chưa tải được phông chữ 3D.');
                    return new TTFLoader().parse(await response.arrayBuffer()) as Parameters<
                        FontLoader['parse']
                    >[0];
                },
            ),
        ).then((parts) =>
            new FontLoader().parse({
                ...parts[0],
                glyphs: Object.assign({}, ...parts.map((part) => part.glyphs)),
            }),
        );
        fonts.set(bold, pending);
        pending.catch(() => fonts.delete(bold));
    }
    return pending;
}
scope.onmessage = (event) => {
    const { id, text, bold } = event.data;
    void (async () => {
        const key = JSON.stringify([text, bold]);
        let data = cache.get(key);
        if (data) {
            cache.delete(key);
            cache.set(key, data);
        } else {
            const font = await fontFor(bold);
            // Normalized geometry lets colour, size and extrusion update without rebuilding glyphs.
            const geometry = new THREE.ExtrudeGeometry(font.generateShapes(text, 1), {
                depth: 1,
                bevelEnabled: false,
                curveSegments: 4,
                steps: 1,
            });
            geometry.computeBoundingBox();
            const center =
                geometry.boundingBox?.getCenter(new THREE.Vector3()) || new THREE.Vector3();
            geometry.translate(-center.x, -center.y, 0);
            data = {
                position: new Float32Array(geometry.getAttribute('position').array),
                normal: new Float32Array(geometry.getAttribute('normal').array),
                uv: new Float32Array(geometry.getAttribute('uv').array),
            };
            geometry.dispose();
            const bytes = bytesOf(data);
            while (cachedBytes + bytes > 16 * 1024 * 1024 && cache.size) {
                const oldest = cache.keys().next().value;
                if (oldest === undefined) break;
                const removed = cache.get(oldest);
                if (removed) cachedBytes -= bytesOf(removed);
                cache.delete(oldest);
            }
            if (bytes <= 16 * 1024 * 1024) {
                cache.set(key, data);
                cachedBytes += bytes;
            }
        }
        // Transfer copies; the bounded worker cache keeps its own immutable arrays.
        const result = {
            position: data.position.slice(),
            normal: data.normal.slice(),
            uv: data.uv.slice(),
        };
        scope.postMessage({ id, ...result }, [
            result.position.buffer,
            result.normal.buffer,
            result.uv.buffer,
        ]);
    })().catch((error) =>
        scope.postMessage({
            id,
            error: error instanceof Error ? error.message : 'Không dựng được chữ 3D.',
        }),
    );
};
