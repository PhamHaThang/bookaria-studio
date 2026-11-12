import { Copy, Trash2, Zap } from 'lucide-react';
import { useState } from 'react';
import type { InteractionRule, SceneObject } from '@/shared/contracts/scene.schema';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/primitives/button';
import { SearchInput } from '@/shared/ui/SearchInput';
import { ruleTriggerLabel } from '../model/interaction-scope';
import { useMemory } from './MemoryContext';

/** Always-visible workflow list. Switching still uses the editor's unfinished-draft guard. */
export function InteractionFlowPicker({
    rules,
    active,
    activeStepCount,
    objects,
    disabled,
    onSelect,
    onDuplicate,
    onDelete,
    canDuplicate,
}: {
    rules: InteractionRule[];
    active?: InteractionRule;
    activeStepCount?: number;
    objects: SceneObject[];
    disabled: boolean;
    onSelect: (rule: InteractionRule) => void;
    onDuplicate: (rule: InteractionRule) => void;
    onDelete: (rule: InteractionRule) => void;
    canDuplicate: (rule: InteractionRule) => boolean;
}) {
    const { definitions } = useMemory();
    const [query, setQuery] = useState('');
    const items =
        active && !rules.some((rule) => rule.id === active.id)
            ? [...rules, active]
            : rules.map((rule) => (rule.id === active?.id ? active : rule));
    const matches = items.filter((rule) =>
        `${rule.name || 'Luồng chưa đặt tên'} ${ruleTriggerLabel(rule, objects, definitions)}`
            .toLocaleLowerCase('vi')
            .includes(query.trim().toLocaleLowerCase('vi')),
    );
    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="shrink-0 px-3">
                <SearchInput
                    aria-label="Tìm luồng tương tác"
                    placeholder="Tìm luồng…"
                    value={query}
                    onValueChange={setQuery}
                />
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-2 pb-1">
                {matches.map((rule) => (
                    <fieldset
                        key={rule.id}
                        aria-label={`Luồng ${rule.name || 'chưa đặt tên'}`}
                        className={cn(
                            'm-0 flex min-w-0 shrink-0 items-start gap-1 rounded-md border-0 p-1 hover:bg-hover',
                            rule.id === active?.id && 'bg-selected',
                        )}
                    >
                        <Button
                            variant="plain"
                            disabled={disabled}
                            aria-pressed={rule.id === active?.id}
                            className="flex h-auto min-h-18 min-w-0 flex-1 items-start justify-start gap-2 rounded-md px-2 py-2 text-left"
                            onClick={() => {
                                if (rule.id !== active?.id) onSelect(rule);
                            }}
                        >
                            <Zap className="mt-0.5 size-4 shrink-0" strokeWidth={1.6} />
                            <span className="flex min-w-0 flex-1 flex-col gap-1">
                                <span className="truncate font-medium text-sm">
                                    {rule.name || 'Luồng chưa đặt tên'}
                                </span>
                                <span className="line-clamp-2 text-muted-foreground text-xs leading-5">
                                    {ruleTriggerLabel(rule, objects, definitions)}
                                </span>
                                <span className="text-muted-foreground text-xs">
                                    {rule.id === active?.id
                                        ? (activeStepCount ?? rule.actions.length)
                                        : rule.actions.length}{' '}
                                    bước
                                    {!rules.some((item) => item.id === rule.id)
                                        ? ' — Đang thiết lập'
                                        : ''}
                                    {!rule.enabled ? ' — Đã tắt' : ''}
                                </span>
                            </span>
                        </Button>
                        <div className="flex shrink-0 flex-col gap-0.5 pt-1">
                            <Button
                                variant="ghost"
                                size="icon-xs"
                                aria-label={`Nhân bản luồng “${rule.name || 'chưa đặt tên'}”`}
                                title="Nhân bản luồng"
                                disabled={disabled || !canDuplicate(rule)}
                                onClick={() => onDuplicate(rule)}
                            >
                                <Copy />
                            </Button>
                            <Button
                                variant="destructive-ghost"
                                size="icon-xs"
                                aria-label={`Xóa luồng “${rule.name || 'chưa đặt tên'}”`}
                                title="Xóa luồng"
                                disabled={disabled}
                                onClick={() => onDelete(rule)}
                            >
                                <Trash2 />
                            </Button>
                        </div>
                    </fieldset>
                ))}
                {!matches.length && (
                    <p className="m-0 px-3 py-3 text-muted-foreground text-xs leading-5">
                        {items.length
                            ? 'Không tìm thấy luồng phù hợp.'
                            : 'Chưa có luồng. Nhấn + để tạo luồng trống hoặc chọn một mẫu.'}
                    </p>
                )}
            </div>
        </div>
    );
}
