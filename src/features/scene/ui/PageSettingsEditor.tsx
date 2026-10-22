import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '../../../shared/api/errors';
import type { Asset, Page } from '../../../shared/contracts/dto.schema';
import { type PageSettings, PageSettingsSchema } from '../../../shared/contracts/scene.schema';
import { Button } from '../../../shared/ui/Button';
import { Feedback } from '../../../shared/ui/Feedback';
import { assetKeys } from '../../assets';
import { auth, useAuth } from '../../auth';
import { bookKeys } from '../../books';
import { pageKeys, pagesApi } from '../../pages';
import { settingsPatch } from '../model/objects';
import { AssetPicker } from './AssetPicker';

export function PageSettingsEditor({
    page,
    disabled,
    onDirtyChange,
    onBusyChange,
}: {
    page: Page;
    disabled: boolean;
    onDirtyChange: (dirty: boolean) => void;
    onBusyChange: (busy: boolean) => void;
}) {
    const { user } = useAuth(),
        cache = useQueryClient();
    const [base, setBase] = useState(page.settings),
        [draft, setDraft] = useState(page.settings),
        [busy, setBusy] = useState(false);
    const [picker, setPicker] = useState<'backgroundAudioAssetId' | 'narrationAssetId' | null>(
            null,
        ),
        [chosen, setChosen] = useState<Record<string, Asset>>({});
    const [error, setError] = useState<string | null>(null),
        [notice, setNotice] = useState<string | null>(null);
    const guard = useRef(false),
        alive = useRef(true);
    const patch = settingsPatch(base, draft),
        dirty = Object.keys(patch).length > 0;
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);
    useEffect(() => {
        onDirtyChange(dirty);
        return () => onDirtyChange(false);
    }, [dirty, onDirtyChange]);
    useEffect(() => {
        onBusyChange(busy);
        return () => onBusyChange(false);
    }, [busy, onBusyChange]);
    useEffect(() => {
        if (!dirty && !busy) {
            setBase(page.settings);
            setDraft(page.settings);
        }
    }, [page.settings, dirty, busy]);
    function update<K extends keyof PageSettings>(key: K, value: PageSettings[K]) {
        setDraft((current) => ({ ...current, [key]: value }));
        setNotice(null);
    }
    return (
        <section className="scene-settings" aria-labelledby="page-settings-title">
            <h3 id="page-settings-title">Âm thanh và ánh sáng của trang</h3>
            <Feedback error={error} success={notice} />
            <fieldset disabled={disabled || busy} className="scene-settings-fields">
                {(['backgroundAudioAssetId', 'narrationAssetId'] as const).map((key) => (
                    <div key={key}>
                        <h4>
                            {key === 'backgroundAudioAssetId' ? 'Âm thanh nền' : 'Lời thuyết minh'}
                        </h4>
                        <p>
                            {draft[key]
                                ? chosen[draft[key]]?.name ||
                                  (draft[key] === base[key]
                                      ? 'Đã gắn âm thanh'
                                      : 'Âm thanh đã chọn')
                                : 'Chưa chọn âm thanh'}
                        </p>
                        {draft[key] &&
                            (chosen[draft[key]]?.url || page.assets[draft[key]]?.url) && (
                                <audio
                                    controls
                                    preload="none"
                                    src={chosen[draft[key]]?.url || page.assets[draft[key]]?.url}
                                >
                                    <track kind="captions" />
                                </audio>
                            )}
                        <div className="form-actions">
                            <Button variant="secondary" onClick={() => setPicker(key)}>
                                {key === 'backgroundAudioAssetId'
                                    ? 'Chọn âm thanh nền'
                                    : 'Chọn lời thuyết minh'}
                            </Button>
                            <Button
                                variant="ghost"
                                disabled={!draft[key]}
                                onClick={() => update(key, null)}
                            >
                                Bỏ âm thanh
                            </Button>
                        </div>
                    </div>
                ))}
                <label className="checkbox">
                    <input
                        type="checkbox"
                        checked={draft.backgroundLoop}
                        onChange={(event) => update('backgroundLoop', event.currentTarget.checked)}
                    />
                    Lặp âm thanh nền
                </label>
                <label htmlFor="scene-lighting">
                    Ánh sáng
                    <select
                        id="scene-lighting"
                        value={draft.lighting}
                        onChange={(event) =>
                            update(
                                'lighting',
                                event.currentTarget.value as PageSettings['lighting'],
                            )
                        }
                    >
                        <option value="neutral">Trung tính</option>
                        <option value="warm">Ấm</option>
                        <option value="cool">Lạnh</option>
                    </select>
                </label>
            </fieldset>
            <div className="form-actions">
                <Button
                    loading={busy}
                    disabled={disabled || !dirty}
                    onClick={async () => {
                        if (disabled || guard.current || !dirty) return;
                        guard.current = true;
                        setBusy(true);
                        setError(null);
                        setNotice(null);
                        try {
                            const parsed = PageSettingsSchema.parse(draft);
                            const delta = settingsPatch(base, parsed);
                            await pagesApi.update(page.id, { settings: delta });
                            if (!alive.current || auth.store.getState().user?.id !== user?.id)
                                return;
                            setBase(parsed);
                            setDraft(parsed);
                            cache.setQueryData<Page>(
                                pageKeys.detail(user?.id || '', page.id),
                                (current) =>
                                    current
                                        ? {
                                              ...current,
                                              settings: { ...current.settings, ...delta },
                                          }
                                        : current,
                            );
                            setNotice('Đã lưu cài đặt âm thanh và ánh sáng.');
                            await Promise.all([
                                cache.invalidateQueries({ queryKey: pageKeys.all }),
                                cache.invalidateQueries({ queryKey: bookKeys.all }),
                                cache.invalidateQueries({ queryKey: assetKeys.all }),
                            ]);
                        } catch (cause) {
                            if (alive.current) setError(errorMessage(cause));
                        } finally {
                            guard.current = false;
                            if (alive.current) setBusy(false);
                        }
                    }}
                >
                    Lưu cài đặt trang
                </Button>
                <Button
                    variant="ghost"
                    disabled={disabled || busy || !dirty}
                    onClick={() => {
                        setDraft(base);
                        setError(null);
                        setNotice(null);
                    }}
                >
                    Bỏ thay đổi cài đặt
                </Button>
            </div>
            {picker && (
                <AssetPicker
                    type="AUDIO"
                    onClose={() => setPicker(null)}
                    onChoose={(asset) => {
                        setChosen((current) => ({ ...current, [asset.id]: asset }));
                        update(picker, asset.id);
                        setPicker(null);
                    }}
                />
            )}
        </section>
    );
}
