import { Copy, Eye, EyeOff, LockKeyhole, LockKeyholeOpen, Trash2 } from 'lucide-react';
import type { SceneObject } from '../../../shared/contracts/scene.schema';
import { Button } from '../../../shared/ui/Button';

export function SelectionEditor({
    objects,
    disabled,
    canDuplicate,
    onDuplicate,
    onDelete,
    onFlag,
    onClear,
}: {
    objects: SceneObject[];
    disabled: boolean;
    canDuplicate: boolean;
    onDuplicate: () => void;
    onDelete: () => void;
    onFlag: (flag: 'locked' | 'editorHidden', value: boolean) => void;
    onClear: () => void;
}) {
    const locked = objects.some((object) => object.locked);
    const hidden = objects.some((object) => object.editorHidden);
    return (
        <section aria-labelledby="selection-heading" className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
                <h3 id="selection-heading" className="m-0 text-base">
                    Đã chọn {objects.length} đối tượng
                </h3>
                <p className="m-0 text-muted-foreground text-sm">
                    Dùng gizmo để di chuyển, xoay cả nhóm hoặc scale đồng đều quanh tâm chung.
                </p>
                <p className="m-0 text-muted-foreground text-sm">
                    Shift/Ctrl + nhấp để thêm hoặc bỏ một đối tượng. Esc để bỏ chọn.
                </p>
            </div>
            {(locked || hidden) && (
                <p role="status" className="m-0 text-muted-foreground text-sm">
                    {locked
                        ? 'Mở khóa nhóm để biến đổi, nhân bản hoặc xóa.'
                        : 'Hiện toàn bộ nhóm để dùng gizmo trên canvas.'}
                </p>
            )}
            <div className="grid grid-cols-2 gap-2">
                <Button
                    variant="secondary"
                    disabled={disabled}
                    onClick={() => onFlag('locked', !locked)}
                >
                    {locked ? (
                        <LockKeyholeOpen data-icon="inline-start" />
                    ) : (
                        <LockKeyhole data-icon="inline-start" />
                    )}
                    {locked ? 'Mở khóa nhóm' : 'Khóa nhóm'}
                </Button>
                <Button
                    variant="secondary"
                    disabled={disabled || locked}
                    onClick={() => onFlag('editorHidden', !hidden)}
                >
                    {hidden ? (
                        <Eye data-icon="inline-start" />
                    ) : (
                        <EyeOff data-icon="inline-start" />
                    )}
                    {hidden ? 'Hiện nhóm' : 'Ẩn nhóm'}
                </Button>
                <Button
                    variant="secondary"
                    disabled={disabled || locked || !canDuplicate}
                    onClick={onDuplicate}
                >
                    <Copy data-icon="inline-start" />
                    Nhân bản nhóm
                </Button>
                <Button variant="secondary" disabled={disabled || locked} onClick={onDelete}>
                    <Trash2 data-icon="inline-start" />
                    Xóa nhóm
                </Button>
            </div>
            {!canDuplicate && (
                <p className="m-0 text-muted-foreground text-sm">
                    Số đối tượng còn trống không đủ để nhân bản cả nhóm.
                </p>
            )}
            <Button variant="outline" disabled={disabled} onClick={onClear}>
                Bỏ chọn
            </Button>
        </section>
    );
}
