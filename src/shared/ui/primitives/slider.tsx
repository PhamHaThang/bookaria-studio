import { Slider as SliderPrimitive } from 'radix-ui';
import { type ComponentProps, useMemo } from 'react';
import { cn } from '@/shared/lib/cn';

/** shadcn Slider, composed with the project's existing Radix primitives and theme. */
function Slider({
    className,
    defaultValue,
    value,
    min = 0,
    max = 100,
    'aria-label': label,
    'aria-labelledby': labelledBy,
    'aria-valuetext': valueText,
    ...props
}: ComponentProps<typeof SliderPrimitive.Root>) {
    const values = useMemo(() => value ?? defaultValue ?? [min], [value, defaultValue, min]);
    return (
        <SliderPrimitive.Root
            data-slot="slider"
            defaultValue={defaultValue}
            value={value}
            min={min}
            max={max}
            className={cn(
                'relative flex min-h-10 w-full touch-none select-none items-center data-[orientation=vertical]:min-h-40 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col data-[disabled]:opacity-50',
                className,
            )}
            {...props}
        >
            <SliderPrimitive.Track
                data-slot="slider-track"
                className="relative grow overflow-hidden rounded-full bg-border data-[orientation=horizontal]:h-1 data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-1"
            >
                <SliderPrimitive.Range
                    data-slot="slider-range"
                    className="absolute bg-primary data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
                />
            </SliderPrimitive.Track>
            {values.map((_, index) => (
                <SliderPrimitive.Thumb
                    data-slot="slider-thumb"
                    // biome-ignore lint/suspicious/noArrayIndexKey: Thumb identity follows its fixed slot; value keys would remount it while dragging.
                    key={index}
                    aria-label={label}
                    aria-labelledby={labelledBy}
                    aria-valuetext={valueText}
                    className="relative block size-4 shrink-0 rounded-full border border-primary bg-surface outline-none ring-ring/50 transition-shadow after:absolute after:-inset-2 hover:ring-3 focus-visible:ring-3 data-[disabled]:pointer-events-none"
                />
            ))}
        </SliderPrimitive.Root>
    );
}

export { Slider };
