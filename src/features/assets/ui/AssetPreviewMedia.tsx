import { Music2, RotateCcw, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { AssetMediaPreview } from '@/features/scene/ui/AssetMediaPreview';
import type { Asset } from '@/shared/contracts/dto.schema';
import { Button } from '@/shared/ui/Button';
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/shared/ui/primitives/empty';
import { Skeleton } from '@/shared/ui/primitives/skeleton';
import { Spinner } from '@/shared/ui/primitives/spinner';

export function AssetPreviewState({
    title,
    description,
    processing = false,
    retry,
}: {
    title: string;
    description: string;
    processing?: boolean;
    retry?: () => void;
}) {
    return (
        <Empty className="h-full rounded-none p-6" role="status">
            <EmptyHeader>
                <EmptyMedia>
                    {processing ? (
                        <Spinner className="size-8" />
                    ) : (
                        <TriangleAlert className="size-8 text-muted-foreground" strokeWidth={1.5} />
                    )}
                </EmptyMedia>
                <EmptyTitle>{title}</EmptyTitle>
                <EmptyDescription>{description}</EmptyDescription>
            </EmptyHeader>
            {retry && (
                <EmptyContent>
                    <Button variant="outline" onClick={retry}>
                        <RotateCcw data-icon="inline-start" />
                        Thử lại
                    </Button>
                </EmptyContent>
            )}
        </Empty>
    );
}

export function AssetFilePreview({ asset }: { asset: Asset }) {
    const [attempt, setAttempt] = useState(0);
    const [loaded, setLoaded] = useState(false);
    const [failed, setFailed] = useState(false);
    if (failed)
        return (
            <AssetPreviewState
                title="Chưa xem trước được tài nguyên"
                description="Thử tải lại phần xem trước hoặc mở tệp gốc bằng nút bên dưới."
                retry={() => {
                    setFailed(false);
                    setLoaded(false);
                    setAttempt((current) => current + 1);
                }}
            />
        );
    if (asset.type === 'MODEL') return <AssetMediaPreview type="MODEL" url={asset.url} />;
    if (asset.type === 'AUDIO')
        return (
            <div className="flex h-full min-h-0 items-center justify-center p-6 sm:p-10">
                <div className="flex w-full max-w-96 flex-col items-center gap-6 text-center">
                    <Music2 className="size-14" strokeWidth={1.25} aria-hidden="true" />
                    <p className="text-muted-foreground text-sm">Nghe thử âm thanh</p>
                    <audio
                        key={attempt}
                        src={asset.url}
                        controls
                        preload="metadata"
                        aria-label="Nghe thử âm thanh"
                        className="w-full"
                        onError={() => setFailed(true)}
                    >
                        <track kind="captions" />
                    </audio>
                </div>
            </div>
        );
    return (
        <div
            className="relative flex h-full min-h-0 items-center justify-center overflow-hidden p-4 sm:p-6"
            aria-busy={!loaded}
        >
            {!loaded && (
                <div className="absolute inset-4 sm:inset-6" role="status">
                    <span className="sr-only">Đang tải phần xem trước…</span>
                    <Skeleton className="size-full rounded-lg" />
                </div>
            )}
            {asset.type === 'IMAGE' ? (
                <img
                    key={attempt}
                    src={asset.url}
                    alt="Xem trước hình ảnh"
                    decoding="async"
                    className="relative max-h-full max-w-full object-contain"
                    onLoad={() => setLoaded(true)}
                    onError={() => setFailed(true)}
                />
            ) : (
                <video
                    key={attempt}
                    src={asset.url}
                    poster={asset.thumbnailUrl || undefined}
                    controls
                    playsInline
                    preload="metadata"
                    aria-label="Xem trước video"
                    className="relative max-h-full w-full object-contain"
                    onLoadedMetadata={() => setLoaded(true)}
                    onError={() => setFailed(true)}
                >
                    <track kind="captions" />
                </video>
            )}
        </div>
    );
}

export function assetDuration(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}
