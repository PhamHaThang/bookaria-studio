import { Star } from 'lucide-react';
import type { MarkerAnalysisMetrics } from '@/shared/contracts/marker-analysis.schema';
import { cn } from '@/shared/lib/cn';

export function MarkerMetrics({
    analysis,
    compact = false,
}: {
    analysis: MarkerAnalysisMetrics;
    compact?: boolean;
}) {
    return (
        <dl className={cn('m-0 flex flex-col', compact ? 'gap-3' : 'gap-4')}>
            {(
                [
                    ['Phân bố điểm', analysis.distribution],
                    ['Độ độc đáo', analysis.uniqueness],
                    ['Kích thước ảnh', analysis.dimension],
                ] as const
            ).map(([title, value]) => (
                <div
                    key={title}
                    className={cn(
                        'grid items-center',
                        compact
                            ? 'grid-cols-[minmax(0,1fr)_138px_2.5rem] gap-x-2 text-xs'
                            : 'grid-cols-[minmax(0,1fr)_auto] gap-y-2 text-sm',
                    )}
                >
                    <dt>{title}</dt>
                    <dd
                        className={cn(
                            'm-0 text-right font-medium tabular-nums',
                            compact && 'col-start-3 row-start-1',
                        )}
                    >
                        {Math.round(value * 100)}%
                    </dd>
                    <div
                        className={cn(
                            'flex',
                            compact ? 'col-start-2 row-start-1 gap-0.5' : 'col-span-2 gap-1',
                        )}
                        role="img"
                        aria-label={`${title}: ${Math.round(value * 100)}%`}
                    >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((star) => (
                            <Star
                                key={star}
                                className={cn(
                                    'text-warning-foreground',
                                    compact ? 'size-3 shrink-0' : 'size-4',
                                )}
                                fill={value * 10 > star - 1 ? 'currentColor' : 'none'}
                                aria-hidden="true"
                            />
                        ))}
                    </div>
                </div>
            ))}
        </dl>
    );
}
