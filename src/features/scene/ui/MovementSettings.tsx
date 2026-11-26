import { useId } from 'react';
import { toast } from 'sonner';
import type { Scene } from '@/shared/contracts/scene.schema';
import { Checkbox } from '@/shared/ui/primitives/checkbox';
import { Field, FieldLabel } from '@/shared/ui/primitives/field';
import type { InteractionFlow } from '../model/interaction-flow';
import { readMovementSequence, setMovementLoop } from '../model/movement-sequence';
import { NumericField } from './NumericField';

export function MovementSettingsPanel({
    graph,
    stepId,
    scene,
    disabled,
    allowLoop,
    onChange,
}: {
    graph: InteractionFlow;
    stepId: string;
    scene: Scene;
    disabled: boolean;
    allowLoop: boolean;
    onChange: (graph: InteractionFlow) => void;
}) {
    const id = useId();
    const { loop, objectId } = readMovementSequence(graph, stepId);
    const updateLoop = (pauseMs: number | null) => {
        try {
            const object = scene.objects.find((item) => item.id === objectId);
            onChange(setMovementLoop(graph, stepId, object, pauseMs));
            toast.dismiss(id);
        } catch (cause) {
            toast.error(cause instanceof Error ? cause.message : 'Chưa cập nhật được đoạn lặp.', {
                id,
            });
        }
    };

    return (
        <section
            aria-label="Thiết lập phát chuyển động"
            className="flex min-w-0 flex-col gap-2 pt-1"
        >
            <Field orientation="horizontal" className="gap-2">
                <Checkbox
                    id={id}
                    checked={Boolean(loop)}
                    disabled={disabled || (!allowLoop && !loop)}
                    onCheckedChange={(checked) => updateLoop(checked === true ? 0 : null)}
                />
                <FieldLabel htmlFor={id} className="font-normal text-xs">
                    Lặp vô hạn
                </FieldLabel>
            </Field>
            {loop && (
                <>
                    <Field
                        orientation="horizontal"
                        className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-2 [&_[data-slot=field-label]]:mb-0 [&_[data-slot=field-label]]:font-normal [&_[data-slot=field-label]]:text-xs"
                    >
                        <NumericField
                            id={`${id}-pause`}
                            label="Nghỉ (giây)"
                            aria-label="Nghỉ giữa lượt (giây, 0–60)"
                            disabled={disabled}
                            value={loop.pauseMs / 1000}
                            onChange={(value) => updateLoop(Math.round(value * 1000))}
                        />
                    </Field>
                    <p className="m-0 text-muted-foreground text-xs leading-5">
                        Lặp các bước chuyển động nối tiếp. Các bước sau đoạn lặp sẽ chờ.
                    </p>
                </>
            )}
        </section>
    );
}
