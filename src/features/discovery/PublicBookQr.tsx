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
        networkMode: 'always',
        retry: false,
    });
    return (
        <section
            aria-label="Mã QR mở sách"
            className="col-span-2 grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-4 border-border border-t pt-4 lg:col-span-1 lg:flex lg:flex-col lg:gap-2 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6 lg:text-center"
        >
            {qr.isPending ? (
                <>
                    <Skeleton
                        className="size-28 rounded-lg lg:size-36"
                        aria-label="Đang tạo mã QR"
                    />
                    <Skeleton className="h-4 w-28 max-w-full" />
                </>
            ) : qr.isError ? (
                <div
                    role="status"
                    className="col-span-2 flex min-h-28 flex-col items-start justify-center gap-3 lg:min-h-36 lg:items-center"
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
                        className="size-28 rounded-lg lg:size-36"
                        alt="Mã QR mở sách trên điện thoại"
                    />
                    <div className="flex min-w-0 flex-col items-start gap-1 lg:items-center">
                        <p className="m-0 text-muted-foreground text-xs">
                            Quét để mở trên điện thoại.
                        </p>
                        <Button variant="link" size="sm" className="px-0" asChild>
                            <a href={qr.data} download={`${slug}-qr.png`}>
                                <Download data-icon="inline-start" />
                                Tải mã QR
                            </a>
                        </Button>
                    </div>
                </>
            )}
        </section>
    );
}
