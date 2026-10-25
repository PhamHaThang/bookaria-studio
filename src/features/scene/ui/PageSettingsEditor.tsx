import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { FormSelect } from '@/shared/ui/FormSelect';
import { Checkbox } from '@/shared/ui/primitives/checkbox';
import { Field, FieldLabel } from '@/shared/ui/primitives/field';
import { Spinner } from '@/shared/ui/primitives/spinner';
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
        <section
            className="scene-settings mt-6 border-t-[1px] border-t-border pt-5 [border-top-style:solid] [&_h3]:mx-0 [&_h3]:mt-0 [&_h3]:mb-3 [.workbench-panel_&]:m-0 [.workbench-panel_&]:border-0 [.workbench-panel_&]:border-[transparent] [.workbench-panel_&]:border-solid [.workbench-panel_&]:p-0"
            aria-labelledby="page-settings-title"
        >
            <h3 id="page-settings-title">Âm thanh và ánh sáng của trang</h3>
            <Feedback error={error} success={notice} />
            <fieldset
                disabled={disabled || busy}
                className="scene-settings-fields mx-0 mt-0 mb-4 grid min-w-0 grid-cols-[repeat(2,_minmax(0,_1fr))] gap-4 border-0 border-[transparent] border-solid p-0 max-[600px]:grid-cols-[1fr] [&_[data-slot=select-trigger]]:w-full [&_[data-slot=select-trigger]]:min-w-0 [&_h4]:mx-0 [&_h4]:mt-0 [&_h4]:mb-2 [.workbench-panel_&]:gap-[14px]"
            >
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
                        <div className="form-actions mt-3 flex flex-wrap items-center gap-5 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-4 max-[760px]:[&_>_a]:text-center [.confirm-dialog_&]:mt-6 [.confirm-dialog_&]:justify-end max-[760px]:[.confirm-dialog_&]:flex-row max-[760px]:[.confirm-dialog_&]:flex-wrap [.image-editor_&:empty]:hidden [.scene-object-asset_&]:gap-2">
                            <Button variant="secondary" onClick={() => setPicker(key)}>
                                {key === 'backgroundAudioAssetId'
                                    ? 'Chọn âm thanh nền'
                                    : 'Chọn lời thuyết minh'}
                            </Button>
                            <Button
                                variant="outline"
                                disabled={!draft[key]}
                                onClick={() => update(key, null)}
                            >
                                Bỏ âm thanh
                            </Button>
                        </div>
                    </div>
                ))}
                <Field orientation="contents">
                    <FieldLabel className="checkbox m-0 flex items-center gap-2 font-normal [.asset-filter-actions_&]:mr-auto [.scene-inspector_>_&]:my-3 [.scene-object-fields_label:not(&)]:grid [.scene-object-fields_label:not(&)]:gap-2 [.scene-object-fields_label:not(&)]:font-medium [.scene-settings-fields_label:not(&)]:grid [.scene-settings-fields_label:not(&)]:gap-2 [.scene-settings-fields_label:not(&)]:font-medium">
                        <Checkbox
                            checked={draft.backgroundLoop}
                            onCheckedChange={(checked) =>
                                update('backgroundLoop', checked === true)
                            }
                        />
                        Lặp âm thanh nền
                    </FieldLabel>
                </Field>
                <Field orientation="contents">
                    <FieldLabel htmlFor="scene-lighting">
                        Ánh sáng
                        <FormSelect
                            id="scene-lighting"
                            value={draft.lighting}
                            onValueChange={(value) =>
                                update('lighting', value as PageSettings['lighting'])
                            }
                            options={[
                                { value: 'neutral', label: 'Trung tính' },
                                { value: 'warm', label: 'Ấm' },
                                { value: 'cool', label: 'Lạnh' },
                            ]}
                        />
                    </FieldLabel>
                </Field>
            </fieldset>
            <div className="form-actions mt-3 flex flex-wrap items-center gap-5 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-4 max-[760px]:[&_>_a]:text-center [.confirm-dialog_&]:mt-6 [.confirm-dialog_&]:justify-end max-[760px]:[.confirm-dialog_&]:flex-row max-[760px]:[.confirm-dialog_&]:flex-wrap [.image-editor_&:empty]:hidden [.scene-object-asset_&]:gap-2">
                <Button
                    aria-busy={busy}
                    disabled={disabled || !dirty || busy}
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
                    {busy && <Spinner data-icon="inline-start" aria-hidden="true" />}
                    Lưu cài đặt trang
                </Button>
                <Button
                    variant="outline"
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
