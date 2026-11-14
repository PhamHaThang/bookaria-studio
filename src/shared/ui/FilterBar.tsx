import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { ToggleGroup, ToggleGroupItem } from './primitives/toggle-group';

export function FilterBar({
    value,
    onValueChange,
    options,
    label,
    variant = 'line',
}: {
    value: string;
    onValueChange: (value: string) => void;
    options: { value: string; label: ReactNode }[];
    label: string;
    variant?: 'line' | 'pill';
}) {
    return (
        <ToggleGroup
            type="single"
            value={value}
            onValueChange={(next) => {
                if (next) onValueChange(next);
            }}
            variant={variant}
            size={variant === 'pill' ? 'lg' : undefined}
            spacing={variant === 'pill' ? 2 : 4}
            aria-label={label}
            className={cn(
                'justify-start',
                variant === 'pill' ? 'max-w-full flex-wrap' : 'mb-6 w-full',
            )}
        >
            {options.map((option) => (
                <ToggleGroupItem key={option.value} value={option.value}>
                    {option.label}
                </ToggleGroupItem>
            ))}
        </ToggleGroup>
    );
}
