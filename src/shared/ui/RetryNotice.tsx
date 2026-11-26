import { CircleAlert, RotateCw } from 'lucide-react';
import { Button } from './Button';
import { Spinner } from './primitives/spinner';

export function RetryNotice({
    message,
    detail,
    onRetry,
    busy = false,
    label = 'Thử tải lại',
}: {
    message: string;
    detail?: string;
    busy?: boolean;
    onRetry: () => void;
    label?: string;
}) {
    return (
        <div className="@container my-2 w-full min-w-0 max-w-2xl">
            <div className="grid @md:grid-cols-[auto_minmax(0,1fr)_auto] grid-cols-[auto_minmax(0,1fr)] items-start @md:items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-surface p-3">
                <span
                    className="grid size-8 shrink-0 place-items-center rounded-lg bg-danger text-danger-foreground"
                    aria-hidden="true"
                >
                    <CircleAlert className="size-4" />
                </span>
                <div role="alert" className="wrap-anywhere min-w-0 self-center text-sm leading-5">
                    <p className="m-0 font-medium text-foreground">{message}</p>
                    {detail && <p className="mt-1 mb-0 text-muted-foreground">{detail}</p>}
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="@md:col-start-3 col-start-2 justify-self-start"
                    onClick={onRetry}
                    disabled={busy}
                    aria-busy={busy}
                >
                    {busy ? (
                        <Spinner aria-hidden="true" />
                    ) : (
                        <RotateCw className="size-3.5" aria-hidden="true" />
                    )}
                    {label}
                </Button>
            </div>
        </div>
    );
}
