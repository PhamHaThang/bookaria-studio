import {
    Camera,
    Copy,
    LockKeyhole,
    Magnet,
    Move,
    RotateCcw,
    RotateCw,
    Scaling,
    Trash2,
    UnlockKeyhole,
} from 'lucide-react';
import type { RefObject } from 'react';
import type { SceneObject } from '@/shared/contracts/scene.schema';
import { facesCamera } from '@/shared/scene/audio-kind';
import { Button } from '@/shared/ui/Button';
import { Separator } from '@/shared/ui/primitives/separator';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/primitives/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/primitives/tooltip';

export type TransformMode = 'translate' | 'rotate' | 'scale';
export type SelectionActions = {
    canDuplicate: boolean;
    onDuplicate: () => void;
    onDelete: () => void;
    onLock: () => void;
    onBillboardChange: (enabled: boolean) => void;
    onResetAnnotationOffset: () => void;
};

export function SceneSelectionTools({
    objects,
    mode,
    disabled,
    transforming,
    actions,
    leftRef,
    rightRef,
    onModeChange,
    snap,
    onSnapChange,
}: {
    objects: SceneObject[];
    mode: TransformMode;
    snap: boolean;
    onSnapChange: (enabled: boolean) => void;
    disabled: boolean;
    transforming: boolean;
    actions: SelectionActions;
    leftRef: RefObject<HTMLDivElement | null>;
    rightRef: RefObject<HTMLDivElement | null>;
    onModeChange: (mode: TransformMode) => void;
}) {
    const locked = objects.some((object) => object.locked);
    const rotationDisabled = objects.some(facesCamera);
    const toolsDisabled = disabled || locked;
    const billboardDisabled = toolsDisabled || objects.some((object) => object.type === 'audio');
    const group = objects.length > 1;
    const annotation =
        !group &&
        objects[0] &&
        (objects[0].type === 'text' || objects[0].type === 'label') &&
        objects[0].presentation?.kind === 'annotation'
            ? objects[0].presentation
            : undefined;
    const billboardEnabled = objects.length > 0 && objects.every(facesCamera);
    const billboardMixed = !billboardEnabled && objects.some(facesCamera);
    return (
        <fieldset
            className="pointer-events-none absolute inset-0 z-1 m-0 min-w-0 border-0 p-0"
            hidden={!objects.length || transforming}
            aria-label={group ? 'Công cụ cạnh nhóm đã chọn' : 'Công cụ cạnh đối tượng'}
        >
            <div
                ref={leftRef}
                role="toolbar"
                aria-label="Thao tác đối tượng"
                aria-orientation="vertical"
                className="pointer-events-auto absolute flex w-12 flex-col gap-1 rounded-xl bg-surface p-1 shadow-[0_4px_18px_#0000001a]"
                style={{ visibility: 'hidden' }}
            >
                <Button
                    variant="ghost"
                    size="icon"
                    title={group ? 'Nhân bản nhóm (Ctrl D)' : 'Nhân bản (Ctrl D)'}
                    aria-label="Nhân bản đối tượng"
                    disabled={disabled || locked || !actions.canDuplicate}
                    onClick={actions.onDuplicate}
                >
                    <Copy />
                </Button>
                <Button
                    variant={snap && !toolsDisabled ? 'default' : 'ghost'}
                    size="icon"
                    title={snap ? 'Tắt snap (N)' : 'Bật snap (N)'}
                    aria-label="Bắt bước (N)"
                    aria-pressed={snap}
                    disabled={disabled || locked}
                    onClick={() => onSnapChange(!snap)}
                >
                    <Magnet />
                </Button>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant={billboardEnabled && !billboardDisabled ? 'default' : 'ghost'}
                            size="icon"
                            aria-label="Luôn hướng về camera"
                            aria-pressed={billboardMixed ? 'mixed' : billboardEnabled}
                            disabled={billboardDisabled}
                            onClick={() => actions.onBillboardChange(!billboardEnabled)}
                        >
                            <Camera />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left" sideOffset={10}>
                        {billboardEnabled ? 'Tắt luôn hướng về camera' : 'Bật luôn hướng về camera'}
                    </TooltipContent>
                </Tooltip>
                {annotation && (annotation.shape === 'line' || annotation.description) && (
                    <Button
                        variant="ghost"
                        size="icon"
                        title="Đặt lại vị trí nhãn chú thích"
                        aria-label="Đặt lại vị trí nhãn chú thích"
                        disabled={disabled || locked || !annotation.labelOffset?.some(Boolean)}
                        onClick={actions.onResetAnnotationOffset}
                    >
                        <RotateCcw />
                    </Button>
                )}
                <Button
                    variant={locked && !disabled ? 'default' : 'ghost'}
                    size="icon"
                    title={locked ? 'Mở khóa đối tượng' : 'Khóa đối tượng'}
                    aria-label={locked ? 'Mở khóa đối tượng' : 'Khóa đối tượng'}
                    aria-pressed={locked}
                    disabled={disabled}
                    onClick={actions.onLock}
                >
                    {locked ? <UnlockKeyhole /> : <LockKeyhole />}
                </Button>
            </div>
            <div
                ref={rightRef}
                role="toolbar"
                aria-label="Biến đổi đối tượng"
                aria-orientation="vertical"
                className="pointer-events-auto absolute flex w-12 flex-col items-center gap-1 rounded-xl bg-surface p-1 shadow-[0_4px_18px_#0000001a]"
                style={{ visibility: 'hidden' }}
            >
                <ToggleGroup
                    type="single"
                    orientation="vertical"
                    size="lg"
                    value={mode}
                    disabled={disabled || locked}
                    onValueChange={(value) => {
                        if (value && !(value === 'rotate' && rotationDisabled))
                            onModeChange(value as TransformMode);
                    }}
                    aria-label="Chế độ biến đổi"
                    className="flex-col gap-1"
                >
                    {(
                        [
                            { value: 'translate', label: 'Di chuyển (W)', icon: Move },
                            { value: 'rotate', label: 'Xoay (E)', icon: RotateCw },
                            { value: 'scale', label: 'Kích thước (R)', icon: Scaling },
                        ] as const
                    ).map((tool) => (
                        <Tooltip key={tool.value}>
                            <TooltipTrigger asChild>
                                <span className="flex">
                                    <ToggleGroupItem
                                        value={tool.value}
                                        disabled={tool.value === 'rotate' && rotationDisabled}
                                        aria-label={tool.label}
                                        className="size-10 p-2"
                                    >
                                        <tool.icon />
                                    </ToggleGroupItem>
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side="right" sideOffset={10}>
                                {tool.value === 'rotate' && rotationDisabled
                                    ? 'Tắt “Luôn hướng về camera” để xoay.'
                                    : tool.value === 'scale'
                                      ? 'Kích thước (R) · Giữ Shift để giữ tỉ lệ'
                                      : tool.label}
                            </TooltipContent>
                        </Tooltip>
                    ))}
                </ToggleGroup>
                <Separator />
                <Button
                    variant="ghost"
                    size="icon"
                    title={group ? 'Xóa nhóm (Delete)' : 'Xóa đối tượng (Delete)'}
                    aria-label="Xóa đối tượng"
                    disabled={disabled || locked}
                    onClick={actions.onDelete}
                >
                    <Trash2 />
                </Button>
            </div>
        </fieldset>
    );
}
