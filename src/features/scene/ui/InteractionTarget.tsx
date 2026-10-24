import { FormSelect } from '@/shared/ui/FormSelect';
import { Field, FieldLabel } from '@/shared/ui/primitives/field';
import type { SceneObject } from '../../../shared/contracts/scene.schema';
import { objectLabels } from '../model/objects';

export function InteractionTarget({
    id,
    value,
    objects,
    onChange,
}: {
    id: string;
    value: string;
    objects: SceneObject[];
    onChange: (id: string) => void;
}) {
    const missing = Boolean(value) && !objects.some((object) => object.id === value);
    return (
        <Field orientation="contents" data-invalid={missing || !value}>
            <FieldLabel htmlFor={id}>
                Đối tượng đích
                <FormSelect
                    id={id}
                    aria-label="Đối tượng đích"
                    aria-describedby={!objects.length ? `${id}-hint` : undefined}
                    value={value}
                    aria-invalid={missing || !value}
                    onValueChange={(value) => onChange(value)}
                    options={[
                        { value: '', label: 'Chọn đối tượng' },
                        ...(missing
                            ? [{ value: value, label: <>Đích không còn phù hợp: {value}</> }]
                            : []),
                        ...(objects.map((object) => ({
                            value: object.id,
                            label: (
                                <>
                                    {object.name || objectLabels[object.type]} ·{' '}
                                    {objectLabels[object.type]}
                                </>
                            ),
                        })) ?? []),
                    ]}
                />
                {!objects.length && (
                    <span
                        id={`${id}-hint`}
                        className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]"
                    >
                        Thêm đối tượng đúng loại vào trang để chọn.
                    </span>
                )}
            </FieldLabel>
        </Field>
    );
}
