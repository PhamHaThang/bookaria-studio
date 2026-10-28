import type { InteractionRule, SceneObject } from '@/shared/contracts/scene.schema';
import { FormSelect } from '@/shared/ui/FormSelect';
import { Field, FieldLabel } from '@/shared/ui/primitives/field';
import type { InteractionScope } from '../model/interaction-scope';
import { objectLabels } from '../model/objects';

export function InteractionScopeFilter({
    scope,
    objects,
    rules,
    onChange,
}: {
    scope: InteractionScope;
    objects: SceneObject[];
    rules: InteractionRule[];
    onChange: (scope: InteractionScope) => void;
}) {
    const missing = [
        ...new Set(
            rules.flatMap(({ trigger }) =>
                trigger.type === 'onTap' &&
                trigger.objectId &&
                !objects.some((object) => object.id === trigger.objectId)
                    ? [trigger.objectId]
                    : [],
            ),
        ),
    ];
    return (
        <div className="grid min-w-0 gap-3">
            <Field>
                <FieldLabel htmlFor="interaction-scope">Phạm vi quy tắc</FieldLabel>
                <FormSelect
                    id="interaction-scope"
                    value={scope.type}
                    onValueChange={(type) =>
                        onChange(
                            type === 'object'
                                ? { type, objectId: '' }
                                : { type: type as 'all' | 'page' },
                        )
                    }
                    options={[
                        { value: 'all', label: `Tất cả quy tắc (${rules.length})` },
                        {
                            value: 'page',
                            label: `Sự kiện của trang (${rules.filter((rule) => rule.trigger.type !== 'onTap').length})`,
                        },
                        {
                            value: 'object',
                            label: `Theo đối tượng (${rules.filter((rule) => rule.trigger.type === 'onTap').length})`,
                        },
                    ]}
                />
            </Field>
            {scope.type === 'object' && (
                <Field>
                    <FieldLabel htmlFor="interaction-scope-object">Đối tượng bắt đầu</FieldLabel>
                    <FormSelect
                        id="interaction-scope-object"
                        value={scope.objectId}
                        onValueChange={(objectId) => onChange({ type: 'object', objectId })}
                        options={[
                            { value: '', label: 'Chọn đối tượng để xem quy tắc' },
                            ...objects
                                .filter((object) => object.type !== 'audio')
                                .map((object) => ({
                                    value: object.id,
                                    label: object.name || objectLabels[object.type],
                                })),
                            ...missing.map((id) => ({
                                value: id,
                                label: `Đối tượng đã xóa · ${id}`,
                            })),
                        ]}
                    />
                </Field>
            )}
        </div>
    );
}
