import { cn } from '../../../shared/lib/cn';
import { Field, FieldGroup, FieldLabel } from '../../../shared/ui/primitives/field';
import { Input } from '../../../shared/ui/primitives/input';

export function BookSizeFields({
    idPrefix,
    width,
    height,
    onWidthChange,
    onHeightChange,
    className,
}: {
    idPrefix: string;
    width: string;
    height: string;
    onWidthChange: (value: string) => void;
    onHeightChange: (value: string) => void;
    className?: string;
}) {
    return (
        <FieldGroup className={cn('flex-row gap-4 [container-type:normal]', className)}>
            <Field className="min-w-0 flex-1">
                <FieldLabel htmlFor={`${idPrefix}-width-mm`} className="mb-0">
                    Chiều rộng (mm)
                </FieldLabel>
                <Input
                    id={`${idPrefix}-width-mm`}
                    name="pageWidthMm"
                    type="number"
                    min="0.1"
                    max="1000"
                    step="0.1"
                    required
                    value={width}
                    onChange={(event) => onWidthChange(event.target.value)}
                />
            </Field>
            <Field className="min-w-0 flex-1">
                <FieldLabel htmlFor={`${idPrefix}-height-mm`} className="mb-0">
                    Chiều cao (mm)
                </FieldLabel>
                <Input
                    id={`${idPrefix}-height-mm`}
                    name="pageHeightMm"
                    type="number"
                    min="0.1"
                    max="5000"
                    step="0.1"
                    required
                    value={height}
                    onChange={(event) => onHeightChange(event.target.value)}
                />
            </Field>
        </FieldGroup>
    );
}
