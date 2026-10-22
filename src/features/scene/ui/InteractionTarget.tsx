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
        <label htmlFor={id}>
            Đối tượng đích
            <select
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
            </select>
            {!objects.length && (
                <span id={`${id}-hint`} className="field-hint">
                    Thêm đối tượng đúng loại vào trang để chọn.
                </span>
            )}
        </label>
    );
}
