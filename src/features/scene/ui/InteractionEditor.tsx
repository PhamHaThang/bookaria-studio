import { ArrowDown, ArrowUp } from 'lucide-react';
import { useRef, useState } from 'react';
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
import './interactions.css';

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
        <section className="scene-interactions" aria-labelledby="interaction-heading">
            <div className="scene-heading">
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
            <p className="field-hint">
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
                <div className="scene-reference-error">
                    <p>
                        Có đích không còn phù hợp. Có thể lưu bản nháp; cần sửa trước khi xuất bản,
                        kể cả quy tắc đang tắt.
                    </p>
                    <ul>
                        {issues.map((issue) => (
                            <li key={`${issue.interactionId}-${issue.actionIndex ?? 'trigger'}`}>
                                <button
                                    type="button"
                                    className="interaction-issue-link"
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
                <div className="interaction-workspace">
                    <nav className="interaction-list" aria-label="Danh sách quy tắc">
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
                        className="interaction-detail"
                        key={selected.id}
                        aria-labelledby={`rule-${selected.id}`}
                    >
                        <h4 id={`rule-${selected.id}`} tabIndex={-1}>
                            Chỉnh quy tắc: {selected.name || 'Chưa đặt tên'}
                        </h4>
                        <fieldset disabled={disabled} className="interaction-rule-fields">
                            <label htmlFor={`rule-${selected.id}-name`}>
                                Tên quy tắc
                                <input
                                    id={`rule-${selected.id}-name`}
                                    maxLength={100}
                                    value={selected.name || ''}
                                    onChange={(event) => patch({ name: event.currentTarget.value })}
                                />
                            </label>
                            <label className="checkbox">
                                <input
                                    type="checkbox"
                                    checked={selected.enabled}
                                    onChange={(event) =>
                                        patch({ enabled: event.currentTarget.checked })
                                    }
                                />
                                Bật quy tắc
                            </label>
                            <label htmlFor={`rule-${selected.id}-trigger`}>
                                Sự kiện
                                <select
                                    id={`rule-${selected.id}-trigger`}
                                    value={selected.trigger.type}
                                    onChange={(event) => {
                                        const type = event.currentTarget.value as Trigger['type'];
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
                                </select>
                            </label>
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
                            <label htmlFor={`rule-${selected.id}-retrigger`}>
                                Khi sự kiện lặp lại lúc đang chạy
                                <select
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
                                </select>
                            </label>
                            <div className="form-actions interaction-wide">
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
                                    <ArrowUp size={18} aria-hidden="true" />
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
                                    <ArrowDown size={18} aria-hidden="true" />
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
                            <p role="alert" className="scene-reference-error">
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
                        <ol className="interaction-actions">
                            {selected.actions.map((action, index) => (
                                <li key={`${actionKey(action)}-${action.type}`}>
                                    <details open>
                                        <summary>
                                            Hành động {index + 1}: {actionLabels[action.type]}
                                        </summary>
                                        <div className="interaction-action-body">
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
                                            <div className="form-actions">
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
                                                    <ArrowUp size={18} aria-hidden="true" />
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
                                                    <ArrowDown size={18} aria-hidden="true" />
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
                        <p className="field-hint">
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
                    <div className="form-actions">
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
