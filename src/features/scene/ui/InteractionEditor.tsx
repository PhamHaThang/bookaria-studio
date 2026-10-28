import {
    ArrowDown,
    ArrowUp,
    Copy,
    MoreHorizontal,
    MousePointer2,
    Plus,
    Trash2,
    Zap,
} from 'lucide-react';
import { useState } from 'react';
import type { AssetRef } from '@/shared/contracts/asset.schema';
import {
    findSceneReferenceIssues,
    type InteractionRule,
    InteractionRuleSchema,
    SCENE_LIMITS,
    type Scene,
    type SceneObject,
    type Trigger,
} from '@/shared/contracts/scene.schema';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { ConfirmationDialog } from '@/shared/ui/ConfirmationDialog';
import { Disclosure } from '@/shared/ui/Disclosure';
import { FormSelect } from '@/shared/ui/FormSelect';
import { AlertDialogAction, AlertDialogCancel } from '@/shared/ui/primitives/alert-dialog';
import { Badge } from '@/shared/ui/primitives/badge';
import { Button as ActionButton } from '@/shared/ui/primitives/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/shared/ui/primitives/dropdown-menu';
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/shared/ui/primitives/empty';
import { Field, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { Switch } from '@/shared/ui/primitives/switch';
import {
    type InteractionScope,
    moveScopedRule,
    rulesInScope,
    ruleTriggerLabel,
    scopedRule,
} from '../model/interaction-scope';
import {
    actionLabels,
    appendRule,
    copyRule,
    targetObjects,
    triggerLabels,
} from '../model/interactions';
import { InteractionActionStack } from './InteractionActionStack';
import { InteractionScopeFilter } from './InteractionScopeFilter';
import { InteractionTarget } from './InteractionTarget';

export function InteractionEditor({
    scene,
    assets,
    disabled,
    onChange,
    object,
    onShowPageRules,
}: {
    scene: Scene;
    assets: Record<string, AssetRef>;
    disabled: boolean;
    onChange: (scene: Scene) => void;
    object?: SceneObject;
    onShowPageRules: () => void;
}) {
    const [filter, setFilter] = useState<InteractionScope>({ type: 'all' });
    const [selectedId, setSelectedId] = useState('');
    const [deleting, setDeleting] = useState<InteractionRule | null>(null);
    const scope: InteractionScope = object ? { type: 'object', objectId: object.id } : filter;
    const rules = rulesInScope(scene.interactions, scope);
    const selected = rules.find((rule) => rule.id === selectedId) || rules[0];
    const selectedIndex = selected ? rules.indexOf(selected) : -1;
    const issues = findSceneReferenceIssues(scene).filter((issue) =>
        rules.some((rule) => rule.id === issue.interactionId),
    );
    const validation = selected ? InteractionRuleSchema.safeParse(selected) : null;
    const trigger = selected?.trigger;
    const source =
        trigger?.type === 'onTap'
            ? scene.objects.find((item) => item.id === trigger.objectId)
            : undefined;
    const canAdd =
        scope.type !== 'object' ||
        targetObjects(scene.objects, 'onTap').some((item) => item.id === scope.objectId);
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
    function addRule() {
        if (disabled || !canAdd || scene.interactions.length >= SCENE_LIMITS.maxRules) return;
        const rule = scopedRule(crypto.randomUUID(), scope, scene.objects);
        changeRules(appendRule(scene.interactions, rule));
        setSelectedId(rule.id);
    }
    const fixedSource = scope.type === 'object';
    return (
        <section
            className="scene-interactions flex min-w-0 flex-col gap-5"
            aria-label={object ? 'Tương tác của đối tượng' : 'Quy tắc tương tác của trang'}
            data-scope={scope.type}
        >
            {!object && (
                <InteractionScopeFilter
                    scope={filter}
                    objects={scene.objects}
                    rules={scene.interactions}
                    onChange={(next) => {
                        setFilter(next);
                        setSelectedId('');
                    }}
                />
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="m-0 text-muted-foreground text-xs" role="status">
                    {rules.length} quy tắc{object ? ' của đối tượng' : ''} ·{' '}
                    {scene.interactions.length}/{SCENE_LIMITS.maxRules} trên trang
                </p>
                <Button
                    size="sm"
                    disabled={
                        disabled || !canAdd || scene.interactions.length >= SCENE_LIMITS.maxRules
                    }
                    onClick={addRule}
                >
                    <Plus data-icon="inline-start" />
                    {object ? 'Thêm tương tác' : 'Thêm quy tắc'}
                </Button>
            </div>
            {object?.type === 'audio' && (
                <Alert tone="info">
                    <p>
                        Thẻ âm thanh dùng để phát nhạc. Hãy tạo quy tắc từ trang hoặc một đối tượng
                        khác để điều khiển âm thanh này.
                    </p>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            setFilter({ type: 'all' });
                            onShowPageRules();
                        }}
                    >
                        Xem quy tắc toàn trang
                    </Button>
                </Alert>
            )}
            {!rules.length && object?.type !== 'audio' && (
                <Empty className="min-h-40 px-2 py-6">
                    <EmptyHeader>
                        <EmptyMedia>
                            <Zap className="size-7" aria-hidden="true" />
                        </EmptyMedia>
                        <EmptyTitle>Chưa có tương tác</EmptyTitle>
                        <EmptyDescription>
                            {scope.type === 'object' && !scope.objectId
                                ? 'Chọn đối tượng bắt đầu để xem và thêm quy tắc.'
                                : object
                                  ? 'Thêm tương tác để chọn điều gì xảy ra khi người đọc chạm vào đối tượng này.'
                                  : 'Thêm quy tắc, chọn sự kiện rồi xếp các hành động theo thứ tự.'}
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
            )}
            {issues.length > 0 && (
                <Alert tone="danger">
                    <p>Có đích cần sửa trước khi xuất bản, kể cả quy tắc đang tắt.</p>
                    <ul>
                        {issues.map((issue) => (
                            <li key={`${issue.interactionId}-${issue.actionIndex ?? 'trigger'}`}>
                                <ActionButton
                                    variant="plain"
                                    className="h-auto whitespace-normal text-left underline underline-offset-2"
                                    onClick={() => setSelectedId(issue.interactionId)}
                                >
                                    {scene.interactions.find(
                                        (rule) => rule.id === issue.interactionId,
                                    )?.name || 'Quy tắc chưa đặt tên'}{' '}
                                    ·{' '}
                                    {issue.actionIndex === null
                                        ? 'Sự kiện'
                                        : `Hành động ${issue.actionIndex + 1}`}
                                    : {issue.message}
                                </ActionButton>
                            </li>
                        ))}
                    </ul>
                </Alert>
            )}
            {selected && (
                <div className="grid min-w-0 items-start gap-5 min-[1100px]:[.scene-editor[data-panel=interactions]_&]:grid-cols-[160px_minmax(0,1fr)]">
                    <nav
                        aria-label="Danh sách quy tắc"
                        className="grid max-h-60 gap-2 overflow-y-auto"
                    >
                        {rules.map((rule, index) => (
                            <ActionButton
                                key={rule.id}
                                variant="plain"
                                aria-current={selected.id === rule.id ? 'true' : undefined}
                                aria-label={`Chọn quy tắc ${rule.name || 'Chưa đặt tên'}`}
                                onClick={() => setSelectedId(rule.id)}
                                className="flex h-auto min-w-0 flex-col items-stretch gap-1 rounded-lg border border-border bg-surface px-3 py-3 text-left text-foreground hover:border-primary aria-[current=true]:border-primary"
                            >
                                <span className="flex min-w-0 items-center justify-between gap-2">
                                    <span className="truncate font-semibold text-xs">
                                        {index + 1}. {rule.name || 'Quy tắc chưa đặt tên'}
                                    </span>
                                    <Badge variant="outline">{rule.enabled ? 'Bật' : 'Tắt'}</Badge>
                                </span>
                                <span className="whitespace-normal text-xs leading-relaxed">
                                    {ruleTriggerLabel(rule, scene.objects)}
                                </span>
                                <span className="truncate text-muted-foreground text-xs">
                                    {rule.actions
                                        .map((action) => actionLabels[action.type])
                                        .join(' → ')}
                                </span>
                            </ActionButton>
                        ))}
                    </nav>
                    <section
                        key={selected.id}
                        aria-label="Chỉnh quy tắc"
                        className="flex min-w-0 flex-col gap-5 border-border border-t pt-5"
                    >
                        <fieldset
                            disabled={disabled}
                            className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <Field
                                    orientation="horizontal"
                                    className="w-auto items-center gap-3"
                                >
                                    <Switch
                                        id={`rule-${selected.id}-enabled`}
                                        checked={selected.enabled}
                                        disabled={disabled}
                                        onCheckedChange={(enabled) => patch({ enabled })}
                                    />
                                    <FieldLabel
                                        htmlFor={`rule-${selected.id}-enabled`}
                                        className="m-0 font-normal"
                                    >
                                        Bật quy tắc
                                    </FieldLabel>
                                </Field>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            aria-label="Tác vụ quy tắc"
                                            disabled={disabled}
                                        >
                                            <MoreHorizontal />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuGroup>
                                            <DropdownMenuItem
                                                disabled={selectedIndex === 0}
                                                onSelect={() =>
                                                    changeRules(
                                                        moveScopedRule(
                                                            scene.interactions,
                                                            scope,
                                                            selected.id,
                                                            -1,
                                                        ),
                                                    )
                                                }
                                            >
                                                <ArrowUp />
                                                Đưa quy tắc lên
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                disabled={selectedIndex === rules.length - 1}
                                                onSelect={() =>
                                                    changeRules(
                                                        moveScopedRule(
                                                            scene.interactions,
                                                            scope,
                                                            selected.id,
                                                            1,
                                                        ),
                                                    )
                                                }
                                            >
                                                <ArrowDown />
                                                Đưa quy tắc xuống
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                disabled={
                                                    scene.interactions.length >=
                                                    SCENE_LIMITS.maxRules
                                                }
                                                onSelect={() => {
                                                    const id = crypto.randomUUID();
                                                    changeRules(
                                                        copyRule(
                                                            scene.interactions,
                                                            selected.id,
                                                            id,
                                                        ),
                                                    );
                                                    setSelectedId(id);
                                                }}
                                            >
                                                <Copy />
                                                Nhân bản quy tắc
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                variant="destructive"
                                                onSelect={() => setDeleting(selected)}
                                            >
                                                <Trash2 />
                                                Xóa quy tắc
                                            </DropdownMenuItem>
                                        </DropdownMenuGroup>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            {fixedSource ? (
                                <div className="flex items-start gap-3 rounded-lg border border-border p-3">
                                    <MousePointer2
                                        className="mt-0.5 size-4 shrink-0"
                                        aria-hidden="true"
                                    />
                                    <div className="min-w-0">
                                        <p className="m-0 font-medium text-sm">
                                            {ruleTriggerLabel(selected, scene.objects)}
                                        </p>
                                        <p className="m-0 mt-1 text-muted-foreground text-xs">
                                            Đối tượng bắt đầu đã được chọn sẵn.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <Field>
                                        <FieldLabel htmlFor={`rule-${selected.id}-trigger`}>
                                            Khi xảy ra
                                        </FieldLabel>
                                        <FormSelect
                                            id={`rule-${selected.id}-trigger`}
                                            value={selected.trigger.type}
                                            onValueChange={(value) => {
                                                const type = value as Trigger['type'];
                                                patch({
                                                    trigger:
                                                        type === 'onTap'
                                                            ? { type, objectId: '' }
                                                            : { type },
                                                });
                                            }}
                                            options={Object.entries(triggerLabels)
                                                .filter(
                                                    ([type]) =>
                                                        scope.type !== 'page' || type !== 'onTap',
                                                )
                                                .map(([value, label]) => ({ value, label }))}
                                        />
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
                                </>
                            )}
                        </fieldset>
                        {validation && !validation.success && (
                            <Alert tone="warning">
                                <p role="alert">
                                    {validation.error.issues
                                        .map(
                                            (issue) =>
                                                `${issue.path[0] === 'actions' && typeof issue.path[1] === 'number' ? `Hành động ${issue.path[1] + 1}` : 'Quy tắc'}: ${issue.message}`,
                                        )
                                        .join('; ')}
                                </p>
                            </Alert>
                        )}
                        <InteractionActionStack
                            ruleId={selected.id}
                            actions={selected.actions}
                            objects={scene.objects}
                            assets={assets}
                            disabled={disabled}
                            source={source}
                            onChange={(actions) => patch({ actions })}
                        />
                        <Disclosure title="Cài đặt quy tắc" variant="panel">
                            <fieldset
                                disabled={disabled}
                                className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0"
                            >
                                <Field>
                                    <FieldLabel htmlFor={`rule-${selected.id}-name`}>
                                        Tên quy tắc
                                    </FieldLabel>
                                    <Input
                                        id={`rule-${selected.id}-name`}
                                        maxLength={100}
                                        value={selected.name || ''}
                                        onChange={(event) =>
                                            patch({ name: event.currentTarget.value })
                                        }
                                    />
                                </Field>
                                <Field>
                                    <FieldLabel htmlFor={`rule-${selected.id}-retrigger`}>
                                        Nếu sự kiện lặp lại khi đang chạy
                                    </FieldLabel>
                                    <FormSelect
                                        id={`rule-${selected.id}-retrigger`}
                                        value={selected.onRetrigger}
                                        onValueChange={(value) =>
                                            patch({
                                                onRetrigger:
                                                    value as InteractionRule['onRetrigger'],
                                            })
                                        }
                                        options={[
                                            { value: 'ignore', label: 'Bỏ qua lần mới' },
                                            { value: 'restart', label: 'Chạy lại từ đầu' },
                                        ]}
                                    />
                                </Field>
                            </fieldset>
                        </Disclosure>
                    </section>
                </div>
            )}
            <p className="m-0 text-muted-foreground text-xs leading-relaxed">
                Thay đổi được lưu cùng nội dung trang bằng nút Lưu trên header.
            </p>
            {deleting && (
                <ConfirmationDialog
                    title="Xóa quy tắc tương tác?"
                    description={
                        <>
                            Quy tắc “{deleting.name || 'Chưa đặt tên'}” cùng các hành động sẽ bị bỏ
                            khỏi bản đang sửa.
                        </>
                    }
                    busy={disabled}
                    onClose={() => setDeleting(null)}
                >
                    <div className="mt-6 flex justify-end gap-3">
                        <AlertDialogCancel variant="plain" asChild>
                            <Button
                                variant="outline"
                                disabled={disabled}
                                onClick={() => setDeleting(null)}
                            >
                                Giữ quy tắc
                            </Button>
                        </AlertDialogCancel>
                        <AlertDialogAction
                            variant="plain"
                            asChild
                            onClick={(event) => event.preventDefault()}
                        >
                            <Button
                                variant="destructive"
                                disabled={disabled}
                                onClick={() => {
                                    changeRules(
                                        scene.interactions.filter(
                                            (rule) => rule.id !== deleting.id,
                                        ),
                                    );
                                    setDeleting(null);
                                }}
                            >
                                Xác nhận xóa quy tắc
                            </Button>
                        </AlertDialogAction>
                    </div>
                </ConfirmationDialog>
            )}
        </section>
    );
}
