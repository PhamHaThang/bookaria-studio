import { useQuery } from '@tanstack/react-query';
import { Move, Printer, RefreshCw, RotateCcw, ScanLine } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '@/shared/api/client';
import { errorMessage } from '@/shared/api/errors';
import type { PrintPdfBody } from '@/shared/contracts/api/publish.schema';
import { layoutMarkerStickerSheets, MARKER_STICKER_SHEET } from '@/shared/contracts/marker.schema';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { FormSelect } from '@/shared/ui/FormSelect';
import { PdfReaderButton } from '@/shared/ui/pdf-reader/PdfReaderButton';
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/shared/ui/primitives/empty';
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
    const [setupPageId, setSetupPageId] = useState(data.pages[0]?.pageId ?? '');
    const [error, setError] = useState<string | null>(null);
    const [failedImages, setFailedImages] = useState<string[]>([]);
    const svg = useRef<SVGSVGElement>(null);
    const drag = useRef<{ id: number; x: number; y: number; placement: Placement } | null>(null);
    const sticker = kind === 'MARKER_SHEET';
    const pages = data.pages;
    const stickerPages = data.pages.flatMap((p, i) =>
        p.marker
            ? [
                  {
                      pageId: p.pageId,
                      pageNumber: i + 1,
                      markerNumber: p.marker.number,
                      sizeMm: p.marker.sizeMm,
                      imageUrl: p.marker.imageUrl,
                  },
              ]
            : [],
    );
    const stickerError = stickerPages.some(
        (p) => !Number.isFinite(p.sizeMm) || p.sizeMm < 34.97 || p.sizeMm > 150,
    )
        ? 'Tờ tem hỗ trợ marker có cạnh từ 35 đến 150 mm. Chỉnh kích thước trong editor rồi xuất bản lại.'
        : null;
    const sheets = stickerError ? [] : layoutMarkerStickerSheets(stickerPages);
    const sheetIndex = Math.max(0, Math.min(index, sheets.length - 1));
    const sheet = sheets[sheetIndex];
    const sheetStyle = MARKER_STICKER_SHEET;
    const page = sticker ? undefined : pages[index];
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
    const unavailable = sticker && !stickerPages.length;
    const sheetBlocked = unavailable || (sticker && Boolean(stickerError));
    const invalid = sheetBlocked || problems.length > 0 || Boolean(currentIssue);
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
        Boolean(!sticker && page && failedImages.includes(page.imageUrl)) ||
        Boolean(marker && failedImages.includes(marker.imageUrl)) ||
        Boolean(sticker && sheet?.items.some((item) => failedImages.includes(item.imageUrl)));
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-5">
            <div className="flex min-w-0 flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                        <h3 className="font-semibold">Bố cục in - Phiên bản {data.versionNo}</h3>
                        <span className="text-muted-foreground text-xs">
                            {sticker
                                ? sheet
                                    ? `Tờ ${sheetIndex + 1}/${sheets.length} - ${sheet.items.length} tem - `
                                    : ''
                                : !page
                                  ? 'Bìa - '
                                  : `Trang ${data.pages.findIndex((p) => p.pageId === page.pageId) + 1} - `}
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
                <div
                    data-sticker={sticker}
                    className="flex h-72 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface p-3 data-[sticker=true]:h-[min(42dvh,420px)] [@media(min-height:900px)]:h-96"
                >
                    {sheetBlocked && (
                        <Empty className="h-full">
                            <EmptyHeader>
                                <EmptyMedia>
                                    <ScanLine className="size-8" />
                                </EmptyMedia>
                                <EmptyTitle>
                                    {unavailable ? 'Chưa có tem để in' : 'Chưa thể xếp tem'}
                                </EmptyTitle>
                                <EmptyDescription>
                                    {unavailable ? (
                                        <>
                                            Phiên bản {data.versionNo} chưa có trang dùng marker
                                            Bookaria. Trang dùng ảnh nhận diện riêng không tạo tem
                                            rời.
                                        </>
                                    ) : (
                                        stickerError
                                    )}
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    )}
                    <svg
                        ref={svg}
                        data-empty={sheetBlocked}
                        aria-hidden={sheetBlocked}
                        viewBox={`${-finiteMargin} ${-finiteMargin} ${width + finiteMargin * 2} ${height + finiteMargin * 2}`}
                        className="size-full select-none data-[empty=true]:hidden"
                        aria-label={
                            sticker
                                ? `Bản xem trước tờ tem ${sheetIndex + 1}`
                                : `Bản xem trước bố cục ${page ? `trang ${data.pages.findIndex((p) => p.pageId === page.pageId) + 1}` : 'bìa'}`
                        }
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
                                    x={marker.xMm}
                                    y={height - marker.yMm - marker.sizeMm}
                                    width={marker.sizeMm}
                                    height={marker.sizeMm}
                                    onError={() => failImage(marker.imageUrl)}
                                />
                                <rect
                                    x={marker.xMm}
                                    y={height - marker.yMm - marker.sizeMm}
                                    width={marker.sizeMm}
                                    height={marker.sizeMm}
                                    fill="none"
                                    stroke="#252525"
                                    strokeWidth={0.3}
                                />
                            </>
                        )}
                        {sticker && sheet && (
                            <g fontFamily="sans-serif" fill="#252525">
                                <image
                                    href="/brand/bookaria-symbol.svg"
                                    x={14}
                                    y={15.5}
                                    width={16}
                                    height={8}
                                />
                                <text x={34} y={22} fontSize={6.35}>
                                    Bookaria
                                </text>
                                <foreignObject x={14} y={31.5} width={130} height={15}>
                                    <div
                                        className="line-clamp-2 break-words text-left"
                                        style={{ fontSize: '4.23px', lineHeight: 1.3 }}
                                        title={data.title}
                                    >
                                        {data.title}
                                    </div>
                                </foreignObject>
                                <text x={14} y={55} fontSize={3} fill="#626262">
                                    Cắt theo nét đứt. Dán QR lên bìa, marker vào trang tương ứng.
                                </text>
                                <rect
                                    x={sheetStyle.qrFrame.xMm}
                                    y={sheetStyle.qrFrame.yMm}
                                    width={sheetStyle.qrFrame.widthMm}
                                    height={sheetStyle.qrFrame.heightMm}
                                    fill="white"
                                    stroke="#a8a8a8"
                                    strokeWidth={0.18}
                                    strokeDasharray="1.2 1"
                                />
                                {qrUrl && !failedImages.includes(qrUrl) ? (
                                    <image
                                        href={qrUrl}
                                        x={sheetStyle.qr.xMm}
                                        y={sheetStyle.qr.yMm}
                                        width={sheetStyle.qr.sizeMm}
                                        height={sheetStyle.qr.sizeMm}
                                        onError={() => failImage(qrUrl)}
                                    />
                                ) : (
                                    <text x={175} y={32} fontSize={3} textAnchor="middle">
                                        QR sách trong PDF
                                    </text>
                                )}
                                <text x={175} y={53} fontSize={2.8} textAnchor="middle">
                                    Quét để mở sách
                                </text>
                                <text x={175} y={58} fontSize={2.5} textAnchor="middle">
                                    Dán lên bìa sách
                                </text>
                                {sheet.items.map((item) => (
                                    <g key={item.pageId}>
                                        <rect
                                            x={item.imageXMm - sheetStyle.cutMarginMm}
                                            y={item.imageYMm - sheetStyle.cutMarginMm}
                                            width={item.sizeMm + 2 * sheetStyle.cutMarginMm}
                                            height={item.sizeMm + 2 * sheetStyle.cutMarginMm}
                                            fill="white"
                                            stroke="#a8a8a8"
                                            strokeWidth={0.18}
                                            strokeDasharray="1.2 1"
                                        />
                                        <image
                                            href={item.imageUrl}
                                            x={item.imageXMm}
                                            y={item.imageYMm}
                                            width={item.sizeMm}
                                            height={item.sizeMm}
                                            onError={() => failImage(item.imageUrl)}
                                        />
                                        <text
                                            x={item.xMm + item.widthMm / 2}
                                            y={item.imageYMm + item.sizeMm + 5}
                                            textAnchor="middle"
                                            fontSize={3}
                                        >
                                            Trang {item.pageNumber}
                                        </text>
                                        <text
                                            x={item.xMm + item.widthMm / 2}
                                            y={item.imageYMm + item.sizeMm + 9}
                                            textAnchor="middle"
                                            fontSize={2.65}
                                            fill="#626262"
                                        >
                                            Cạnh {Number(item.sizeMm.toFixed(1))} mm
                                        </text>
                                    </g>
                                ))}
                                <line
                                    x1={14}
                                    y1={280}
                                    x2={196}
                                    y2={280}
                                    stroke="#626262"
                                    strokeWidth={0.12}
                                />
                                <text x={14} y={287} fontSize={2.8} fill="#626262">
                                    In 100% / Actual size. Không chọn Fit to page.
                                </text>
                                <text
                                    x={196}
                                    y={287}
                                    fontSize={2.8}
                                    fill="#626262"
                                    textAnchor="end"
                                >
                                    Phiên bản {data.versionNo} | Tờ {sheetIndex + 1}/{sheets.length}
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
                <nav
                    data-empty={sheetBlocked}
                    className="flex gap-2 overflow-x-auto pb-1 data-[empty=true]:hidden"
                    aria-label="Chọn trang in"
                >
                    {!sticker && (
                        <Button
                            size="xs"
                            variant={index === -1 ? 'default' : 'outline'}
                            onClick={() => setIndex(-1)}
                        >
                            Bìa
                        </Button>
                    )}
                    {sticker
                        ? sheets.map((item, i) => (
                              <Button
                                  key={item.items[0]?.pageId || i}
                                  size="xs"
                                  variant={sheetIndex === i ? 'default' : 'outline'}
                                  aria-label={`Xem tờ tem ${i + 1}`}
                                  onClick={() => setIndex(i)}
                              >
                                  Tờ {i + 1} ({item.items.length} tem)
                              </Button>
                          ))
                        : pages.map((p, i) => (
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
                {!sticker && (
                    <p className="text-muted-foreground text-xs">
                        Xem bố cục thành phẩm. PDF có thêm dấu cắt và một trang trắng sau bìa để in
                        hai mặt.
                    </p>
                )}
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
                    <FieldGroup>
                        <Field>
                            <FieldLabel htmlFor="print-marker-setup-page">
                                Trang cần gắn marker
                            </FieldLabel>
                            <FormSelect
                                id="print-marker-setup-page"
                                value={setupPageId}
                                onValueChange={setSetupPageId}
                                disabled={disabled}
                                options={data.pages.map((p, i) => ({
                                    value: p.pageId,
                                    label: p.title
                                        ? `Trang ${i + 1} - ${p.title}`
                                        : `Trang ${i + 1}`,
                                }))}
                            />
                        </Field>
                        <Button asChild variant="outline" disabled={disabled || !setupPageId}>
                            <Link
                                to={`/books/${bookId}/pages/${setupPageId}`}
                                aria-disabled={disabled || !setupPageId}
                                tabIndex={disabled || !setupPageId ? -1 : undefined}
                                onClick={(event) => {
                                    if (disabled || !setupPageId) event.preventDefault();
                                    else onClose();
                                }}
                            >
                                <ScanLine data-icon="inline-start" />
                                Mở trang để gắn marker
                            </Link>
                        </Button>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                            Trong editor, mở AR Marker và chọn Marker Bookaria. Lưu rồi xuất bản lại
                            sách để tạo tem. Thêm marker vào kho không tự gắn vào các trang cũ.
                        </p>
                    </FieldGroup>
                )}
                {(error || currentIssue || problems[0]) && (
                    <Alert tone="danger">{error || currentIssue || problems[0]}</Alert>
                )}
                {previewBroken && (
                    <Alert tone="warning">
                        Chưa tải được ảnh xem trước. Kiểm tra kết nối và tải lại bố cục.
                    </Alert>
                )}
                {sticker && !sheetBlocked && (
                    <p className="text-muted-foreground text-xs leading-relaxed">
                        {stickerPages.length} tem trên {sheets.length} tờ A4, kèm QR mở sách để dán
                        lên bìa. Marker giữ đúng kích thước đã thiết lập. Nội dung AR di chuyển theo
                        vị trí dán marker.
                    </p>
                )}
                {!sheetBlocked && (
                    <p className="text-muted-foreground text-xs">
                        Thay đổi chỉ áp dụng cho tệp PDF này. In 100% / Actual size, không Fit to
                        page.
                    </p>
                )}
            </div>
            {pdf && (
                <div className="col-span-2 flex items-center justify-between gap-4 rounded-lg border border-border p-4">
                    <span className="text-sm">
                        {pdf.kind === 'PRINT' ? 'Sách PDF' : 'Tờ marker'}
                        {pdf.versionNo ? ` | Phiên bản ${pdf.versionNo}` : ''}
                    </span>
                    <PdfReaderButton
                        url={pdf.url}
                        title={pdf.kind === 'PRINT' ? 'Sách PDF' : 'Tờ marker'}
                    />
                </div>
            )}
        </div>
    );
}
