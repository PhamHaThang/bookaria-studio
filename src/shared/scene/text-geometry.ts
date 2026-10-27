import * as THREE from 'three';

type ShapeData = { position: Float32Array; normal: Float32Array; uv: Float32Array };
let worker: Worker | null = null,
    sequence = 0;
const requests = new Map<
    number,
    { resolve: (data: ShapeData) => void; reject: (error: Error) => void }
>();
const inflight = new Map<string, Promise<ShapeData>>();
function getWorker() {
    if (worker) return worker;
    worker = new Worker(new URL('./text-geometry.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<ShapeData & { id: number; error?: string }>) => {
        const request = requests.get(event.data.id);
        if (!request) return;
        requests.delete(event.data.id);
        if (event.data.error) request.reject(new Error(event.data.error));
        else request.resolve(event.data);
    };
    worker.onerror = () => {
        const error = new Error('Không khởi tạo được bộ dựng chữ 3D. Vui lòng thử lại.');
        for (const request of requests.values()) request.reject(error);
        requests.clear();
        worker?.terminate();
        worker = null;
    };
    return worker;
}
export async function textGeometry(text: string, bold: boolean, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const key = JSON.stringify([text, bold]);
    let pending = inflight.get(key);
    if (!pending) {
        const current = getWorker(),
            id = ++sequence;
        pending = new Promise<ShapeData>((resolve, reject) => {
            requests.set(id, { resolve, reject });
            current.postMessage({ id, text, bold });
        });
        inflight.set(key, pending);
        const cleanup = () => {
            if (inflight.get(key) === pending) inflight.delete(key);
        };
        pending.then(cleanup, cleanup);
    }
    const data = await pending;
    signal?.throwIfAborted();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(data.position, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(data.normal, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(data.uv, 2));
    return geometry;
}
