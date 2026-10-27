import {
    type Box3,
    type BufferGeometry,
    Euler,
    type Material,
    MathUtils,
    Matrix4,
    type Texture,
    Vector3,
} from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import type { Asset } from '@/shared/contracts/dto.schema';
import type { SceneObject } from '@/shared/contracts/scene.schema';
import { type AssetObjectType, newObject } from './objects';
import { visibleModelBounds } from './preview-fit';

/** One unit is a page width. Fit the oriented bounds without modifying source geometry. */
export function fitAssetTransform(
    bounds: Box3,
    aspect: number,
    rotation: [number, number, number],
    model: boolean,
): SceneObject['transform'] {
    if (!Number.isFinite(aspect) || aspect <= 0) throw new Error('Khổ trang không hợp lệ.');
    const oriented = bounds
        .clone()
        .applyMatrix4(
            new Matrix4().makeRotationFromEuler(
                new Euler(...(rotation.map(MathUtils.degToRad) as [number, number, number])),
            ),
        );
    const size = oriented.getSize(new Vector3());
    const center = oriented.getCenter(new Vector3());
    if (
        bounds.isEmpty() ||
        ![...size.toArray(), ...center.toArray()].every(Number.isFinite) ||
        size.lengthSq() === 0
    )
        throw new Error('Không đo được kích thước tài nguyên. Hãy kiểm tra lại tệp.');
    const limits = [0.4, aspect * 0.4, Math.min(1, aspect) * 0.4];
    const factor = Math.max(
        0.001,
        Math.min(
            ...size.toArray().flatMap((length, i) => (length > 1e-10 ? [limits[i] / length] : [])),
        ),
    );
    if (!Number.isFinite(factor) || factor <= 0)
        throw new Error('Kích thước tài nguyên không hợp lệ.');
    const offset = (value: number) => (value === 0 ? 0 : -value * factor);
    return {
        rotation: [...rotation],
        scale: [factor, factor, factor],
        position: [offset(center.x), offset(center.y), model ? offset(oriented.min.z) : 0],
    };
}

const modelBoundsCache = new Map<string, Box3>();
export function cachedModelBounds(url: string) {
    return modelBoundsCache.get(url)?.clone();
}
async function modelBounds(url: string, signal: AbortSignal) {
    const cached = modelBoundsCache.get(url);
    if (cached) return cached.clone();
    const [{ GLTFLoader }, { DRACOLoader }, THREE] = await Promise.all([
        import('three/addons/loaders/GLTFLoader.js'),
        import('three/addons/loaders/DRACOLoader.js'),
        import('three'),
    ]);
    signal.throwIfAborted();
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error('Không tải được mô hình. Vui lòng thử lại.');
    const bytes = await response.arrayBuffer();
    signal.throwIfAborted();
    const draco = new DRACOLoader().setDecoderPath('/vendor/draco-0.161.0/');
    let gltf: GLTF | undefined;
    try {
        gltf = await new GLTFLoader()
            .setDRACOLoader(draco)
            .parseAsync(bytes, new URL('.', url).href);
        signal.throwIfAborted();
        const bounds = visibleModelBounds(gltf.scene);
        if (bounds.isEmpty()) throw new Error('Mô hình không có hình học để thêm vào trang.');
        if (modelBoundsCache.size >= 32) modelBoundsCache.clear();
        modelBoundsCache.set(url, bounds.clone());
        return bounds;
    } finally {
        if (gltf) {
            const geometries = new Set<BufferGeometry>(),
                materials = new Set<Material>(),
                textures = new Set<Texture>();
            for (const scene of gltf.scenes)
                scene.traverse((node) => {
                    if (!(node instanceof THREE.Mesh)) return;
                    geometries.add(node.geometry);
                    for (const material of Array.isArray(node.material)
                        ? node.material
                        : [node.material]) {
                        materials.add(material);
                        for (const value of Object.values(material))
                            if (value instanceof THREE.Texture) textures.add(value);
                    }
                });
            for (const texture of textures) {
                const image = texture.source?.data;
                if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap)
                    image.close();
                texture.dispose();
            }
            for (const geometry of geometries) geometry.dispose();
            for (const material of materials) material.dispose();
        }
        draco.dispose();
    }
}

/** Prepare only new insertions; existing scenes and asset replacements retain authored transforms. */
export async function createFittedAssetObject(
    type: AssetObjectType,
    id: string,
    asset: Asset,
    aspect: number,
    signal: AbortSignal,
) {
    const object = newObject(type, id, asset);
    signal.throwIfAborted();
    if (type !== 'model') return object;
    const bounds = await modelBounds(asset.url, signal);
    signal.throwIfAborted();
    return {
        ...object,
        transform: fitAssetTransform(bounds, aspect, object.transform.rotation, true),
    };
}
