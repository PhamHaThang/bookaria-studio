import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../../../shared/api/client';
import { errorMessage } from '../../../shared/api/errors';
import type { Page } from '../../../shared/contracts/dto.schema';
import type { SceneWarning } from '../../../shared/contracts/scene.schema';
import { assetKeys } from '../../assets';
import { auth, useAuth } from '../../auth';
import { bookKeys } from '../../books';
import { pageKeys, pagesApi } from '../../pages';
import { uncertainWrite } from '../../pages/model/operations';
import { createSceneApi } from '../api/scene-api';
import { sceneFingerprint, validatedScene } from './objects';
import { isSceneConflict, reconcileSave, type SaveAttempt } from './save-state';
import { useSceneHistory } from './use-scene-history';

const sceneApi = createSceneApi(apiClient);
export function useSceneDraft(page: Page) {
    const { user } = useAuth(),
        cache = useQueryClient();
    const [base, setBase] = useState<SaveAttempt>({ scene: page.scene, revision: page.revision });
    const history = useSceneHistory(page.scene);
    const { draft, setDraft } = history;
    const [busy, setBusy] = useState(false),
        [conflict, setConflict] = useState(false),
        [uncertain, setUncertain] = useState<SaveAttempt | null>(null);
    const [error, setError] = useState<string | null>(null),
        [notice, setNotice] = useState<string | null>(null),
        [warnings, setWarnings] = useState<SceneWarning[]>([]);
    const active = useRef(false),
        alive = useRef(true),
        reading = useRef<AbortController | null>(null);
    const dirty = sceneFingerprint(draft) !== sceneFingerprint(base.scene);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
            reading.current?.abort();
        };
    }, []);
    useEffect(() => {
        if (busy || uncertain || page.revision <= base.revision) return;
        if (dirty) {
            setConflict(true);
            return;
        }
        setBase({ scene: page.scene, revision: page.revision });
        history.reset(page.scene);
    }, [page.scene, page.revision, base.revision, dirty, busy, uncertain, history.reset]);
    const currentSession = () => alive.current && auth.store.getState().user?.id === user?.id;
    function remember(value: SaveAttempt, updatedAt?: string) {
        setBase(value);
        if (sceneFingerprint(value.scene) !== sceneFingerprint(draft)) history.reset(value.scene);
        setConflict(false);
        setUncertain(null);
        cache.setQueryData<Page>(pageKeys.detail(user?.id || '', page.id), (current) =>
            current
                ? {
                      ...current,
                      scene: value.scene,
                      revision: value.revision,
                      objectCount: value.scene.objects.length,
                      updatedAt: updatedAt || current.updatedAt,
                  }
                : current,
        );
    }
    async function invalidate() {
        await Promise.all([
            cache.invalidateQueries({ queryKey: pageKeys.all }),
            cache.invalidateQueries({ queryKey: bookKeys.all }),
            cache.invalidateQueries({ queryKey: assetKeys.all }),
        ]);
    }
    async function save() {
        if (active.current || !dirty || conflict || uncertain) return;
        active.current = true;
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            const attempt = { scene: validatedScene(draft), revision: base.revision };
            await cache.cancelQueries({ queryKey: pageKeys.detail(user?.id || '', page.id) });
            try {
                const result = await sceneApi.save(page.id, attempt);
                if (!currentSession()) return;
                remember({ scene: attempt.scene, revision: result.revision }, result.updatedAt);
                setWarnings(result.warnings || []);
                setNotice('Đã lưu nội dung trang.');
                await invalidate();
            } catch (cause) {
                if (!currentSession()) return;
                if (isSceneConflict(cause)) {
                    setConflict(true);
                    setError(
                        'Nội dung đã được thay đổi ở nơi khác. Bản đang sửa của bạn vẫn được giữ.',
                    );
                } else {
                    if (uncertainWrite(cause)) setUncertain(attempt);
                    setError(errorMessage(cause));
                }
            }
        } catch (cause) {
            if (currentSession()) setError(errorMessage(cause));
        } finally {
            active.current = false;
            if (currentSession()) setBusy(false);
        }
    }
    async function readLatest(replace: boolean) {
        if (active.current) return;
        active.current = true;
        const controller = new AbortController();
        reading.current = controller;
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
            const remote = await pagesApi.detail(page.id, controller.signal);
            if (!currentSession() || controller.signal.aborted) return;
            if (remote.bookId !== page.bookId)
                throw new Error('Trang không còn thuộc cuốn sách này.');
            if (replace) {
                remember({ scene: remote.scene, revision: remote.revision });
                setWarnings([]);
                setNotice('Đã tải nội dung mới nhất.');
            } else if (uncertain) {
                const outcome = reconcileSave(uncertain, remote);
                if (outcome === 'saved') {
                    remember({ scene: remote.scene, revision: remote.revision });
                    setNotice('Máy chủ đã lưu nội dung. Không gửi lại yêu cầu.');
                } else if (outcome === 'retry') {
                    setUncertain(null);
                    setNotice('Máy chủ chưa ghi nhận bản này. Bạn có thể bấm lưu lại.');
                } else {
                    setUncertain(null);
                    setConflict(true);
                    setError(
                        'Máy chủ có nội dung khác. Bản đang sửa vẫn được giữ để bạn đối chiếu.',
                    );
                }
            }
            cache.setQueryData(pageKeys.detail(user?.id || '', page.id), remote);
            void cache.invalidateQueries({ queryKey: bookKeys.all });
        } catch (cause) {
            if (currentSession() && !controller.signal.aborted) setError(errorMessage(cause));
        } finally {
            active.current = false;
            reading.current = null;
            if (currentSession()) setBusy(false);
        }
    }
    return {
        ...history,
        draft,
        setDraft,
        busy,
        dirty,
        conflict,
        uncertain: Boolean(uncertain),
        error,
        notice,
        warnings,
        save,
        readLatest,
    };
}
