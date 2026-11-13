import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { Button } from '@/shared/ui/Button';
import { Spinner } from '@/shared/ui/primitives/spinner';

export default function PdfFlipReader({
    url,
    title,
    onClose,
}: {
    url: string;
    title: string;
    onClose: () => void;
}) {
    const { theme, setPreference } = useTheme();
    const [initialTheme] = useState(theme);
    const frame = useRef<HTMLIFrameElement>(null);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const src = new URL(`${import.meta.env.BASE_URL}pdf-reader/index.html`, window.location.href);
    src.hash = new URLSearchParams({
        pdf: url,
        title,
        theme: initialTheme,
    }).toString();

    useEffect(() => {
        async function receive(event: MessageEvent) {
            if (
                event.origin !== window.location.origin ||
                event.source !== frame.current?.contentWindow ||
                event.data?.source !== 'bookaria-pdf'
            ) {
                return;
            }
            if (event.data.type === 'ready' || event.data.type === 'error') {
                setStatus(event.data.type);
            } else if (event.data.type === 'close') {
                onClose();
            } else if (event.data.type === 'theme') {
                setPreference(theme === 'dark' ? 'light' : 'dark');
            } else if (event.data.type === 'share') {
                try {
                    await navigator.clipboard.writeText(url);
                    toast.success('Đã sao chép liên kết PDF.');
                } catch {
                    toast.error('Chưa sao chép được liên kết PDF.');
                }
            }
        }
        window.addEventListener('message', receive);
        return () => window.removeEventListener('message', receive);
    }, [onClose, setPreference, theme, url]);

    useEffect(() => {
        if (status === 'ready') {
            frame.current?.contentWindow?.postMessage(
                { type: 'pdf-reader-theme', theme },
                window.location.origin,
            );
        }
    }, [status, theme]);

    useEffect(() => {
        if (status !== 'loading') return;
        const timeout = window.setTimeout(() => setStatus('error'), 45_000);
        return () => window.clearTimeout(timeout);
    }, [status]);

    return (
        <div className="relative min-h-0 flex-1">
            {status !== 'error' && (
                <iframe
                    ref={frame}
                    title={title}
                    src={src.href}
                    sandbox="allow-scripts allow-same-origin allow-downloads"
                    allowFullScreen
                    referrerPolicy="no-referrer"
                    className="block size-full border-0"
                />
            )}
            {status === 'loading' && (
                <div
                    role="status"
                    className="absolute inset-0 flex items-center justify-center gap-2 bg-[var(--editor-ground)]"
                >
                    <Spinner /> Đang mở PDF…
                </div>
            )}
            {status === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
                    <p role="alert" className="font-medium">
                        Không mở được bản in PDF.
                    </p>
                    <div className="flex items-center gap-2">
                        <Button type="button" onClick={() => setStatus('loading')}>
                            Thử lại
                        </Button>
                        <Button asChild variant="outline">
                            <a href={url} target="_blank" rel="noreferrer">
                                Mở tệp gốc
                            </a>
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
