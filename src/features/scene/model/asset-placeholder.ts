import {
    Box3,
    BoxGeometry,
    type Color,
    EdgesGeometry,
    Group,
    LineBasicMaterial,
    LineSegments,
    Mesh,
    MeshBasicMaterial,
    Vector3,
} from 'three';
import type { AssetRef } from '@/shared/contracts/asset.schema';
import type { SceneObject } from '@/shared/contracts/scene.schema';
import { cachedModelBounds } from './asset-insertion';

export function createAssetPlaceholder(
    spec: SceneObject,
    asset: AssetRef | undefined,
    aspect: number,
    color: Color,
) {
    if (spec.type !== 'model' && spec.type !== 'image' && spec.type !== 'video') return;
    const group = new Group();
    group.name = 'bookaria-asset-placeholder';
    group.userData.editorPlaceholder = true;
    const known = spec.type === 'model' && asset ? cachedModelBounds(asset.url) : undefined;
    const [sx, sy, sz] = spec.transform.scale.map((value) =>
        Number.isFinite(value) && value > 0 ? value : 1,
    );
    const bounds =
        known ??
        (spec.type === 'model'
            ? new Box3(
                  new Vector3(-0.2 / sx, 0, (-0.2 * aspect) / sz),
                  new Vector3(0.2 / sx, (0.4 * Math.min(1, aspect)) / sy, (0.2 * aspect) / sz),
              )
            : new Box3(
                  new Vector3(-0.5, -((asset?.meta.height || 1) / (asset?.meta.width || 1)) / 2, 0),
                  new Vector3(0.5, (asset?.meta.height || 1) / (asset?.meta.width || 1) / 2, 0),
              ));
    const size = bounds.getSize(new Vector3()),
        center = bounds.getCenter(new Vector3());
    const geometry = new BoxGeometry(
        Math.max(size.x, 1e-6),
        Math.max(size.y, 1e-6),
        Math.max(size.z, 1e-6),
    );
    const fill = new Mesh(
        geometry,
        new MeshBasicMaterial({ color, transparent: true, opacity: 0.04, depthWrite: false }),
    );
    const material = new LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
    });
    const lines = new LineSegments(new EdgesGeometry(geometry), material);
    fill.position.copy(center);
    lines.position.copy(center);
    group.add(fill, lines);
    return {
        group,
        bounds,
        pulse(time: number, reduced: boolean) {
            material.opacity = reduced ? 0.55 : 0.5 + Math.sin(time * 2.8) * 0.12;
        },
        dispose() {
            group.removeFromParent();
            geometry.dispose();
            lines.geometry.dispose();
            material.dispose();
            fill.material.dispose();
        },
    };
}

/** Wait for a drawable video frame; removing the object cancels the wait immediately. */
export function waitForVideo(video: HTMLVideoElement, signal: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        const clean = () => {
            video.removeEventListener('loadeddata', ready);
            video.removeEventListener('error', failed);
            signal.removeEventListener('abort', aborted);
        };
        const ready = () => {
            clean();
            resolve();
        };
        const failed = () => {
            clean();
            reject(new Error('Không tải được video. Kiểm tra tệp tài nguyên.'));
        };
        const aborted = () => {
            clean();
            reject(signal.reason);
        };
        if (signal.aborted) {
            aborted();
            return;
        }
        if (video.readyState >= 2) {
            ready();
            return;
        }
        if (video.error) {
            failed();
            return;
        }
        video.addEventListener('loadeddata', ready);
        video.addEventListener('error', failed);
        signal.addEventListener('abort', aborted, { once: true });
    });
}
