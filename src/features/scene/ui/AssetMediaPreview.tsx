import { lazy, Suspense, useEffect, useState } from 'react';
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
}: {
    type: AssetType;
    url: string;
    modelOptions?: ModelPreviewOptions;
}) {
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
        <div className="grid h-full min-h-0 place-items-center p-4">
            <audio
                key={url}
                src={url}
                controls
                preload="metadata"
                aria-label="Nghe thử âm thanh"
                onError={() => setFailedUrl(url)}
            >
                <track kind="captions" />
            </audio>
        </div>
    );
}
