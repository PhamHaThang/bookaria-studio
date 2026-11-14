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
        <FilterBar
            label="Trạng thái sách"
            variant="pill"
            value={status ?? 'all'}
            options={options}
            onValueChange={(value) => onChange(value === 'all' ? undefined : value)}
            resultCount={{ total, unit: 'cuốn sách' }}
        />
    );
}
