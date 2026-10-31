import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Move, Printer, RefreshCw, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '@/shared/api/client';
import { errorMessage } from '@/shared/api/errors';
import type { PrintPdfBody } from '@/shared/contracts/api/publish.schema';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { FormSelect } from '@/shared/ui/FormSelect';
import { Field, FieldGroup, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import { Spinner } from '@/shared/ui/primitives/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/primitives/tooltip';
import { createPublicationApi } from '../api/publication-api';

const api = createPublicationApi(apiClient);
type Placement = NonNullable<PrintPdfBody['qrPlacements']>[number];
export type PrintLayoutDraft = {
    versionId: string;
    kind: PrintPdfBody['kind'];
    index: number;
    placements: Record<string, Placement>;
};
type Pdf = { url: string; kind: string; versionNo: number | null };

export function PrintLayoutEditor({
    bookId,
    draftRef,
    qrUrl,
    disabled,
    pdf,
    onExport,
    onClose,
}: {
    bookId: string;
    draftRef: React.RefObject<PrintLayoutDraft | null>;
    qrUrl?: string;
    disabled: boolean;
    pdf: Pdf | null;
    onExport: (body: PrintPdfBody, versionNo: number) => void;
    onClose: () => void;
}) {
    const query = useQuery({
        queryKey: ['print-layout', bookId],
        queryFn: ({ signal }) => api.printLayout(bookId, signal),
        retry: false,
        staleTime: 0,
    });
    if (query.isPending)
        return (
            <div role="status" className="flex min-h-64 items-center justify-center gap-2">
                <Spinner />
                Đang tải bố cục bản xuất bản…
            </div>
        );
    if (query.isError)
        return (
            <Alert tone="danger">
                {errorMessage(query.error)}{' '}
                <Button variant="link" onClick={() => void query.refetch()}>
                    Thử lại
                </Button>
            </Alert>
        );
    return (
        <Layout
            key={query.data.versionId}
            data={query.data}
            draftRef={draftRef}
            bookId={bookId}
            qrUrl={qrUrl}
            disabled={disabled}
            pdf={pdf}
            onExport={onExport}
            onClose={onClose}
            refreshing={query.isFetching}
            reload={() => void query.refetch()}
        />
    );
}

function Layout({
    bookId,
    draftRef,
    data,
    qrUrl,
    disabled,
    pdf,
    onExport,
    onClose,
    reload,
    refreshing,
}: {
    bookId: string;
    draftRef: React.RefObject<PrintLayoutDraft | null>;
    data: Awaited<ReturnType<typeof api.printLayout>>;
    qrUrl?: string;
    disabled: boolean;
    pdf: Pdf | null;
    onExport: (body: PrintPdfBody, versionNo: number) => void;
    onClose: () => void;
    reload: () => void;
    refreshing: boolean;
}) {
    const saved = draftRef.current?.versionId === data.versionId ? draftRef.current : null;
    const [kind, setKind] = useState<PrintPdfBody['kind']>(saved?.kind ?? 'PRINT');
    const [index, setIndex] = useState(saved?.index ?? -1);
    const [placements, setPlacements] = useState<Record<string, Placement>>(
        saved?.placements.cover ? { cover: saved.placements.cover } : {},
    );
    useEffect(() => {
        draftRef.current = { versionId: data.versionId, kind, index, placements };
    }, [draftRef, data.versionId, kind, index, placements]);
    const [error, setError] = useState<string | null>(null);
    const [failedImages, setFailedImages] = useState<string[]>([]);
    const svg = useRef<SVGSVGElement>(null);
    const drag = useRef<{ id: number; x: number; y: number; placement: Placement } | null>(null);
    const sticker = kind === 'MARKER_SHEET';
    const pages = sticker ? data.pages.filter((p) => p.marker) : data.pages;
    const page = pages[index];
    const width = sticker ? 210 : data.widthMm,
        height = sticker ? 297 : data.heightMm;
    const finiteMargin = sticker ? 0 : 4;
    const key = 'cover';
    const hasQr = !sticker && !page;
    const qr = hasQr ? (placements.cover ?? data.coverQr) : null;
    const marker = page?.marker;
    useEffect(() => {
        if (sticker && index < 0) setIndex(0);
    }, [sticker, index]);
    const issue = (q: Placement): string | null => {
        if (![q.xMm, q.yMm, q.sizeMm].every(Number.isFinite))
            return 'Nhập tọa độ và kích thước QR hợp lệ.';
        if (q.sizeMm < 30 || q.sizeMm > 60) return 'Cạnh QR cần từ 30 đến 60 mm.';
        if (
            Math.min(
                q.xMm,
                q.yMm,
                data.widthMm - q.xMm - q.sizeMm,
                data.heightMm - q.yMm - q.sizeMm,
            ) < 11.999
        )
            return 'QR cần cách mép trang ít nhất 12 mm.';
        return null;
    };
    const activePlacements = placements.cover ? [placements.cover] : [];
    const problems = sticker ? [] : activePlacements.map(issue).filter(Boolean);
    const currentIssue = qr ? issue(qr) : null;
    const unavailable = sticker && !pages.length;
    const invalid = unavailable || problems.length > 0 || Boolean(currentIssue);
    function changeQr(next: Placement) {
        setPlacements((p) => ({ ...p, [key]: next }));
        setError(null);
    }
    function pointer(e: React.PointerEvent) {
        const matrix = svg.current?.getScreenCTM();
        return matrix ? new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse()) : null;
    }
    function start(e: React.PointerEvent<SVGRectElement>) {
        if (disabled || !qr || e.button !== 0) return;
        const point = pointer(e);
        if (!point) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { id: e.pointerId, x: point.x, y: point.y, placement: { ...qr } };
    }
    function move(e: React.PointerEvent<SVGRectElement>) {
        const from = drag.current;
        if (!from || from.id !== e.pointerId) return;
        const point = pointer(e);
        if (!point) return;
        const q = from.placement;
        const x = Math.max(12, Math.min(data.widthMm - q.sizeMm - 12, q.xMm + point.x - from.x));
        const maxY = data.heightMm - q.sizeMm - 12;
        const y = Math.max(12, Math.min(maxY, q.yMm - (point.y - from.y)));
        changeQr({ ...q, xMm: Math.round(x * 10) / 10, yMm: Math.round(y * 10) / 10 });
    }
    function end(e: React.PointerEvent<SVGRectElement>) {
        if (drag.current?.id === e.pointerId) drag.current = null;
    }
    function failImage(url: string) {
        setFailedImages((old) => (old.includes(url) ? old : [...old, url]));
    }
    const previewBroken =
        Boolean(!page && !sticker && data.coverUrl && failedImages.includes(data.coverUrl)) ||
        Boolean(page && failedImages.includes(page.imageUrl)) ||
        Boolean(marker && failedImages.includes(marker.imageUrl));
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-5">
            <div className="flex min-w-0 flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                        <h3 className="font-semibold">Bố cục in - Phiên bản {data.versionNo}</h3>
                        <span className="text-muted-foreground text-xs">
                            {!page
                                ? 'Bìa - '
                                : `Trang ${data.pages.findIndex((p) => p.pageId === page.pageId) + 1} -`}
                            {width} × {Number(height.toFixed(1))} mm -{' '}
                            {sticker ? 'Tờ marker A4' : 'Khổ thành phẩm'}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label="Tải lại bố cục"
                                    disabled={disabled || refreshing}
                                    onClick={() => {
                                        setFailedImages([]);
                                        setError(null);
                                        reload();
                                    }}
                                >
                                    <RefreshCw
                                        data-refreshing={refreshing}
                                        className="data-[refreshing=true]:animate-spin motion-reduce:animate-none"
                                    />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Tải lại bố cục</TooltipContent>
                        </Tooltip>
                    </div>
                </div>
                <div className="flex h-72 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface p-3 [@media(min-height:900px)]:h-96">
                    <svg
                        ref={svg}
                        viewBox={`${-finiteMargin} ${-finiteMargin} ${width + finiteMargin * 2} ${height + finiteMargin * 2}`}
                        className="size-full select-none"
                        aria-label={`Bản xem trước bố cục ${page ? `trang ${index + 1}` : 'bìa'}`}
                    >
                        <rect
                            x={-finiteMargin}
                            y={-finiteMargin}
                            width={width + finiteMargin * 2}
                            height={height + finiteMargin * 2}
                            fill="white"
                        />
                        <rect
                            width={width}
                            height={height}
                            fill="white"
                            stroke="#858585"
                            strokeWidth={0.4}
                        />
                        {!sticker && (
                            <rect
                                x={12}
                                y={12}
                                width={Math.max(0, width - 24)}
                                height={Math.max(0, height - 24)}
                                fill="none"
                                stroke="#94a3b8"
                                strokeDasharray="2 2"
                                strokeWidth={0.35}
                                pointerEvents="none"
                            />
                        )}
                        {page && !sticker && !failedImages.includes(page.imageUrl) && (
                            <image
                                href={page.imageUrl}
                                width={width}
                                height={height}
                                preserveAspectRatio="none"
                                onError={() => failImage(page.imageUrl)}
                            />
                        )}
                        {!page &&
                            !sticker &&
                            (data.coverUrl ? (
                                <image
                                    href={data.coverUrl}
                                    width={width}
                                    height={height}
                                    preserveAspectRatio="xMidYMid meet"
                                    onError={() => {
                                        if (data.coverUrl) failImage(data.coverUrl);
                                    }}
                                />
                            ) : (
                                <image
                                    href="/brand/bookaria-symbol.svg"
                                    x={width * 0.3}
                                    y={(height - (width * 0.4 * 256) / 506) / 2}
                                    width={width * 0.4}
                                    height={(width * 0.4 * 256) / 506}
                                />
                            ))}
                        {marker && (
                            <>
                                <image
                                    href={marker.imageUrl}
                                    x={sticker ? 18 : marker.xMm}
                                    y={sticker ? 67 : height - marker.yMm - marker.sizeMm}
                                    width={marker.sizeMm}
                                    height={marker.sizeMm}
                                    onError={() => failImage(marker.imageUrl)}
                                />
                                <rect
                                    x={sticker ? 18 : marker.xMm}
                                    y={sticker ? 67 : height - marker.yMm - marker.sizeMm}
                                    width={marker.sizeMm}
                                    height={marker.sizeMm}
                                    fill="none"
                                    stroke="#252525"
                                    strokeWidth={0.3}
                                />
                            </>
                        )}
                        {sticker && page && (
                            <g fill="#252525" fontFamily="sans-serif" fontSize={3.5}>
                                <text x={18} y={18} fontSize={5}>
                                    BOOKARIA / TỜ TEM MARKER
                                </text>
                                <text x={18} y={30}>
                                    {data.title.slice(0, 60)}
                                </text>
                                <text x={18} y={46}>
                                    Trang{' '}
                                    {data.pages.findIndex((p) => p.pageId === page.pageId) + 1} |
                                    Marker #{marker?.number} | Phiên bản {data.versionNo}
                                </text>
                                <text x={18} y={56}>
                                    Cạnh marker: {marker?.sizeMm.toFixed(1)} mm | In 100%
                                </text>
                                <text x={18} y={228}>
                                    Sơ đồ dán và thước đo nằm trong PDF.
                                </text>
                            </g>
                        )}
                        {qr &&
                            [qr.xMm, qr.yMm, qr.sizeMm].every(Number.isFinite) &&
                            qr.sizeMm > 0 && (
                                <g>
                                    <rect
                                        x={qr.xMm}
                                        y={height - qr.yMm - qr.sizeMm}
                                        width={qr.sizeMm}
                                        height={qr.sizeMm}
                                        fill="white"
                                    />
                                    {qrUrl && !failedImages.includes(qrUrl) ? (
                                        <image
                                            href={qrUrl}
                                            x={qr.xMm}
                                            y={height - qr.yMm - qr.sizeMm}
                                            width={qr.sizeMm}
                                            height={qr.sizeMm}
                                            onError={() => failImage(qrUrl)}
                                        />
                                    ) : (
                                        <text
                                            x={qr.xMm + qr.sizeMm / 2}
                                            y={height - qr.yMm - qr.sizeMm / 2}
                                            textAnchor="middle"
                                            fontSize={5}
                                        >
                                            QR
                                        </text>
                                    )}
                                    {/* biome-ignore lint/a11y/useSemanticElements: SVG drag handle must remain in page coordinates; keyboard arrows and numeric inputs provide equivalent controls. */}
                                    <rect
                                        role="button"
                                        tabIndex={disabled ? -1 : 0}
                                        aria-label="Di chuyển QR trên bản in"
                                        aria-describedby="print-qr-help"
                                        x={qr.xMm}
                                        y={height - qr.yMm - qr.sizeMm}
                                        width={qr.sizeMm}
                                        height={qr.sizeMm}
                                        fill="transparent"
                                        stroke={currentIssue ? '#a42b22' : '#252525'}
                                        strokeWidth={0.8}
                                        strokeDasharray="2 1"
                                        className="cursor-move touch-none focus:outline-none"
                                        onPointerDown={start}
                                        onPointerMove={move}
                                        onPointerUp={end}
                                        onPointerCancel={end}
                                        onLostPointerCapture={end}
                                        onKeyDown={(e) => {
                                            if (
                                                !disabled &&
                                                [
                                                    'ArrowLeft',
                                                    'ArrowRight',
                                                    'ArrowUp',
                                                    'ArrowDown',
                                                ].includes(e.key)
                                            ) {
                                                e.preventDefault();
                                                const step = e.shiftKey ? 5 : 1;
                                                changeQr({
                                                    ...qr,
                                                    xMm:
                                                        qr.xMm +
                                                        (e.key === 'ArrowLeft'
                                                            ? -step
                                                            : e.key === 'ArrowRight'
                                                              ? step
                                                              : 0),
                                                    yMm:
                                                        qr.yMm +
                                                        (e.key === 'ArrowDown'
                                                            ? -step
                                                            : e.key === 'ArrowUp'
                                                              ? step
                                                              : 0),
                                                });
                                            }
                                        }}
                                    />
                                    {!page && (
                                        <text
                                            x={qr.xMm}
                                            y={height - qr.yMm + 5}
                                            fontFamily="sans-serif"
                                            fontSize={2.8}
                                        >
                                            Quét QR mở sách
                                        </text>
                                    )}
                                </g>
                            )}
                    </svg>
                </div>
                <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Chọn trang in">
                    {!sticker && (
                        <Button
                            size="xs"
                            variant={index === -1 ? 'default' : 'outline'}
                            onClick={() => setIndex(-1)}
                        >
                            Bìa
                        </Button>
                    )}
                    {pages.map((p, i) => (
                        <Button
                            key={p.pageId}
                            size="xs"
                            variant={index === i ? 'default' : 'outline'}
                            aria-label={`Xem trang in ${data.pages.findIndex((x) => x.pageId === p.pageId) + 1}`}
                            onClick={() => setIndex(i)}
                        >
                            {data.pages.findIndex((x) => x.pageId === p.pageId) + 1}
                        </Button>
                    ))}
                </nav>
                <p className="text-muted-foreground text-xs">
                    Xem bố cục thành phẩm. PDF có thêm dấu cắt và một trang trắng sau bìa để in hai
                    mặt.
                </p>
            </div>
            <div className="flex min-w-0 flex-col gap-4 border-border border-l pl-5">
                <Button
                    disabled={disabled || invalid || previewBroken}
                    onClick={() => {
                        setError(null);
                        onExport(
                            {
                                kind,
                                qrMode: 'COVER_ONLY',
                                bleedMm: 0,
                                versionId: data.versionId,
                                qrPlacements: sticker ? [] : activePlacements,
                            },
                            data.versionNo,
                        );
                    }}
                >
                    <Printer data-icon="inline-start" />
                    Tạo PDF
                </Button>
                <FieldGroup className="grid grid-cols-1 gap-3">
                    <Field>
                        <FieldLabel htmlFor="visual-print-kind">Tài liệu</FieldLabel>
                        <FormSelect
                            id="visual-print-kind"
                            value={kind}
                            disabled={disabled}
                            onValueChange={(v) => {
                                setKind(v as typeof kind);
                                setIndex(v === 'PRINT' ? -1 : 0);
                                setError(null);
                            }}
                            options={[
                                { value: 'PRINT', label: 'Sách PDF có marker' },
                                { value: 'MARKER_SHEET', label: 'Tờ marker để dán' },
                            ]}
                        />
                    </Field>
                </FieldGroup>
                {!sticker && (
                    <p className="text-muted-foreground text-xs">
                        QR mở sách chỉ hiển thị trên bìa.
                    </p>
                )}
                {qr && (
                    <div className="flex flex-col gap-3 border-border border-t pt-4">
                        <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2 font-medium text-sm">
                                <Move size={16} />
                                Vị trí QR
                            </span>
                            <Button
                                variant="ghost"
                                size="icon-xs"
                                aria-label="Đặt lại vị trí QR"
                                disabled={disabled || !placements[key]}
                                onClick={() =>
                                    setPlacements((old) => {
                                        const next = { ...old };
                                        delete next[key];
                                        return next;
                                    })
                                }
                            >
                                <RotateCcw />
                            </Button>
                        </div>
                        <p id="print-qr-help" className="text-muted-foreground text-xs">
                            Kéo QR hoặc dùng phím mũi tên. Số đo từ mép trái và mép dưới trang.
                        </p>
                        <FieldGroup className="grid grid-cols-3 gap-2">
                            {(['xMm', 'yMm', 'sizeMm'] as const).map((field, i) => (
                                <Field key={field}>
                                    <FieldLabel htmlFor={`print-${field}`}>
                                        {['Trái (mm)', 'Dưới (mm)', 'Cạnh (mm)'][i]}
                                    </FieldLabel>
                                    <Input
                                        id={`print-${field}`}
                                        aria-label={['Trái (mm)', 'Dưới (mm)', 'Cạnh QR (mm)'][i]}
                                        type="number"
                                        min={field === 'sizeMm' ? 30 : 12}
                                        max={field === 'sizeMm' ? 60 : undefined}
                                        step={0.1}
                                        disabled={disabled}
                                        value={Number.isFinite(qr[field]) ? qr[field] : ''}
                                        onChange={(e) =>
                                            changeQr({
                                                ...qr,
                                                [field]:
                                                    e.target.value === ''
                                                        ? Number.NaN
                                                        : Number(e.target.value),
                                            })
                                        }
                                    />
                                </Field>
                            ))}
                        </FieldGroup>
                    </div>
                )}
                {marker && !sticker && (
                    <p className="text-muted-foreground text-xs leading-relaxed">
                        Marker #{marker.number} giữ nguyên vị trí AR.{' '}
                        <Link
                            to={`/books/${bookId}/pages/${page.pageId}`}
                            onClick={onClose}
                            className="underline underline-offset-4"
                        >
                            Chỉnh marker trong editor
                        </Link>
                        , rồi xuất bản lại.
                    </p>
                )}
                {!hasQr && !sticker && (
                    <p className="text-muted-foreground text-xs leading-relaxed">
                        {page?.markerMode === 'CUSTOM_MARKER'
                            ? 'Ảnh này dùng để nhận diện AR; không chèn QR lên ảnh.'
                            : 'Chọn bìa để điều chỉnh vị trí QR.'}
                    </p>
                )}
                {unavailable && (
                    <Alert tone="warning">Sách chưa có marker Bookaria để tạo tem.</Alert>
                )}
                {(error || currentIssue || problems[0]) && (
                    <Alert tone="danger">{error || currentIssue || problems[0]}</Alert>
                )}
                {previewBroken && (
                    <Alert tone="warning">
                        Chưa tải được ảnh xem trước. Kiểm tra kết nối và tải lại bố cục.
                    </Alert>
                )}
                <p className="text-muted-foreground text-xs">
                    Thay đổi chỉ áp dụng cho tệp PDF này. In 100% / Actual size, không Fit to page.
                </p>
            </div>
            {pdf && (
                <div className="col-span-2 flex items-center justify-between gap-4 rounded-lg border border-border p-4">
                    <span className="text-sm">
                        {pdf.kind === 'PRINT' ? 'Sách PDF' : 'Tờ marker'}
                        {pdf.versionNo ? ` | Phiên bản ${pdf.versionNo}` : ''}
                    </span>
                    <Button asChild variant="outline">
                        <a href={pdf.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink data-icon="inline-start" />
                            Mở PDF
                        </a>
                    </Button>
                </div>
            )}
        </div>
    );
}
