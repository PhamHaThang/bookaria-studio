import { ImageOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../../../shared/lib/cn';
import { Skeleton } from '../../../shared/ui/primitives/skeleton';
import type { ImportSource } from '../model/import-source';

export function ImportThumbnail({
    source,
    index,
    className,
}: {
    source: ImportSource;
    index: number;
    className?: string;
}) {
    const host = useRef<HTMLDivElement>(null);
    const [url, setUrl] = useState<string | null>(null);
    const [failed, setFailed] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        let started = false;
        setUrl(null);
        setFailed(false);
        const load = () => {
            if (started) return;
            started = true;
            void source.thumbnail(index, controller.signal).then(
                (url) => {
                    if (!controller.signal.aborted) setUrl(url);
                },
                () => {
                    if (!controller.signal.aborted) setFailed(true);
                },
            );
        };
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    observer.disconnect();
                    load();
                }
            },
            { rootMargin: '160px' },
        );
        if (host.current) observer.observe(host.current);
        return () => {
            observer.disconnect();
            controller.abort();
        };
    }, [source, index]);
    return (
        <div
            ref={host}
            className={cn(
                'flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-lg bg-muted',
                className,
            )}
            aria-hidden="true"
        >
            {url && !failed ? (
                <img
                    src={url}
                    alt=""
                    draggable={false}
                    className="pointer-events-none size-full select-none object-contain"
                    onError={() => setFailed(true)}
                />
            ) : failed ? (
                <ImageOff />
            ) : (
                <Skeleton className="size-full" />
            )}
        </div>
    );
}
