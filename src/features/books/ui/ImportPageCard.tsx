import { Eye } from 'lucide-react';
import type { MouseEventHandler, ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/primitives/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/shared/ui/primitives/card';
import type { ImportSource } from '../model/import-source';
import { ImportThumbnail } from './ImportThumbnail';

/** One visual layout for image imports and selectable PDF pages. */
export function ImportPageCard({
    source,
    index,
    title,
    description,
    previewLabel,
    onPreview,
    actions,
    reorderActions,
    selected = false,
    disabled = false,
}: {
    source: ImportSource;
    index: number;
    title: string;
    description: string;
    previewLabel: string;
    onPreview: MouseEventHandler<HTMLButtonElement>;
    actions: ReactNode;
    reorderActions?: ReactNode;
    selected?: boolean;
    disabled?: boolean;
}) {
    return (
        <Card
            variant="collection"
            className={cn(
                'flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-surface p-2',
                selected && 'border-primary',
            )}
        >
            <CardContent className="p-0">
                <Button
                    type="button"
                    variant="plain"
                    className="group relative block w-full cursor-zoom-in overflow-hidden rounded-lg"
                    aria-label={previewLabel}
                    disabled={disabled}
                    onClick={onPreview}
                >
                    <ImportThumbnail
                        source={source}
                        index={index}
                        className="aspect-square rounded-none bg-surface p-2"
                    />
                    <span
                        className="pointer-events-none absolute top-2 right-2 flex size-7 items-center justify-center rounded-md bg-surface text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                        aria-hidden="true"
                    >
                        <Eye className="size-4" />
                    </span>
                </Button>
            </CardContent>
            <CardHeader className="gap-0 px-1">
                <CardTitle className="truncate text-xs" title={title}>
                    {title}
                </CardTitle>
            </CardHeader>
            <CardFooter className="mt-auto min-h-8 justify-between gap-2 px-1">
                <CardDescription className="min-w-0 flex-1 truncate text-xs" title={description}>
                    {description}
                </CardDescription>
                <div className="flex shrink-0 items-center gap-1">{actions}</div>
            </CardFooter>
            {reorderActions && (
                <div className="flex items-center justify-end gap-1 px-1">{reorderActions}</div>
            )}
        </Card>
    );
}
