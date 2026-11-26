import { Box, Globe2 } from 'lucide-react';
import { Button as ActionButton } from '@/shared/ui/primitives/button';
import type { EditorGridSettings } from '../model/editor-grid';
import type { SnapSteps } from '../model/snap';
import { SceneGridSettings } from './SceneGridSettings';
import { SceneSnapSettings } from './SceneSnapSettings';

type Props = {
    mode: 'translate' | 'rotate' | 'scale';
    localAxes: boolean;
    selectedCount: number;
    disabled: boolean;
    transforming: boolean;
    failed: boolean;
    snap: boolean;
    snapSteps: SnapSteps;
    gridSettings: EditorGridSettings;
    onView: (view: 'front' | 'iso') => void;
    onToggleSpace: () => void;
    onSnapChange: (enabled: boolean) => void;
    onSnapStepsChange: (steps: SnapSteps) => void;
    onGridChange: (settings: EditorGridSettings) => void;
};

export function SceneCanvasToolbar({
    mode,
    localAxes,
    selectedCount,
    disabled,
    transforming,
    failed,
    snap,
    snapSteps,
    gridSettings,
    onView,
    onToggleSpace,
    onSnapChange,
    onSnapStepsChange,
    onGridChange,
}: Props) {
    return (
        <div
            className="canvas-toolbar absolute top-[18px] left-[18px] z-2 flex max-w-[calc(100%_-_var(--inspector-offset,0px)_-_var(--sidebar-toolbar-offset,0px)_-_176px)] translate-x-[var(--sidebar-toolbar-offset,0px)] flex-wrap items-center gap-1 rounded-xl bg-surface p-1 shadow-[0_4px_14px_#00000014] transition-[translate] duration-(--sidebar-motion-duration) ease-(--sidebar-motion-ease) motion-reduce:transition-none [&_button.primary:disabled]:bg-primary [&_button.primary:disabled]:text-primary-foreground [&_button:disabled]:border-transparent"
            role="toolbar"
            aria-label="Công cụ canvas"
        >
            <ActionButton
                variant="ghost"
                size="sm"
                title="Mặt trang · Đưa toàn bộ trang vào khung nhìn"
                disabled={transforming}
                onClick={() => onView('front')}
            >
                Mặt trang
            </ActionButton>
            <ActionButton
                variant="ghost"
                size="sm"
                title="Phối cảnh · Xem trang theo phối cảnh 3D"
                disabled={transforming}
                onClick={() => onView('iso')}
            >
                Phối cảnh
            </ActionButton>
            <ActionButton
                variant="ghost"
                size="sm"
                type="button"
                title={
                    selectedCount > 1
                        ? 'Nhóm dùng trục thế giới'
                        : mode === 'scale'
                          ? 'Kích thước theo trục đối tượng'
                          : 'Đổi trục thế giới / cục bộ (L)'
                }
                aria-label={localAxes ? 'Trục cục bộ (L)' : 'Trục thế giới (L)'}
                aria-pressed={localAxes}
                disabled={disabled || transforming || selectedCount > 1 || mode === 'scale'}
                onClick={onToggleSpace}
            >
                {localAxes ? <Box data-icon="inline-start" /> : <Globe2 data-icon="inline-start" />}
                <span>{localAxes ? 'Cục bộ' : 'Thế giới'}</span>
            </ActionButton>
            <SceneSnapSettings
                steps={snapSteps}
                enabled={snap}
                disabled={disabled || transforming}
                onChange={onSnapStepsChange}
                onEnabledChange={onSnapChange}
            />
            <SceneGridSettings
                value={gridSettings}
                disabled={transforming || failed}
                onChange={onGridChange}
            />
        </div>
    );
}
