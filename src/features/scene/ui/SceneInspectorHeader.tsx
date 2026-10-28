import {
    ArrowLeft,
    Box,
    Eye,
    Image,
    Layers,
    LockKeyhole,
    MousePointer2,
    Settings2,
    Tag,
    Type,
    Video,
    Volume2,
    X,
    Zap,
} from 'lucide-react';
import type { SceneObject } from '@/shared/contracts/scene.schema';
import { Button } from '@/shared/ui/primitives/button';
import { objectInspectorMeta } from '../model/object-inspector';

const icons = {
    model: Box,
    image: Image,
    text: Type,
    video: Video,
    audio: Volume2,
    hotspot: MousePointer2,
    label: Tag,
};

export function SceneInspectorHeader({
    panel,
    selected,
    count,
    pageNumber,
    disabled,
    onBack,
    onClear,
}: {
    panel: 'properties' | 'interactions' | 'settings' | 'preview';
    selected?: SceneObject;
    count: number;
    pageNumber: number;
    disabled: boolean;
    onBack: () => void;
    onClear: () => void;
}) {
    const properties = panel === 'properties';
    const meta = selected ? objectInspectorMeta(selected) : null;
    const title = properties
        ? count > 1
            ? 'Thuộc tính nhóm'
            : meta?.title || 'Thuộc tính đối tượng'
        : panel === 'interactions'
          ? 'Tương tác của trang'
          : panel === 'settings'
            ? 'Cài đặt trang'
            : 'Xem trước';
    const subtitle = properties
        ? count > 1
            ? `${count} đối tượng được chọn`
            : selected?.name || meta?.label || 'Chọn đối tượng trên canvas hoặc trong danh sách'
        : `Trang ${pageNumber}`;
    const Icon = properties
        ? count > 1
            ? Layers
            : selected
              ? icons[selected.type]
              : MousePointer2
        : panel === 'interactions'
          ? Zap
          : panel === 'settings'
            ? Settings2
            : Eye;

    return (
        <header className="inspector-heading flex min-h-20 shrink-0 items-center gap-3 border-border border-b bg-surface px-4 py-4">
            {!properties && (
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Về thuộc tính đối tượng"
                    onClick={onBack}
                >
                    <ArrowLeft />
                </Button>
            )}
            <Icon className="size-5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
                <h2
                    id="inspector-heading"
                    tabIndex={-1}
                    className="m-0 truncate font-semibold text-sm leading-5 outline-none"
                >
                    {title}
                </h2>
                <p
                    className="m-0 mt-1 truncate text-muted-foreground text-xs leading-4"
                    title={subtitle}
                >
                    {subtitle}
                </p>
            </div>
            {properties && count === 1 && selected?.locked && (
                <LockKeyhole
                    className="size-3.5 shrink-0 text-muted-foreground"
                    aria-label="Đối tượng đã khóa"
                />
            )}
            {properties && count > 0 && (
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Bỏ chọn đối tượng"
                    disabled={disabled}
                    onClick={onClear}
                >
                    <X />
                </Button>
            )}
        </header>
    );
}
