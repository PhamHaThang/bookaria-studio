import type { ReactNode } from 'react';
import { ToggleGroup, ToggleGroupItem } from './primitives/toggle-group';

export function FilterBar({
    value,
    onValueChange,
    options,
    label,
}: {
    value: string;
    onValueChange: (value: string) => void;
    options: { value: string; label: ReactNode }[];
    label: string;
}) {
    return (
        <ToggleGroup
            type="single"
            value={value}
            onValueChange={(next) => {
                if (next) onValueChange(next);
            }}
            variant="line"
            spacing={4}
            aria-label={label}
            className="mb-6 w-full justify-start border-border border-b"
        >
            {options.map((option) => (
                <ToggleGroupItem key={option.value} value={option.value}>
                    {option.label}
                </ToggleGroupItem>
            ))}
        </ToggleGroup>
    );
}
