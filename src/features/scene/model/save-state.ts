import axios from 'axios';
import { ApiErrorSchema } from '../../../shared/contracts/error.schema';
import type { Scene } from '../../../shared/contracts/scene.schema';
import { sceneFingerprint } from './objects';

export interface SaveAttempt {
    scene: Scene;
    revision: number;
}
export function isSceneConflict(error: unknown): boolean {
    if (!axios.isAxiosError(error) || error.response?.status !== 409) return false;
    const result = ApiErrorSchema.safeParse(error.response.data);
    return result.success && result.data.error.code === 'REVISION_CONFLICT';
}
export function reconcileSave(
    attempt: SaveAttempt,
    remote: SaveAttempt,
): 'saved' | 'retry' | 'conflict' {
    if (remote.revision < attempt.revision)
        throw new Error('Máy chủ trả về phiên bản cũ. Hãy thử kiểm tra lại.');
    if (remote.revision === attempt.revision) return 'retry';
    return sceneFingerprint(remote.scene) === sceneFingerprint(attempt.scene)
        ? 'saved'
        : 'conflict';
}
