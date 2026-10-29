import { ToggleGroup } from '@animate-ui/react/primitives/radix-ui/toggle-group';
import { Eye, Pencil, Zap } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { toggleVariants } from '@/shared/ui/primitives/toggle';

const MODES = [
    { value: 'properties', label: 'Thiết kế', icon: Pencil },
    { value: 'interactions', label: 'Tương tác', icon: Zap },
    { value: 'preview', label: 'Xem trước', icon: Eye },
] as const;

export function SceneModeSwitcher({
    value,
    disabled,
    onValueChange,
}: {
    value: (typeof MODES)[number]['value'];
    disabled: boolean;
    onValueChange: (value: (typeof MODES)[number]['value']) => void;
}) {
    return (
        <ToggleGroup.Root
            type="single"
            value={value}
            onValueChange={(next) => {
                const mode = MODES.find((item) => item.value === next);
                if (mode) onValueChange(mode.value);
            }}
            disabled={disabled}
            aria-label="Chế độ làm việc"
            data-slot="toggle-group"
            className="group/toggle-group flex w-fit items-center gap-1 justify-self-center rounded-xl border border-border bg-surface p-1"
        >
            {MODES.map(({ value: mode, label, icon: Icon }) => (
                <ToggleGroup.Item
                    key={mode}
                    value={mode}
                    data-slot="toggle-group-item"
                    aria-controls={`panel-${mode}`}
                    className={cn(toggleVariants(), 'gap-2 px-3 transition-colors duration-200')}
                >
                    <Icon data-icon="inline-start" />
                    {label}
                </ToggleGroup.Item>
            ))}
        </ToggleGroup.Root>
    );
}
