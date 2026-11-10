import { useMemo, useState } from 'react';
import type { Scene, SceneObject } from '@/shared/contracts/scene.schema';
import { Button } from '@/shared/ui/Button';
import { ConfirmationDialog } from '@/shared/ui/ConfirmationDialog';
import { Field, FieldDescription, FieldLabel } from '@/shared/ui/primitives/field';
import { RadioGroup, RadioGroupItem } from '@/shared/ui/primitives/radio-group';
import { objectRemovalImpact } from '../model/interaction-health';
import { objectLabels } from '../model/objects';

export function ObjectRemovalDialog({
    scene,
    objects,
    busy,
    onClose,
    onRemove,
}: {
    scene: Scene;
    objects: SceneObject[];
    busy: boolean;
    onClose: () => void;
    onRemove: (removeInteractions: boolean) => void;
}) {
    const [choice, setChoice] = useState('keep');
    const affected = useMemo(
        () =>
            objectRemovalImpact(
                scene,
                objects.map((object) => object.id),
            ),
        [scene, objects],
    );
    return (
        <ConfirmationDialog
            title={
                objects.length > 1
                    ? `Xóa ${objects.length} đối tượng khỏi trang?`
                    : 'Xóa đối tượng khỏi trang?'
            }
            description={`${objects.length > 1 ? `${objects.length} đối tượng đã chọn` : `Đối tượng “${objects[0].name || objectLabels[objects[0].type]}”`} sẽ bị bỏ khỏi trang. Tệp tài nguyên vẫn được giữ. Bạn có thể Hoàn tác để khôi phục.`}
            busy={busy}
            onClose={onClose}
        >
            {affected.length > 0 && (
                <div className="mt-5 flex flex-col gap-4">
                    <div>
                        <p className="m-0 font-medium text-sm">
                            Ảnh hưởng đến {affected.length} luồng tương tác
                        </p>
                        <ul className="mt-2 mb-0 max-h-28 overflow-y-auto pl-5 text-muted-foreground text-sm">
                            {affected.map((rule) => (
                                <li key={rule.id}>{rule.name || 'Luồng chưa đặt tên'}</li>
                            ))}
                        </ul>
                    </div>
                    <RadioGroup
                        value={choice}
                        onValueChange={setChoice}
                        disabled={busy}
                        aria-label="Xử lý tương tác khi xóa đối tượng"
                        className="gap-4"
                    >
                        <Field orientation="horizontal">
                            <RadioGroupItem id="object-removal-keep" value="keep" />
                            <div className="flex flex-col gap-1">
                                <FieldLabel htmlFor="object-removal-keep">
                                    Giữ luồng để sửa
                                </FieldLabel>
                                <FieldDescription>
                                    Luồng thiếu đối tượng được đánh dấu và tạm bỏ qua khi xem trước.
                                </FieldDescription>
                            </div>
                        </Field>
                        <Field orientation="horizontal">
                            <RadioGroupItem id="object-removal-flows" value="remove" />
                            <div className="flex flex-col gap-1">
                                <FieldLabel htmlFor="object-removal-flows">
                                    Xóa kèm các luồng liên quan
                                </FieldLabel>
                                <FieldDescription>
                                    Xóa toàn bộ {affected.length} luồng trong danh sách, gồm các
                                    luồng phụ thuộc vào câu hỏi của chúng.
                                </FieldDescription>
                            </div>
                        </Field>
                    </RadioGroup>
                </div>
            )}
            <div className="mt-6 flex justify-end gap-3">
                <Button variant="secondary" disabled={busy} onClick={onClose}>
                    Giữ đối tượng
                </Button>
                <Button
                    variant="destructive"
                    disabled={busy}
                    onClick={() => onRemove(choice === 'remove')}
                >
                    Xóa đối tượng
                </Button>
            </div>
        </ConfirmationDialog>
    );
}
