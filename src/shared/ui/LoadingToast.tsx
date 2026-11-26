import { useEffect, useId } from 'react';
import { toast } from 'sonner';
import { Progress } from './primitives/progress';

export function LoadingToast({
    title,
    description,
    progress,
}: {
    title?: string | null;
    description?: string;
    progress?: number;
}) {
    const id = useId();

    useEffect(() => {
        if (title) {
            toast.loading(title, {
                id,
                description:
                    progress === undefined ? (
                        description
                    ) : (
                        <div className="flex items-center gap-2.5">
                            <Progress
                                aria-label="Tiến độ tải tệp"
                                value={progress}
                                className="h-1.5 min-w-0 flex-1 bg-on-dark/20 [&_[data-slot=progress-indicator]]:bg-on-dark"
                            />
                            <span className="shrink-0 tabular-nums">{progress}%</span>
                        </div>
                    ),
                classNames:
                    progress === undefined
                        ? undefined
                        : { toast: 'pr-6!', content: 'min-w-0 flex-1' },
                dismissible: false,
                style: { pointerEvents: 'none' },
            });
        } else {
            toast.dismiss(id);
        }
    }, [id, title, description, progress]);

    useEffect(
        () => () => {
            toast.dismiss(id);
        },
        [id],
    );

    return (
        <span role="status" className="sr-only">
            {title &&
                [title, progress === undefined ? description : `${progress}%`]
                    .filter(Boolean)
                    .join(' ')}
        </span>
    );
}
