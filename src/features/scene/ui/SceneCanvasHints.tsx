import { MousePointer2, Move, ZoomIn } from 'lucide-react';
import type { SceneObject } from '@/shared/contracts/scene.schema';
import { Kbd } from '@/shared/ui/primitives/kbd';
import { Separator } from '@/shared/ui/primitives/separator';
import type { TransformMode } from './SceneSelectionTools';

const tools = {
    translate: { key: 'W', label: 'Di chuyển' },
    rotate: { key: 'E', label: 'Xoay' },
    scale: { key: 'R', label: 'Kích thước' },
} as const;

export function SceneCanvasHints({
    mode,
    objects,
}: {
    mode: TransformMode;
    objects: SceneObject[];
}) {
    const tool = tools[mode];
    const locked = objects.some((object) => object.locked);
    const editable = objects.length > 0 && !locked;
    const groupScale = objects.length > 1 && mode === 'scale';
    return (
        <div
            role="note"
            aria-label="Hướng dẫn điều khiển canvas"
            className="canvas-status flex min-h-10 shrink-0 items-center justify-between gap-4 border-border border-t bg-surface px-4 py-2 text-muted-foreground text-sm"
        >
            <ul
                className="m-0 flex shrink-0 list-none items-center gap-4 whitespace-nowrap p-0"
                aria-label="Điều khiển góc nhìn"
            >
                <li
                    className="flex items-center gap-1.5"
                    aria-label="Kéo chuột trái để xoay góc nhìn"
                >
                    <MousePointer2 className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                    <span>Kéo trái: xoay</span>
                </li>
                <li
                    className="flex items-center gap-1.5"
                    aria-label="Kéo chuột phải hoặc giữ Space và kéo để dịch góc nhìn"
                >
                    <Move className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                    <span>Phải /</span>
                    <Kbd>Space</Kbd>
                    <span>: dịch</span>
                </li>
                <li
                    className="flex items-center gap-1.5"
                    aria-label="Cuộn chuột để thu phóng theo con trỏ"
                >
                    <ZoomIn className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                    <span>Cuộn: zoom</span>
                </li>
            </ul>
            <div className="flex shrink-0 items-center gap-3 whitespace-nowrap">
                {editable ? (
                    <>
                        <span className="flex items-center gap-1.5">
                            <Kbd>{tool.key}</Kbd>
                            <span>{tool.label}</span>
                        </span>
                        <Separator orientation="vertical" className="h-4" />
                        <span className="flex items-center gap-1.5">
                            {!groupScale && <Kbd>Shift</Kbd>}
                            <span>
                                {mode === 'scale'
                                    ? groupScale
                                        ? 'Nhóm giữ cùng tỉ lệ'
                                        : 'Giữ tỉ lệ'
                                    : 'Bắt bước'}
                            </span>
                        </span>
                    </>
                ) : (
                    <span>
                        {locked ? 'Mở khóa đối tượng để chỉnh sửa' : 'Chọn đối tượng để chỉnh sửa'}
                    </span>
                )}
            </div>
        </div>
    );
}
