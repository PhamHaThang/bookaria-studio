import type { ReactNode } from 'react';
import type { AssetType } from '@/shared/contracts/enums.schema';
import { FilterBar } from '@/shared/ui/FilterBar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/primitives/tabs';

const types = [
    { value: 'all', label: 'Tất cả' },
    { value: 'IMAGE', label: 'Hình ảnh' },
    { value: 'AUDIO', label: 'Âm thanh' },
    { value: 'VIDEO', label: 'Video' },
    { value: 'MODEL', label: '3D' },
] as const;

export function AssetTypeTabs({
    value,
    onValueChange,
    children,
    variant = 'default',
}: {
    value?: AssetType;
    variant?: 'default' | 'line';
    onValueChange: (value: AssetType | undefined) => void;
    children: ReactNode;
}) {
    if (variant === 'line')
        return (
            <>
                <FilterBar
                    value={value || 'all'}
                    onValueChange={(next) =>
                        onValueChange(next === 'all' ? undefined : (next as AssetType))
                    }
                    options={types.map((type) => ({ ...type }))}
                    label="Loại tài nguyên"
                />
                {children}
            </>
        );
    return (
        <Tabs
            value={value || 'all'}
            onValueChange={(next) =>
                onValueChange(next === 'all' ? undefined : (next as AssetType))
            }
            className="min-w-0 gap-6"
        >
            <div className="overflow-x-auto">
                <TabsList variant={variant} aria-label="Loại tài nguyên">
                    {types.map((type) => (
                        <TabsTrigger
                            key={type.value}
                            value={type.value}
                            className="flex-none max-sm:px-2"
                        >
                            {type.label}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </div>
            {types.map((type) => (
                <TabsContent key={type.value} value={type.value}>
                    {type.value === (value || 'all') ? children : null}
                </TabsContent>
            ))}
        </Tabs>
    );
}
