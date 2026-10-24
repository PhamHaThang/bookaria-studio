import { ArrowDown, ArrowUp } from 'lucide-react';
import { useRef, useState } from 'react';
import { Field, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { NativeSelect } from '@/shared/ui/primitives/native-select';
import type { AssetRef } from '../../../shared/contracts/asset.schema';
import {
    type Action,
    findSceneReferenceIssues,
    type InteractionRule,
    InteractionRuleSchema,
    SCENE_LIMITS,
    type Scene,
    type Trigger,
} from '../../../shared/contracts/scene.schema';
import { Button } from '../../../shared/ui/Button';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';
import {
    actionLabels,
    appendAction,
    appendRule,
    copyRule,
    moveItem,
    newAction,
    newRule,
    removeAction,
    targetObjects,
    triggerLabels,
} from '../model/interactions';
import { InteractionActionEditor } from './InteractionActionEditor';
import { InteractionTarget } from './InteractionTarget';

export function InteractionEditor({
    scene,
    assets,
    disabled,
    onChange,
}: {
    scene: Scene;
    assets: Record<string, AssetRef>;
    disabled: boolean;
    onChange: (scene: Scene) => void;
}) {
    const actionKeys = useRef(new WeakMap<Action, string>());
    function actionKey(action: Action) {
        let key = actionKeys.current.get(action);
        if (!key) {
            key = crypto.randomUUID();
            actionKeys.current.set(action, key);
        }
        return key;
    }
    const [selectedId, setSelectedId] = useState(scene.interactions[0]?.id || '');
    const [deleting, setDeleting] = useState<InteractionRule | null>(null);
    const selected =
        scene.interactions.find((rule) => rule.id === selectedId) || scene.interactions[0];
    const issues = findSceneReferenceIssues(scene);
    const validation = selected ? InteractionRuleSchema.safeParse(selected) : null;
    const changeRules = (interactions: InteractionRule[]) => {
        if (!disabled) onChange({ ...scene, interactions });
    };
    const patch = (value: Partial<InteractionRule>) => {
        if (selected)
            changeRules(
                scene.interactions.map((rule) =>
                    rule.id === selected.id ? { ...selected, ...value } : rule,
                ),
            );
    };
    return (
        <section
            className="scene-interactions mt-6 border-t-[1px] border-t-border pt-5 [border-top-style:solid] [&_h3]:mx-0 [&_h3]:mt-0 [&_h3]:mb-3 [.workbench-panel_&]:m-0 [.workbench-panel_&]:border-0 [.workbench-panel_&]:border-[transparent] [.workbench-panel_&]:border-solid [.workbench-panel_&]:p-0"
            aria-labelledby="interaction-heading"
        >
            <div className="scene-heading flex flex-wrap items-start justify-between gap-4 [&_h2]:mx-0 [&_h2]:mt-0 [&_h2]:mb-2 [&_p]:m-0 [&_p]:text-muted-foreground">
                <div>
                    <h3 id="interaction-heading">Quy tắc tương tác</h3>
                    <p>
                        {scene.interactions.length} / {SCENE_LIMITS.maxRules} quy tắc. Lưu cùng nội
                        dung AR ở đầu trang.
                    </p>
                </div>
                <Button
                    variant="secondary"
                    disabled={disabled || scene.interactions.length >= SCENE_LIMITS.maxRules}
                    onClick={() => {
                        const rule = newRule(crypto.randomUUID());
                        changeRules(appendRule(scene.interactions, rule));
                        setSelectedId(rule.id);
                    }}
                >
                    Thêm quy tắc
                </Button>
            </div>
            <p className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]">
                Chọn sự kiện bắt đầu, rồi xếp các hành động theo thứ tự. Mở Xem trước để thử tương
                tác. Dùng “Chờ” để tạo khoảng nghỉ giữa các hành động.
            </p>
            {!scene.interactions.length && (
                <p>
                    Chưa có quy tắc. Thêm quy tắc đầu tiên, ví dụ khi chạm vùng chạm thì phát âm
                    thanh.
                </p>
            )}
            {issues.length > 0 && (
                <div className="scene-reference-error text-danger-foreground">
                    <p>
                        Có đích không còn phù hợp. Có thể lưu bản nháp; cần sửa trước khi xuất bản,
                        kể cả quy tắc đang tắt.
                    </p>
                    <ul>
                        {issues.map((issue) => (
                            <li key={`${issue.interactionId}-${issue.actionIndex ?? 'trigger'}`}>
                                <button
                                    type="button"
                                    className="interaction-issue-link cursor-pointer border-0 border-[transparent] border-solid bg-[transparent] px-0 py-2 text-left text-[inherit] underline"
                                    onClick={() => {
                                        setSelectedId(issue.interactionId);
                                        requestAnimationFrame(() =>
                                            document
                                                .getElementById(`rule-${issue.interactionId}`)
                                                ?.focus(),
                                        );
                                    }}
                                >
                                    {scene.interactions.find(
                                        (rule) => rule.id === issue.interactionId,
                                    )?.name || 'Quy tắc chưa đặt tên'}{' '}
                                    ·{' '}
                                    {issue.actionIndex === null
                                        ? 'Sự kiện'
                                        : `Hành động ${issue.actionIndex + 1}`}
                                    : {issue.message}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {selected && (
                <div className="interaction-workspace mt-5 grid grid-cols-[minmax(180px,_0.7fr)_minmax(0,_2fr)] items-start gap-6 max-[900px]:grid-cols-[1fr] min-[1100px]:[.scene-editor[data-panel=interactions]_&]:grid-cols-[140px_minmax(0,_1fr)] [.workbench-panel_&]:grid-cols-[minmax(0,_1fr)] [.workbench-panel_&]:gap-3">
                    <nav
                        className="interaction-list [&_button]:wrap-anywhere grid gap-2 [&_button:hover]:border-primary [&_button:hover]:bg-selected [&_button[aria-current=true]]:border-primary [&_button[aria-current=true]]:bg-selected [&_button]:cursor-pointer [&_button]:rounded-[var(--radius-sm)] [&_button]:border [&_button]:border-border [&_button]:border-solid [&_button]:bg-surface [&_button]:p-3 [&_button]:text-left [&_button]:text-foreground [&_span]:mt-1 [&_span]:block [&_span]:text-[length:var(--text-sm)] [&_strong]:block"
                        aria-label="Danh sách quy tắc"
                    >
                        {scene.interactions.map((rule, index) => (
                            <button
                                type="button"
                                key={rule.id}
                                aria-current={selected.id === rule.id ? 'true' : undefined}
                                onClick={() => setSelectedId(rule.id)}
                            >
                                <strong>
                                    {index + 1}. {rule.name || 'Quy tắc chưa đặt tên'}
                                </strong>
                                <span>
                                    {triggerLabels[rule.trigger.type]} · {rule.actions.length} hành
                                    động · {rule.enabled ? 'Bật' : 'Tắt'}
                                    {issues.some((issue) => issue.interactionId === rule.id)
                                        ? ' · Cần sửa đích'
                                        : ''}
                                    {!InteractionRuleSchema.safeParse(rule).success
                                        ? ' · Chưa hợp lệ'
                                        : ''}
                                </span>
                            </button>
                        ))}
                    </nav>
                    <section
                        className="interaction-detail wrap-anywhere min-w-0 [&_h4]:mx-0 [&_h4]:mt-0 [&_h4]:mb-4 [&_h4]:text-[length:var(--text-md)] [&_h5]:mx-0 [&_h5]:mt-6 [&_h5]:mb-4 [&_h5]:text-[length:var(--text-md)]"
                        key={selected.id}
                        aria-labelledby={`rule-${selected.id}`}
                    >
                        <h4 id={`rule-${selected.id}`} tabIndex={-1}>
                            Chỉnh quy tắc: {selected.name || 'Chưa đặt tên'}
                        </h4>
                        <fieldset
                            disabled={disabled}
                            className="interaction-rule-fields m-0 grid min-w-0 grid-cols-[repeat(2,_minmax(0,_1fr))] gap-4 border-0 border-[transparent] border-solid p-0 max-[600px]:grid-cols-[1fr] min-[1100px]:[.scene-editor[data-panel=interactions]_&]:grid-cols-[repeat(2,_minmax(0,_1fr))] [.workbench-panel_&]:grid-cols-[minmax(0,_1fr)] [.workbench-panel_&]:gap-3"
                        >
                            <Field orientation="contents">
                                <FieldLabel htmlFor={`rule-${selected.id}-name`}>
                                    Tên quy tắc
                                    <Input
                                        id={`rule-${selected.id}-name`}
                                        maxLength={100}
                                        value={selected.name || ''}
                                        onChange={(event) =>
                                            patch({ name: event.currentTarget.value })
                                        }
                                    />
                                </FieldLabel>
                            </Field>
                            <Field orientation="contents">
                                <FieldLabel className="checkbox m-0 flex items-center gap-2 font-normal [.asset-filter-actions_&]:mr-auto [.scene-inspector_>_&]:my-3 [.scene-object-fields_label:not(&)]:grid [.scene-object-fields_label:not(&)]:gap-2 [.scene-object-fields_label:not(&)]:font-medium [.scene-settings-fields_label:not(&)]:grid [.scene-settings-fields_label:not(&)]:gap-2 [.scene-settings-fields_label:not(&)]:font-medium">
                                    <input
                                        type="checkbox"
                                        checked={selected.enabled}
                                        onChange={(event) =>
                                            patch({ enabled: event.currentTarget.checked })
                                        }
                                    />
                                    Bật quy tắc
                                </FieldLabel>
                            </Field>
                            <Field orientation="contents">
                                <FieldLabel htmlFor={`rule-${selected.id}-trigger`}>
                                    Sự kiện
                                    <NativeSelect
                                        id={`rule-${selected.id}-trigger`}
                                        value={selected.trigger.type}
                                        onChange={(event) => {
                                            const type = event.currentTarget
                                                .value as Trigger['type'];
                                            patch({
                                                trigger:
                                                    type === 'onTap'
                                                        ? { type, objectId: '' }
                                                        : { type },
                                            });
                                        }}
                                    >
                                        {Object.entries(triggerLabels).map(([value, label]) => (
                                            <option key={value} value={value}>
                                                {label}
                                            </option>
                                        ))}
                                    </NativeSelect>
                                </FieldLabel>
                            </Field>
                            {selected.trigger.type === 'onTap' && (
                                <InteractionTarget
                                    id={`rule-${selected.id}-target`}
                                    value={selected.trigger.objectId}
                                    objects={targetObjects(scene.objects, 'onTap')}
                                    onChange={(objectId) =>
                                        patch({ trigger: { type: 'onTap', objectId } })
                                    }
                                />
                            )}
                            <Field orientation="contents">
                                <FieldLabel htmlFor={`rule-${selected.id}-retrigger`}>
                                    Khi sự kiện lặp lại lúc đang chạy
                                    <NativeSelect
                                        id={`rule-${selected.id}-retrigger`}
                                        value={selected.onRetrigger}
                                        onChange={(event) =>
                                            patch({
                                                onRetrigger: event.currentTarget
                                                    .value as InteractionRule['onRetrigger'],
                                            })
                                        }
                                    >
                                        <option value="ignore">Bỏ qua lần mới</option>
                                        <option value="restart">Chạy lại từ đầu</option>
                                    </NativeSelect>
                                </FieldLabel>
                            </Field>
                            <div className="form-actions interaction-wide col-[1_/_-1] mt-3 flex flex-wrap items-center gap-5 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-4 max-[760px]:[&_>_a]:text-center [.confirm-dialog_&]:mt-6 [.confirm-dialog_&]:justify-end max-[760px]:[.confirm-dialog_&]:flex-row max-[760px]:[.confirm-dialog_&]:flex-wrap [.image-editor_&:empty]:hidden [.scene-object-asset_&]:gap-2">
                                <Button
                                    variant="ghost"
                                    aria-label="Đưa quy tắc lên"
                                    disabled={scene.interactions[0].id === selected.id}
                                    onClick={() =>
                                        changeRules(
                                            moveItem(
                                                scene.interactions,
                                                scene.interactions.indexOf(selected),
                                                -1,
                                            ),
                                        )
                                    }
                                >
                                    <ArrowUp data-icon="inline-start" aria-hidden="true" />
                                    Lên
                                </Button>
                                <Button
                                    variant="ghost"
                                    aria-label="Đưa quy tắc xuống"
                                    disabled={scene.interactions.at(-1)?.id === selected.id}
                                    onClick={() =>
                                        changeRules(
                                            moveItem(
                                                scene.interactions,
                                                scene.interactions.indexOf(selected),
                                                1,
                                            ),
                                        )
                                    }
                                >
                                    <ArrowDown data-icon="inline-start" aria-hidden="true" />
                                    Xuống
                                </Button>
                                <Button
                                    variant="ghost"
                                    disabled={scene.interactions.length >= SCENE_LIMITS.maxRules}
                                    onClick={() => {
                                        const id = crypto.randomUUID();
                                        changeRules(copyRule(scene.interactions, selected.id, id));
                                        setSelectedId(id);
                                    }}
                                >
                                    Nhân bản quy tắc
                                </Button>
                                <Button variant="danger" onClick={() => setDeleting(selected)}>
                                    Xóa quy tắc
                                </Button>
                            </div>
                        </fieldset>
                        {validation && !validation.success && (
                            <p
                                role="alert"
                                className="scene-reference-error text-danger-foreground"
                            >
                                {validation.error.issues
                                    .map(
                                        (issue) =>
                                            `${issue.path[0] === 'actions' && typeof issue.path[1] === 'number' ? `Hành động ${issue.path[1] + 1}` : 'Quy tắc'} · ${issue.path.join('.')}: ${issue.message}`,
                                    )
                                    .join('; ')}
                            </p>
                        )}
                        <h5>
                            Hành động theo thứ tự ({selected.actions.length}/
                            {SCENE_LIMITS.maxActionsPerRule})
                        </h5>
                        <ol className="interaction-actions mx-0 mt-0 mb-4 list-none p-0 [&_>_li]:border-t-[1px] [&_>_li]:border-t-border [&_>_li]:[border-top-style:solid] [&_summary]:cursor-pointer [&_summary]:py-4 [&_summary]:font-semibold">
                            {selected.actions.map((action, index) => (
                                <li key={`${actionKey(action)}-${action.type}`}>
                                    <details open>
                                        <summary>
                                            Hành động {index + 1}: {actionLabels[action.type]}
                                        </summary>
                                        <div className="interaction-action-body grid gap-4 pb-5">
                                            <InteractionActionEditor
                                                id={`action-${selected.id}-${index}`}
                                                action={action}
                                                objects={scene.objects}
                                                assets={assets}
                                                disabled={disabled}
                                                onChange={(next) => {
                                                    actionKeys.current.set(next, actionKey(action));
                                                    patch({
                                                        actions: selected.actions.map((item, i) =>
                                                            i === index ? next : item,
                                                        ),
                                                    });
                                                }}
                                            />
                                            <div className="form-actions mt-3 flex flex-wrap items-center gap-5 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-4 max-[760px]:[&_>_a]:text-center [.confirm-dialog_&]:mt-6 [.confirm-dialog_&]:justify-end max-[760px]:[.confirm-dialog_&]:flex-row max-[760px]:[.confirm-dialog_&]:flex-wrap [.image-editor_&:empty]:hidden [.scene-object-asset_&]:gap-2">
                                                <Button
                                                    variant="ghost"
                                                    disabled={disabled || index === 0}
                                                    aria-label={`Đưa hành động ${index + 1} lên`}
                                                    onClick={() =>
                                                        patch({
                                                            actions: moveItem(
                                                                selected.actions,
                                                                index,
                                                                -1,
                                                            ),
                                                        })
                                                    }
                                                >
                                                    <ArrowUp
                                                        data-icon="inline-start"
                                                        aria-hidden="true"
                                                    />
                                                    Lên
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    disabled={
                                                        disabled ||
                                                        index === selected.actions.length - 1
                                                    }
                                                    aria-label={`Đưa hành động ${index + 1} xuống`}
                                                    onClick={() =>
                                                        patch({
                                                            actions: moveItem(
                                                                selected.actions,
                                                                index,
                                                                1,
                                                            ),
                                                        })
                                                    }
                                                >
                                                    <ArrowDown
                                                        data-icon="inline-start"
                                                        aria-hidden="true"
                                                    />
                                                    Xuống
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    disabled={
                                                        disabled || selected.actions.length === 1
                                                    }
                                                    aria-label={`Xóa hành động ${index + 1}`}
                                                    onClick={() =>
                                                        patch({
                                                            actions: removeAction(
                                                                selected.actions,
                                                                index,
                                                            ),
                                                        })
                                                    }
                                                >
                                                    Xóa hành động
                                                </Button>
                                            </div>
                                        </div>
                                    </details>
                                </li>
                            ))}
                        </ol>
                        <Button
                            variant="secondary"
                            disabled={
                                disabled ||
                                selected.actions.length >= SCENE_LIMITS.maxActionsPerRule
                            }
                            onClick={() =>
                                patch({
                                    actions: appendAction(selected.actions, newAction('wait')),
                                })
                            }
                        >
                            Thêm hành động
                        </Button>
                        <p className="field-hint mt-2 block font-normal text-[length:var(--text-xs)] text-muted-foreground leading-[var(--leading-normal)] [.asset-metadata-form_&]:mx-0 [.asset-metadata-form_&]:mt-[calc(-1_*_var(--space-3))] [.asset-metadata-form_&]:mb-5 [.asset-upload-form_&:last-child]:mt-[calc(-1_*_var(--space-3))] [.asset-upload-form_&]:mx-0 [.asset-upload-form_&]:mt-2 [.asset-upload-form_&]:mb-5 max-[1200px]:[.scene-object-fields_>_&]:col-[1_/_-1] [.workbench-panel_&]:text-[length:11px]">
                            Mỗi quy tắc cần ít nhất một hành động. Các giá trị thời gian tính bằng
                            mili giây (1000 ms = 1 giây).
                        </p>
                    </section>
                </div>
            )}
            {deleting && (
                <ConfirmDialog
                    title="Xóa quy tắc tương tác?"
                    busy={disabled}
                    onClose={() => setDeleting(null)}
                >
                    <p>
                        Quy tắc “{deleting.name || 'Chưa đặt tên'}” cùng các hành động sẽ bị bỏ khỏi
                        bản đang sửa.
                    </p>
                    <div className="form-actions mt-3 flex flex-wrap items-center gap-5 max-[760px]:flex-col max-[760px]:items-stretch max-[760px]:gap-4 max-[760px]:[&_>_a]:text-center [.confirm-dialog_&]:mt-6 [.confirm-dialog_&]:justify-end max-[760px]:[.confirm-dialog_&]:flex-row max-[760px]:[.confirm-dialog_&]:flex-wrap [.image-editor_&:empty]:hidden [.scene-object-asset_&]:gap-2">
                        <Button
                            variant="secondary"
                            disabled={disabled}
                            onClick={() => setDeleting(null)}
                        >
                            Giữ quy tắc
                        </Button>
                        <Button
                            variant="danger"
                            disabled={disabled}
                            onClick={() => {
                                changeRules(
                                    scene.interactions.filter((rule) => rule.id !== deleting.id),
                                );
                                setDeleting(null);
                            }}
                        >
                            Xác nhận xóa quy tắc
                        </Button>
                    </div>
                </ConfirmDialog>
            )}
        </section>
    );
}
