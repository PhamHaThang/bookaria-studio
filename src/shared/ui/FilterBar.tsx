import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { ToggleGroup, ToggleGroupItem } from './primitives/toggle-group';

export function FilterBar({
    value,
    onValueChange,
    options,
    label,
    variant = 'line',
    resultCount,
}: {
    value: string;
    onValueChange: (value: string) => void;
    options: { value: string; label: ReactNode }[];
    label: string;
    variant?: 'line' | 'pill';
    resultCount?: { total: number | undefined; unit: string };
}) {
    const filters = (
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
    if (!resultCount) return filters;

    const { total, unit } = resultCount;
    return (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            {filters}
            <p
                className="m-0 ml-auto shrink-0 whitespace-nowrap text-right text-muted-foreground text-sm tabular-nums"
                role="status"
            >
                {total === undefined ? (
                    <span className="invisible" aria-hidden="true">
                        0 {unit}
                    </span>
                ) : (
                    `${total.toLocaleString('vi-VN')} ${unit}`
                )}
            </p>
        </div>
    );
}
