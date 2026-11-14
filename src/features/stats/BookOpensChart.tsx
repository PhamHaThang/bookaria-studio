import { useId } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import type { BookStats } from '@/shared/contracts/api/books.schema';
import { cn } from '@/shared/lib/cn';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/shared/ui/primitives/chart';

const config = { opens: { label: 'Lượt mở', color: 'var(--editor-axis-z)' } };
const fullDate = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeZone: 'UTC' });
const number = new Intl.NumberFormat('vi-VN');
const countAxis = {
    allowDecimals: false,
    tick: { fill: 'var(--text-muted)' },
    tickLine: false,
    axisLine: false,
    width: 'auto',
    tickFormatter: (value: number) => number.format(value),
} as const;

export function BookOpensChart({
    days,
    className,
}: {
    days: BookStats['opensByDay'];
    className?: string;
}) {
    const gradientId = useId();
    return (
        <ChartContainer
            config={config}
            className={cn('aspect-auto h-64 w-full', className)}
            aria-label="Biểu đồ lượt mở sách theo ngày"
        >
            <AreaChart accessibilityLayer data={days} margin={{ top: 8, right: 12, left: 2 }}>
                <defs>
                    <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="var(--color-opens)" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="var(--color-opens)" stopOpacity={0.025} />
                    </linearGradient>
                </defs>
                <CartesianGrid
                    vertical={false}
                    stroke="var(--border-default)"
                    strokeDasharray="4 5"
                />
                <XAxis
                    dataKey="date"
                    tick={countAxis.tick}
                    tickFormatter={(day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    minTickGap={24}
                />
                <YAxis {...countAxis} />
                <ChartTooltip
                    content={
                        <ChartTooltipContent
                            labelFormatter={(label) =>
                                fullDate.format(new Date(`${String(label)}T00:00:00Z`))
                            }
                        />
                    }
                />
                <Area
                    type="monotone"
                    dataKey="opens"
                    stroke="var(--color-opens)"
                    strokeWidth={2}
                    fill={`url(#${gradientId})`}
                    fillOpacity={1}
                    activeDot={{ r: 4, fill: 'var(--color-opens)' }}
                    isAnimationActive={false}
                />
            </AreaChart>
        </ChartContainer>
    );
}
