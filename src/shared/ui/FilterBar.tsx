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
                <ToggleGroupItem
                    key={option.value}
                    value={option.value}
                    className={variant === 'pill' ? 'min-h-11 px-3.5' : undefined}
                >
                    {option.label}
                </ToggleGroupItem>
            ))}
        </ToggleGroup>
    );
    if (!resultCount) return filters;

    const { total, unit } = resultCount;
    return (
        <div data-slot="filter-bar" className="@container/filter-bar mb-4">
            <div className="flex min-w-0 @min-[44rem]/filter-bar:flex-row flex-col items-start @min-[44rem]/filter-bar:items-center @min-[44rem]/filter-bar:justify-between gap-x-4 gap-y-2">
                {filters}
                <p
                    className="m-0 shrink-0 @min-[44rem]/filter-bar:text-right text-muted-foreground text-xs tabular-nums leading-5"
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
        </div>
    );
}
