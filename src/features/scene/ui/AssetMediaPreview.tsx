import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Spinner } from '@/shared/ui/primitives/spinner';
import type { AssetType } from '../../../shared/contracts/enums.schema';

import type { ModelPreviewOptions } from './ModelPreview';

const ModelPreview = lazy(() => import('./ModelPreview'));
export function useFileUrl(file: File | null) {
    const [value, setValue] = useState<{ file: File; url: string } | null>(null);
    useEffect(() => {
        if (!file) {
            setValue(null);
            return;
        }
        const url = URL.createObjectURL(file);
        setValue({ file, url });
        return () => URL.revokeObjectURL(url);
    }, [file]);
    return value?.file === file ? value?.url : undefined;
}
export function AssetMediaPreview({
    type,
    url,
    modelOptions,
    audioLabel = 'Nghe thử âm thanh',
}: {
    type: AssetType;
    url: string;
    modelOptions?: ModelPreviewOptions;
    audioLabel?: string;
}) {
    const audio = useRef<HTMLAudioElement>(null);
    const video = useRef<HTMLVideoElement>(null);
    useEffect(() => {
        const current = type === 'AUDIO' ? audio.current : video.current;
        if (!current || current.getAttribute('src') !== url) return;
        return () => {
            current?.pause();
        };
    }, [type, url]);
    const [failedUrl, setFailedUrl] = useState<string | null>(null);
    if (failedUrl === url)
        return (
            <p role="status" className="m-auto p-8 text-center text-muted-foreground text-sm">
                Chưa xem trước được tệp này. Bạn vẫn có thể thay tệp hoặc thử lại.
            </p>
        );
    if (type === 'MODEL')
        return (
            <Suspense
                fallback={
                    <div role="status" className="grid h-full min-h-0 place-content-center gap-3">
                        <Spinner className="mx-auto" />
                        Đang mở trình xem 3D…
                    </div>
                }
            >
                <ModelPreview url={url} {...modelOptions} />
            </Suspense>
        );
    if (type === 'IMAGE')
        return (
            <img
                src={url}
                alt="Xem trước hình ảnh"
                className="h-full min-h-0 w-full flex-1 object-contain p-4"
                onError={() => setFailedUrl(url)}
            />
        );
    if (type === 'VIDEO')
        return (
            <video
                ref={video}
                key={url}
                src={url}
                controls
                playsInline
                preload="metadata"
                aria-label="Xem trước video"
                className="h-full min-h-0 w-full flex-1 object-contain"
                onError={() => setFailedUrl(url)}
            >
                <track kind="captions" />
            </video>
        );
    return (
        <div className="grid h-full min-h-0 w-full place-items-center p-2">
            <audio
                ref={audio}
                key={url}
                src={url}
                controls
                preload="metadata"
                aria-label={audioLabel}
                className="h-9 w-full min-w-0"
                onError={() => setFailedUrl(url)}
            >
                <track kind="captions" />
            </audio>
        </div>
    );
}
