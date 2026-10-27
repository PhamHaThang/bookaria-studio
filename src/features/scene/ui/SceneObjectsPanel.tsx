import {
    ArrowDown,
    ArrowUp,
    Box,
    Copy,
    Eye,
    EyeOff,
    Image,
    Layers,
    LockKeyhole,
    MoreHorizontal,
    MousePointer2,
    Search,
    Tag,
    Trash2,
    Type,
    UnlockKeyhole,
    Video,
    Volume2,
    X,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { SceneObject } from '@/shared/contracts/scene.schema';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/primitives/button';
import { Checkbox } from '@/shared/ui/primitives/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/shared/ui/primitives/dropdown-menu';
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/shared/ui/primitives/empty';
import { Field, FieldLabel } from '@/shared/ui/primitives/field';
import { Kbd } from '@/shared/ui/primitives/kbd';
import { Separator } from '@/shared/ui/primitives/separator';
import { SearchInput } from '@/shared/ui/SearchInput';
import {
    findSceneObjects,
    objectListSelection,
    sceneObjectLabel,
    toggleObjectListSelection,
} from '../model/object-list';
import type { SelectionMode } from '../model/selection';

const icons = {
    model: Box,
    image: Image,
    audio: Volume2,
    video: Video,
    text: Type,
    label: Tag,
    hotspot: MousePointer2,
};
type Props = {
    objects: SceneObject[];
    selectedIds: string[];
    query: string;
    onQueryChange: (value: string) => void;
    hidden: boolean;
    disabled: boolean;
    canDuplicate: boolean;
    onClose: () => void;
    onSelect: (ids: string[], mode?: SelectionMode) => void;
    onFlag: (id: string, flag: 'locked' | 'editorHidden', value: boolean) => void;
    onMove: (id: string, direction: -1 | 1) => void;
    onDuplicate: (id: string) => void;
    onDelete: (object: SceneObject) => void;
};
export function SceneObjectsPanel({
    objects,
    selectedIds,
    query,
    onQueryChange,
    hidden,
    disabled,
    canDuplicate,
    onClose,
    onSelect,
    onFlag,
    onMove,
    onDuplicate,
    onDelete,
}: Props) {
    const list = useRef<HTMLDivElement>(null);
    const selectionKey = selectedIds.join('|');
    useEffect(() => {
        if (hidden) return;
        const id = selectionKey.split('|').at(-1);
        if (id)
            list.current
                ?.querySelector<HTMLElement>(`[data-object-id="${CSS.escape(id)}"]`)
                ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }, [selectionKey, hidden]);
    const filtered = findSceneObjects(objects, query);
    const order = new Map(objects.map((object, index) => [object.id, index]));
    const selected = new Set(selectedIds);
    const selection = objectListSelection(filtered, selectedIds);
    return (
        <section
            id="scene-object-layers"
            aria-labelledby="layers-heading"
            hidden={hidden}
            className="scene-layers absolute right-[18px] bottom-[var(--scene-layers-bottom,100px)] z-4 col-start-1 col-end-2 flex max-h-[min(520px,calc(100%_-_var(--scene-layers-bottom,100px)_-_24px))] w-80 min-w-0 flex-col overflow-hidden rounded-xl bg-surface shadow-[0_8px_24px_#0000001a] [&[hidden]]:hidden"
            onKeyDown={(event) => {
                if (event.defaultPrevented || event.key !== 'Escape') return;
                event.preventDefault();
                event.stopPropagation();
                onClose();
            }}
        >
            <div className="flex shrink-0 flex-col gap-3 px-4 pt-4 pb-3">
                <div className="flex items-center justify-between gap-3">
                    <h2 id="layers-heading" className="m-0 flex items-center gap-2 text-base">
                        <Layers className="size-4" aria-hidden="true" />
                        Đối tượng{' '}
                        <span className="font-normal text-muted-foreground text-sm tabular-nums">
                            {objects.length}
                        </span>
                    </h2>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-8 min-h-8 p-1.5"
                        aria-label="Đóng danh sách đối tượng"
                        onClick={onClose}
                    >
                        <X />
                    </Button>
                </div>
                <Field>
                    <FieldLabel htmlFor="scene-object-search" className="sr-only">
                        Tìm đối tượng
                    </FieldLabel>
                    <SearchInput
                        id="scene-object-search"
                        placeholder="Tìm tên hoặc loại đối tượng…"
                        value={query}
                        onValueChange={onQueryChange}
                    />
                </Field>
                <div className="flex items-center justify-between gap-3">
                    <Field orientation="horizontal" className="w-auto gap-2">
                        <Checkbox
                            id="scene-object-select-all"
                            checked={selection.checked}
                            disabled={disabled || selection.ids.length === 0}
                            onCheckedChange={(checked) =>
                                onSelect(
                                    toggleObjectListSelection(
                                        selectedIds,
                                        selection.ids,
                                        checked === true,
                                    ),
                                )
                            }
                        />
                        <FieldLabel
                            htmlFor="scene-object-select-all"
                            className="font-normal text-sm"
                        >
                            {query.trim() ? 'Chọn kết quả' : 'Chọn tất cả'}
                        </FieldLabel>
                    </Field>
                    <span
                        className="shrink-0 text-muted-foreground text-xs tabular-nums"
                        role="status"
                    >
                        {selectedIds.length
                            ? `Đã chọn ${selectedIds.length}`
                            : `${filtered.length} đối tượng`}
                    </span>
                </div>
            </div>
            <Separator />
            <div className="min-h-0 overflow-y-auto px-2 py-2" data-object-list-scroll ref={list}>
                {filtered.length ? (
                    <ol
                        className="m-0 flex list-none flex-col gap-1 p-0"
                        aria-label="Danh sách đối tượng"
                    >
                        {filtered.map((object) => {
                            const Icon = icons[object.type],
                                name = object.name || sceneObjectLabel(object),
                                index = order.get(object.id) ?? 0;
                            return (
                                <li
                                    key={object.id}
                                    data-object-id={object.id}
                                    data-selected={selected.has(object.id)}
                                    className={cn(
                                        'flex min-w-0 items-center gap-1 rounded-lg border p-1',
                                        selected.has(object.id)
                                            ? 'border-primary'
                                            : 'border-transparent hover:border-border',
                                    )}
                                >
                                    <Button
                                        variant="plain"
                                        className="scene-layer-select flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left disabled:opacity-100"
                                        aria-label={`Chọn ${name}`}
                                        aria-pressed={selected.has(object.id)}
                                        disabled={disabled}
                                        onClick={(event) =>
                                            onSelect(
                                                [object.id],
                                                event.shiftKey || event.ctrlKey || event.metaKey
                                                    ? 'toggle'
                                                    : 'replace',
                                            )
                                        }
                                    >
                                        <Icon
                                            className="size-4 shrink-0"
                                            strokeWidth={1.5}
                                            aria-hidden="true"
                                        />
                                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                                            <span
                                                className="truncate font-medium text-[length:var(--text-md)]"
                                                title={name}
                                            >
                                                {name}
                                            </span>
                                            <span className="truncate text-muted-foreground text-xs">
                                                {sceneObjectLabel(object)}
                                                {object.type === 'audio'
                                                    ? ` · ${object.audioKind === 'VOICE' ? 'Voice' : object.audioKind || 'BGM'}`
                                                    : ''}
                                                {!object.visible ? ' · Ẩn trong Viewer' : ''}
                                            </span>
                                        </span>
                                    </Button>
                                    <div className="scene-layer-controls flex shrink-0 items-center [&_.button]:size-7 [&_.button]:min-h-7 [&_.button]:p-1.5">
                                        <Button
                                            variant="ghost"
                                            size="icon-xs"
                                            disabled={disabled || object.locked}
                                            aria-label={`${object.editorHidden ? 'Hiện' : 'Ẩn'} ${name} trong editor`}
                                            aria-pressed={object.editorHidden}
                                            title={
                                                object.editorHidden
                                                    ? 'Hiện trong editor'
                                                    : 'Ẩn trong editor'
                                            }
                                            onClick={() =>
                                                onFlag(
                                                    object.id,
                                                    'editorHidden',
                                                    !object.editorHidden,
                                                )
                                            }
                                        >
                                            {object.editorHidden ? <EyeOff /> : <Eye />}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon-xs"
                                            disabled={disabled}
                                            aria-label={`${object.locked ? 'Mở khóa' : 'Khóa'} ${name}`}
                                            aria-pressed={object.locked}
                                            title={
                                                object.locked
                                                    ? 'Mở khóa đối tượng'
                                                    : 'Khóa đối tượng'
                                            }
                                            onClick={() =>
                                                onFlag(object.id, 'locked', !object.locked)
                                            }
                                        >
                                            {object.locked ? <LockKeyhole /> : <UnlockKeyhole />}
                                        </Button>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-xs"
                                                    aria-label={`Tác vụ cho ${name}`}
                                                    disabled={disabled || object.locked}
                                                >
                                                    <MoreHorizontal />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-64">
                                                <DropdownMenuGroup>
                                                    <DropdownMenuItem
                                                        disabled={index === 0}
                                                        onSelect={() => onMove(object.id, -1)}
                                                    >
                                                        <ArrowUp />
                                                        Đưa lên trong danh sách
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        disabled={index === objects.length - 1}
                                                        onSelect={() => onMove(object.id, 1)}
                                                    >
                                                        <ArrowDown />
                                                        Đưa xuống trong danh sách
                                                    </DropdownMenuItem>
                                                </DropdownMenuGroup>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuGroup>
                                                    <DropdownMenuItem
                                                        disabled={!canDuplicate}
                                                        onSelect={() => onDuplicate(object.id)}
                                                    >
                                                        <Copy />
                                                        Nhân bản
                                                    </DropdownMenuItem>
                                                </DropdownMenuGroup>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuGroup>
                                                    <DropdownMenuItem
                                                        variant="destructive"
                                                        onSelect={() => onDelete(object)}
                                                    >
                                                        <Trash2 />
                                                        Xóa đối tượng
                                                    </DropdownMenuItem>
                                                </DropdownMenuGroup>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                ) : (
                    <Empty className="gap-3 px-3 py-6">
                        <EmptyHeader className="gap-2">
                            <EmptyMedia>
                                {objects.length ? (
                                    <Search className="size-7" strokeWidth={1.5} />
                                ) : (
                                    <Box className="size-7" strokeWidth={1.5} />
                                )}
                            </EmptyMedia>
                            <EmptyTitle>
                                <span className="text-base">
                                    {objects.length
                                        ? 'Không tìm thấy đối tượng'
                                        : 'Trang chưa có đối tượng'}
                                </span>
                            </EmptyTitle>
                            <EmptyDescription>
                                {objects.length
                                    ? 'Thử tên khác hoặc tìm theo loại đối tượng.'
                                    : 'Thêm văn bản, hình ảnh hoặc tài nguyên từ thanh bên trái.'}
                            </EmptyDescription>
                        </EmptyHeader>
                        {objects.length > 0 && (
                            <EmptyContent>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => onQueryChange('')}
                                >
                                    Xóa tìm kiếm
                                </Button>
                            </EmptyContent>
                        )}
                    </Empty>
                )}
            </div>
            <Separator />
            <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-2">
                <p className="m-0 flex items-center gap-1 text-muted-foreground text-xs">
                    Chọn nhiều: <Kbd>Shift</Kbd> / <Kbd>Ctrl</Kbd> + nhấp
                </p>
                {selectedIds.length > 0 && (
                    <Button
                        variant="ghost"
                        size="xs"
                        disabled={disabled}
                        onClick={() => onSelect([])}
                    >
                        Bỏ chọn
                    </Button>
                )}
            </div>
        </section>
    );
}
