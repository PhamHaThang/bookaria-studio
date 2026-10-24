import type { SceneObject } from '../../../shared/contracts/scene.schema';

export function safeTransform(
    value: SceneObject['transform'],
    snapToPaper: boolean,
    moving: boolean,
): SceneObject['transform'] | null {
    const fields = [...value.position, ...value.rotation, ...value.scale];
    if (!fields.every(Number.isFinite)) return null;
    const round = (n: number) => Math.round(n * 100000) / 100000;
    return {
        position: value.position.map((n, index) =>
            snapToPaper && moving && index === 2 ? 0 : round(n),
        ) as [number, number, number],
        rotation: value.rotation.map(round) as [number, number, number],
        scale: value.scale.map((n) => Math.max(0.001, round(n))) as [number, number, number],
    };
}
