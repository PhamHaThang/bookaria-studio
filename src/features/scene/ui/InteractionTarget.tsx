import { Field, FieldLabel } from '@/shared/ui/primitives/field';
import { NativeSelect } from '@/shared/ui/primitives/native-select';
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
                <NativeSelect
                    id={id}
                    aria-label="Đối tượng đích"
                    aria-describedby={!objects.length ? `${id}-hint` : undefined}
                    value={value}
                    aria-invalid={missing || !value}
                    onChange={(event) => onChange(event.currentTarget.value)}
                >
                    <option value="">Chọn đối tượng</option>
                    {missing && <option value={value}>Đích không còn phù hợp: {value}</option>}
                    {objects.map((object) => (
                        <option key={object.id} value={object.id}>
                            {object.name || objectLabels[object.type]} · {objectLabels[object.type]}
                        </option>
                    ))}
                </NativeSelect>
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
