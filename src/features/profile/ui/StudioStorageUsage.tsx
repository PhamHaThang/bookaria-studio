import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '@/features/auth/model/session';
import { formatBytes } from '@/shared/lib/format';
import { Button } from '@/shared/ui/primitives/button';
import { Progress } from '@/shared/ui/primitives/progress';
import { Skeleton } from '@/shared/ui/primitives/skeleton';
import { profileApi, profileKey } from '../model/profile';

export function StudioStorageUsage() {
    const { user } = useAuth();
    const profile = useQuery({
        queryKey: profileKey(user?.id || ''),
        queryFn: ({ signal }) => profileApi.get(signal),
        enabled: Boolean(user),
        staleTime: 60000,
        refetchOnWindowFocus: false,
    });
    const storage = profile.data?.storage;
    return (
        <section
            aria-label="Dung lượng tài nguyên"
            className="w-full rounded-[var(--radius-control)] border border-border bg-surface p-3"
        >
            {storage ? (
                <>
                    <div className="flex flex-col gap-1 text-xs">
                        <span className="font-medium">Dung lượng tài nguyên</span>
                        <span className="whitespace-nowrap text-muted-foreground tabular-nums">
                            {formatBytes(storage.usedBytes)} / {formatBytes(storage.quotaBytes)}
                        </span>
                    </div>
                    <Progress
                        className="mt-2.5 h-1.5 bg-border"
                        aria-label="Dung lượng đã sử dụng"
                        aria-valuetext={`${formatBytes(storage.usedBytes)} trên ${formatBytes(storage.quotaBytes)}`}
                        max={Math.max(1, storage.quotaBytes)}
                        value={storage.usedBytes}
                    />
                    {storage.usedBytes >= storage.quotaBytes && (
                        <span className="sr-only">Đã chạm hạn mức dung lượng.</span>
                    )}
                </>
            ) : profile.isError ? (
                <div className="flex items-center justify-between gap-2 text-muted-foreground text-xs">
                    <span role="status">Chưa tải được dung lượng</span>
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Tải lại dung lượng"
                        title="Tải lại dung lượng"
                        disabled={profile.isFetching}
                        onClick={() => void profile.refetch()}
                    >
                        <RefreshCw aria-hidden="true" />
                    </Button>
                </div>
            ) : (
                <div role="status" aria-label="Đang tải dung lượng" className="flex flex-col gap-2">
                    <Skeleton className="h-3 w-4/5" />
                    <Skeleton className="h-3 w-3/5" />
                    <Skeleton className="mt-0.5 h-1.5 w-full" />
                </div>
            )}
        </section>
    );
}
