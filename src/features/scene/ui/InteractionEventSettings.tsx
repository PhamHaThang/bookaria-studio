import { useId } from 'react';
import type { AssetRef } from '@/shared/contracts/asset.schema';
import type { InteractionRule, Scene, Trigger } from '@/shared/contracts/scene.schema';
import { FieldLabel } from '@/shared/ui/primitives/field';
import { triggerLabels } from '../model/interactions';
import { InteractionChoices } from './InteractionChoices';
import { WorkflowTriggerFields } from './WorkflowFields';

const eventTypes = [
    'onPageEnter',
    'onPageLeave',
    'onMarkerFound',
    'onMarkerLost',
    'onTap',
    'onAnimationEnd',
    'onAnswer',
    'onStateCondition',
] satisfies Trigger['type'][];
const eventOptions = eventTypes.map((value) => ({ value, label: triggerLabels[value] }));

const retriggerOptions = [
    {
        value: 'ignore',
        label: 'Bỏ qua lần kích hoạt mới',
        description: 'Lượt hiện tại tiếp tục chạy.',
    },
    {
        value: 'restart',
        label: 'Chạy lại từ đầu',
        description: 'Dừng lượt hiện tại và bắt đầu lượt mới.',
    },
] as const;

export function InteractionEventSettings({
    assets,
    rule,
    scene,
    disabled,
    onTriggerTypeChange,
    onChange,
}: {
    assets: Record<string, AssetRef>;
    rule: InteractionRule;
    scene: Scene;
    disabled: boolean;
    onTriggerTypeChange: (type: Trigger['type']) => void;
    onChange: (rule: InteractionRule) => void;
}) {
    const id = useId();
    return (
        <div className="flex min-w-0 flex-col gap-4">
            <div className="flex min-w-0 flex-col gap-3">
                <InteractionChoices
                    label="Loại sự kiện"
                    value={rule.trigger.type}
                    options={eventOptions}
                    disabled={disabled}
                    onChange={onTriggerTypeChange}
                />
                <WorkflowTriggerFields
                    assets={assets}
                    trigger={rule.trigger}
                    scene={scene}
                    disabled={disabled}
                    configuredInGraph
                    onChange={(trigger) => onChange({ ...rule, trigger })}
                />
            </div>
            <div>
                <fieldset className="flex flex-col gap-2" disabled={disabled}>
                    <legend className="mb-2.5 font-medium text-sm leading-5">
                        Khi sự kiện xảy ra lần nữa
                    </legend>
                    {retriggerOptions.map(({ value, label, description }) => {
                        const optionId = `${id}-${value}`;
                        return (
                            <FieldLabel
                                key={value}
                                htmlFor={optionId}
                                data-disabled={disabled || undefined}
                                className="m-0 flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-2.5 hover:bg-hover has-checked:border-input has-checked:bg-muted data-[disabled=true]:cursor-not-allowed"
                            >
                                <input
                                    type="radio"
                                    data-slot="radio"
                                    id={optionId}
                                    name={`${id}-retrigger`}
                                    value={value}
                                    checked={rule.onRetrigger === value}
                                    aria-labelledby={`${optionId}-label`}
                                    aria-describedby={`${optionId}-description`}
                                    className="mt-0.5 size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                                    onChange={() => onChange({ ...rule, onRetrigger: value })}
                                />
                                <span className="flex min-w-0 flex-col gap-0.5">
                                    <span id={`${optionId}-label`} className="leading-5">
                                        {label}
                                    </span>
                                    <span
                                        id={`${optionId}-description`}
                                        className="font-normal text-muted-foreground text-xs leading-5"
                                    >
                                        {description}
                                    </span>
                                </span>
                            </FieldLabel>
                        );
                    })}
                </fieldset>
            </div>
        </div>
    );
}
