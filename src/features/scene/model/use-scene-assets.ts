import { useQueries } from '@tanstack/react-query';
import type { AssetRef } from '../../../shared/contracts/asset.schema';
import { type Scene, sceneAssetIds } from '../../../shared/contracts/scene.schema';
import { assetKeys, assetsApi } from '../../assets';
import { useAuth } from '../../auth';

export function useSceneAssets(scene: Scene, known: Record<string, AssetRef>) {
    const { user } = useAuth();
    const missing = sceneAssetIds(scene).filter((id) => !known[id]);
    const queries = useQueries({
        queries: missing.map((id) => ({
            queryKey: assetKeys.detail(user?.id || '', id),
            queryFn: ({ signal }: { signal: AbortSignal }) => assetsApi.detail(id, signal),
            retry: false,
        })),
    });
    const result = { ...known };
    queries.forEach((query, index) => {
        if (query.data) result[missing[index]] = query.data;
    });
    return result;
}
