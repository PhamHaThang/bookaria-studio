import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import type { AssetRef } from '@/shared/contracts/asset.schema';
import {
    type Action,
    type ActionType,
    SCENE_LIMITS,
    type SceneObject,
} from '@/shared/contracts/scene.schema';
import { Button } from '@/shared/ui/Button';
import { Disclosure } from '@/shared/ui/Disclosure';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/shared/ui/primitives/dropdown-menu';
import { scopedAction } from '../model/interaction-scope';
import { actionLabels, appendAction, moveItem, removeAction } from '../model/interactions';
import { InteractionActionEditor } from './InteractionActionEditor';

export function InteractionActionStack({
    ruleId,
    actions,
    objects,
    assets,
    disabled,
    source,
    onChange,
}: {
    ruleId: string;
    actions: Action[];
    objects: SceneObject[];
    assets: Record<string, AssetRef>;
    disabled: boolean;
    source?: SceneObject;
    onChange: (actions: Action[]) => void;
}) {
    const keys = useRef(new WeakMap<Action, string>());
    function keyFor(action: Action) {
        let key = keys.current.get(action);
        if (!key) {
            key = crypto.randomUUID();
            keys.current.set(action, key);
        }
        return key;
    }
    return (
        <div className="flex min-w-0 flex-col gap-3">
            <h4 className="m-0 font-semibold text-sm">
                Thì thực hiện ({actions.length}/{SCENE_LIMITS.maxActionsPerRule})
            </h4>
            <ol
                className="m-0 flex list-none flex-col gap-3 p-0"
                aria-label="Hành động theo thứ tự"
            >
                {actions.map((action, index) => (
                    <li key={`${keyFor(action)}-${action.type}`} className="min-w-0">
                        {index > 0 && (
                            <div
                                className="mb-3 flex justify-center text-muted-foreground"
                                aria-hidden="true"
                            >
                                <ArrowDown className="size-4" />
                            </div>
                        )}
                        <Disclosure
                            variant="panel"
                            title={`${index + 1}. ${actionLabels[action.type]}`}
                            defaultOpen
                        >
                            <div className="flex min-w-0 flex-col gap-3 pb-1">
                                <InteractionActionEditor
                                    id={`action-${ruleId}-${index}`}
                                    action={action}
                                    objects={objects}
                                    assets={assets}
                                    disabled={disabled}
                                    defaultTarget={source}
                                    onChange={(next) => {
                                        keys.current.set(next, keyFor(action));
                                        onChange(
                                            actions.map((item, i) => (i === index ? next : item)),
                                        );
                                    }}
                                />
                                <div className="flex items-center justify-end gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label={`Đưa hành động ${index + 1} lên`}
                                        title="Đưa lên"
                                        disabled={disabled || index === 0}
                                        onClick={() => onChange(moveItem(actions, index, -1))}
                                    >
                                        <ArrowUp />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label={`Đưa hành động ${index + 1} xuống`}
                                        title="Đưa xuống"
                                        disabled={disabled || index === actions.length - 1}
                                        onClick={() => onChange(moveItem(actions, index, 1))}
                                    >
                                        <ArrowDown />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label={`Xóa hành động ${index + 1}`}
                                        title="Xóa hành động"
                                        disabled={disabled || actions.length === 1}
                                        onClick={() => onChange(removeAction(actions, index))}
                                    >
                                        <Trash2 />
                                    </Button>
                                </div>
                            </div>
                        </Disclosure>
                    </li>
                ))}
            </ol>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        disabled={disabled || actions.length >= SCENE_LIMITS.maxActionsPerRule}
                    >
                        <Plus data-icon="inline-start" />
                        Thêm hành động
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    <DropdownMenuGroup>
                        {(Object.entries(actionLabels) as [ActionType, string][]).map(
                            ([type, label]) => (
                                <DropdownMenuItem
                                    key={type}
                                    onSelect={() =>
                                        onChange(appendAction(actions, scopedAction(type, source)))
                                    }
                                >
                                    {label}
                                </DropdownMenuItem>
                            ),
                        )}
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>
            <p className="m-0 text-muted-foreground text-xs leading-relaxed">
                Các hành động chạy theo thứ tự. Dùng “Chờ” để tạo khoảng nghỉ. Thời gian tính bằng
                mili giây (1000 ms = 1 giây).
            </p>
        </div>
    );
}
