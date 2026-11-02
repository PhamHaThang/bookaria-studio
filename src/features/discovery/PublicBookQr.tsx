import { useQuery } from '@tanstack/react-query';
import { Download, RotateCcw } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import { Skeleton } from '@/shared/ui/primitives/skeleton';
import { publishedReaderUrl } from './api';

export function PublicBookQr({ slug }: { slug: string }) {
    const url = publishedReaderUrl(slug);
    const qr = useQuery({
        queryKey: ['discovery', 'book-qr', url],
        queryFn: async () => {
            const { toDataURL } = await import('qrcode');
            return toDataURL(url, {
                width: 448,
                margin: 4,
                errorCorrectionLevel: 'M',
                color: { dark: '#000000', light: '#ffffff' },
            });
        },
        staleTime: Number.POSITIVE_INFINITY,
        retry: false,
    });
    return (
        <section
            aria-label="Mã QR mở sách"
            className="flex flex-col items-center gap-2 text-center"
        >
            {qr.isPending ? (
                <Skeleton className="size-36 rounded-lg" aria-label="Đang tạo mã QR" />
            ) : qr.isError ? (
                <div
                    role="status"
                    className="flex min-h-36 flex-col items-center justify-center gap-3"
                >
                    <p className="text-muted-foreground text-xs">
                        Chưa tạo được QR. Bạn vẫn có thể dùng nút Mở sách.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => void qr.refetch()}>
                        <RotateCcw data-icon="inline-start" />
                        Thử lại QR
                    </Button>
                </div>
            ) : (
                <>
                    <img
                        src={qr.data}
                        width={144}
                        height={144}
                        className="size-36 rounded-lg"
                        alt="Mã QR mở sách trên điện thoại"
                    />
                    <p className="text-muted-foreground text-xs">Quét để mở trên điện thoại.</p>
                    <Button variant="link" size="sm" asChild>
                        <a href={qr.data} download={`${slug}-qr.png`}>
                            <Download data-icon="inline-start" />
                            Tải mã QR
                        </a>
                    </Button>
                </>
            )}
        </section>
    );
}
