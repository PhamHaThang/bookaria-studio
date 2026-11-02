import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, type Ref, useEffect, useEffectEvent, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth';
import { errorMessage } from '@/shared/api/errors';
import type { Asset } from '@/shared/contracts/dto.schema';
import { AUDIO_TAG_OPTIONS, audioKindFromTags } from '@/shared/scene/audio-kind';
import { FormSelect } from '@/shared/ui/FormSelect';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { assetKeys, assetsApi } from '../model/assets';
import { updateAssetForm } from '../model/form';

function assetFields(asset: Asset) {
    return {
        name: asset.name,
        tags:
            asset.type === 'AUDIO'
                ? audioKindFromTags(asset.tags).toLowerCase()
                : asset.tags.join(', '),
        authorName: asset.authorName || '',
        license: asset.license || '',
        sourceUrl: asset.sourceUrl || '',
    };
}

export function AssetMetadataEditor({
    asset,
    formId,
    formRef,
    onStateChange,
    onSaved,
}: {
    asset: Asset;
    formId: string;
    formRef: Ref<HTMLFormElement>;
    onStateChange: (state: { dirty: boolean; saving: boolean }) => void;
    onSaved: () => void;
}) {
    const initial = useRef(assetFields(asset)).current;
    const [fields, setFields] = useState(initial);
    const [saving, setSaving] = useState(false);
    const pending = useRef(false);
    const cache = useQueryClient();
    const { user } = useAuth();
    const dirty = Object.keys(initial).some(
        (key) => fields[key as keyof typeof fields] !== initial[key as keyof typeof initial],
    );
    const notify = useEffectEvent(onStateChange);
    useEffect(() => {
        notify({ dirty, saving });
    }, [dirty, saving]);
    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (pending.current || !dirty) return;
        const data = new FormData(event.currentTarget);
        pending.current = true;
        setSaving(true);
        try {
            const saved = await assetsApi.update(asset.id, updateAssetForm(data));
            cache.setQueryData(assetKeys.detail(user?.id || '', asset.id), saved);
            void cache.invalidateQueries({ queryKey: assetKeys.all });
            toast.success('Đã lưu thông tin tài nguyên.');
            onSaved();
        } catch (cause) {
            toast.error(errorMessage(cause));
        } finally {
            pending.current = false;
            setSaving(false);
        }
    }
    function field(name: keyof typeof fields) {
        return {
            name,
            value: fields[name],
            onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                const value = event.currentTarget.value;
                setFields((current) => ({ ...current, [name]: value }));
            },
        };
    }
    return (
        <form
            ref={formRef}
            id={formId}
            onSubmit={(event) => void save(event)}
            aria-label="Chỉnh sửa thông tin tài nguyên"
            aria-busy={saving}
        >
            <fieldset disabled={saving} className="m-0 min-w-0 border-0 p-0">
                <FieldGroup className="gap-5 [&_[data-slot=field-label]]:mb-0 [&_[data-slot=input]]:mt-0">
                    <Field>
                        <FieldLabel htmlFor={`${formId}-name`}>
                            Tên tài nguyên <span aria-hidden="true">*</span>
                        </FieldLabel>
                        <Input id={`${formId}-name`} {...field('name')} required maxLength={150} />
                    </Field>
                    <Field>
                        <FieldLabel htmlFor={`${formId}-tags`}>
                            {asset.type === 'AUDIO' ? 'Loại âm thanh' : 'Nhãn'}
                        </FieldLabel>
                        {asset.type === 'AUDIO' ? (
                            <FormSelect
                                id={`${formId}-tags`}
                                name="tags"
                                value={fields.tags}
                                onValueChange={(tags) =>
                                    setFields((current) => ({ ...current, tags }))
                                }
                                options={AUDIO_TAG_OPTIONS}
                            />
                        ) : (
                            <>
                                <Input
                                    id={`${formId}-tags`}
                                    {...field('tags')}
                                    aria-describedby={`${formId}-tags-hint`}
                                />
                                <FieldDescription id={`${formId}-tags-hint`}>
                                    Phân cách bằng dấu phẩy (tối đa 20 nhãn).
                                </FieldDescription>
                            </>
                        )}
                    </Field>
                    <Field>
                        <FieldLabel htmlFor={`${formId}-author`}>Tác giả</FieldLabel>
                        <Input id={`${formId}-author`} {...field('authorName')} maxLength={150} />
                    </Field>
                    <Field>
                        <FieldLabel htmlFor={`${formId}-license`}>Giấy phép</FieldLabel>
                        <Input id={`${formId}-license`} {...field('license')} maxLength={50} />
                    </Field>
                    <Field>
                        <FieldLabel htmlFor={`${formId}-source`}>Đường dẫn nguồn</FieldLabel>
                        <Input
                            id={`${formId}-source`}
                            {...field('sourceUrl')}
                            type="url"
                            placeholder="https://"
                        />
                    </Field>
                </FieldGroup>
            </fieldset>
        </form>
    );
}
