import type { AssetRef } from '@/shared/contracts/asset.schema';
import type { InteractionRule, Scene } from '@/shared/contracts/scene.schema';
import { Checkbox } from '@/shared/ui/primitives/checkbox';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { actionTitle } from '../model/interaction-palette';
import type { InteractionTemplateId } from '../model/interaction-templates';
import { actionSummary, updateTemplateActions } from '../model/interaction-templates';
import { memoryDefinitions, memorySummary } from '../model/memory-variables';
import { InteractionActionEditor } from './InteractionActionEditor';
import { MemoryContext, useMemory } from './MemoryContext';
import { WorkflowTriggerFields } from './WorkflowFields';

/** Templates retain the same schema as manually authored flows, including their branch edges. */
export function InteractionTemplateSetup({
    template,
    rule,
    scene,
    assets,
    disabled,
    hideTargetId,
    onHideTarget,
    onChange,
}: {
    template: InteractionTemplateId;
    rule: InteractionRule;
    scene: Scene;
    assets: Record<string, AssetRef>;
    disabled: boolean;
    hideTargetId?: string;
    onHideTarget: (id?: string) => void;
    onChange: (rule: InteractionRule) => void;
}) {
    const memory = useMemory();
    const draftScene = {
        ...scene,
        interactions: [...scene.interactions.filter((item) => item.id !== rule.id), rule],
    };
    const definitions = memoryDefinitions(memory.definitions, [draftScene]);
    const indices = rule.actions.flatMap((action, index) => {
        if (action.type === 'wait' && (action.ms === 0 || template === 'focus')) return [];
        if (action.type === 'setState' && ['quiz', 'once', 'unlock', 'count'].includes(template))
            return [];
        if (action.type === 'condition' && ['quiz', 'once'].includes(template)) return [];
        if (template === 'focus' && index === 2) return [];
        return [index];
    });
    const target = rule.actions.find(
        (action) =>
            (action.type === 'setVisible' && action.value) || action.type === 'toggleVisible',
    );
    const targetId = target && 'objectId' in target ? target.objectId : undefined;
    const alreadyHidden = scene.objects.find((object) => object.id === targetId)?.visible === false;
    const canHide =
        !!targetId && !(rule.trigger.type === 'onTap' && rule.trigger.objectId === targetId);
    return (
        <MemoryContext.Provider value={{ ...memory, definitions, canCreate: false }}>
            <div className="flex flex-col gap-6">
                <FieldGroup>
                    <Field>
                        <FieldLabel htmlFor="template-name">Tên tương tác</FieldLabel>
                        <Input
                            id="template-name"
                            value={rule.name || ''}
                            maxLength={100}
                            disabled={disabled}
                            onChange={(event) => onChange({ ...rule, name: event.target.value })}
                        />
                    </Field>
                    <WorkflowTriggerFields
                        trigger={rule.trigger}
                        scene={draftScene}
                        assets={assets}
                        disabled={disabled}
                        onChange={(trigger) => {
                            const actions = rule.actions.map((action) =>
                                action.type === 'condition' &&
                                action.test.type === 'interactionCount' &&
                                trigger.type === 'onTap'
                                    ? {
                                          ...action,
                                          test: { ...action.test, objectId: trigger.objectId },
                                      }
                                    : action,
                            );
                            onChange({ ...rule, trigger, actions });
                            if (trigger.type === 'onTap' && trigger.objectId === hideTargetId)
                                onHideTarget(undefined);
                        }}
                    />
                </FieldGroup>
                {indices.map((index, order) => (
                    <section
                        key={index}
                        aria-label={`Thiết lập mẫu bước ${order + 1}`}
                        className="border-border border-t pt-5"
                    >
                        <h3 className="mt-0 mb-3 font-medium text-sm">
                            {order + 1}. {actionTitle(rule.actions[index])}
                        </h3>
                        <InteractionActionEditor
                            action={rule.actions[index]}
                            scene={draftScene}
                            objects={scene.objects}
                            assets={assets}
                            id={`template-action-${index}`}
                            disabled={disabled}
                            hideOperation
                            onChange={(action) => {
                                const next = rule.actions.map((item, at) =>
                                    at === index ? action : item,
                                );
                                const actions = updateTemplateActions(
                                    template,
                                    rule.actions,
                                    next,
                                    scene.objects,
                                );
                                onChange({ ...rule, actions });
                                if (
                                    target &&
                                    index === rule.actions.indexOf(target) &&
                                    'objectId' in action &&
                                    action.objectId !== targetId
                                )
                                    onHideTarget(undefined);
                            }}
                        />
                    </section>
                ))}
                {canHide && alreadyHidden && (
                    <p className="m-0 text-muted-foreground text-xs">
                        Nội dung này đã ẩn khi mở trang.
                    </p>
                )}
                {canHide && !alreadyHidden && (
                    <Field orientation="horizontal">
                        <Checkbox
                            id="template-hide-target"
                            checked={hideTargetId === targetId}
                            disabled={disabled}
                            onCheckedChange={(value) =>
                                onHideTarget(value === true ? targetId : undefined)
                            }
                        />
                        <FieldLabel htmlFor="template-hide-target">
                            Ẩn nội dung này khi mở trang
                        </FieldLabel>
                    </Field>
                )}
                <section
                    aria-label="Các bước mẫu tự chuẩn bị"
                    className="flex flex-col gap-3 border-border border-t pt-4"
                >
                    <h3 className="m-0 font-medium text-sm">Các bước mẫu tự chuẩn bị</h3>
                    <ol className="m-0 flex list-decimal flex-col gap-2 pl-5 text-muted-foreground text-xs leading-5">
                        {rule.actions.map((action, index) => (
                            // biome-ignore lint/suspicious/noArrayIndexKey: Template topology is fixed; this list only summarizes parameter edits.
                            <li key={`${index}-${action.type}`}>
                                {memorySummary(action, definitions) ||
                                    actionSummary(action, scene.objects)}
                            </li>
                        ))}
                    </ol>
                </section>
            </div>
        </MemoryContext.Provider>
    );
}
