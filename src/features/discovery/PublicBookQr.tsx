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
            className="flex min-w-0 flex-wrap items-center justify-center gap-x-2.5 gap-y-1 rounded-xl bg-surface px-2 py-2.5 sm:px-3 md:grid md:grid-cols-[auto_minmax(0,1fr)] md:justify-start"
        >
            {qr.isPending ? (
                <>
                    <Skeleton
                        className="size-[74px] shrink-0 rounded-md sm:size-22"
                        aria-label="Đang tạo mã QR"
                    />
                    <Skeleton className="h-4 w-20 max-w-full" />
                </>
            ) : qr.isError ? (
                <div
                    role="status"
                    className="flex min-h-20 min-w-0 flex-col items-start justify-center gap-2 md:col-span-2"
                >
                    <p className="text-muted-foreground text-xs">
                        Chưa tạo được QR. Bạn vẫn có thể dùng nút Trải nghiệm.
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
                        width={88}
                        height={88}
                        className="size-[74px] shrink-0 rounded-md bg-white sm:size-22"
                        alt="Mã QR mở sách trên điện thoại"
                    />
                    <div className="flex min-w-0 flex-col items-center sm:items-start">
                        <p className="m-0 text-center font-medium text-foreground text-xs sm:text-left">
                            Quét để trải nghiệm trên điện thoại.
                        </p>
                        <Button
                            variant="link"
                            size="xs"
                            className="px-0 text-muted-foreground"
                            asChild
                        >
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
