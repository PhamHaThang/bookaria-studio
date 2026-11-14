import { FilterBar } from '@/shared/ui/FilterBar';
import { bookStatusLabels } from '../model/search';

const options = [
    { value: 'all', label: 'Tất cả' },
    ...Object.entries(bookStatusLabels).map(([value, label]) => ({ value, label })),
];

export function BookStatusFilter({
    status,
    total,
    onChange,
}: {
    status?: string;
    total?: number;
    onChange: (status: string | undefined) => void;
}) {
    return (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <FilterBar
                label="Trạng thái sách"
                variant="pill"
                value={status ?? 'all'}
                options={options}
                onValueChange={(value) => onChange(value === 'all' ? undefined : value)}
            />
            <p className="m-0 ml-auto text-muted-foreground text-sm tabular-nums" role="status">
                {total !== undefined ? (
                    `${total} cuốn sách`
                ) : (
                    <span className="invisible" aria-hidden="true">
                        0 cuốn sách
                    </span>
                )}
            </p>
        </div>
    );
}
