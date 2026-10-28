import { Move, QrCode } from 'lucide-react';
import { type KeyboardEvent, type PointerEvent, useId, useRef } from 'react';
import {
    MARKER_RULES,
    type MarkerTransform,
    markerToMm,
    type PageGeometry,
    pageWidthMm,
} from '@/shared/contracts/marker.schema';
import {
    constrainMarkerPosition,
    type MarkerPrintPosition,
    resizeMarkerAtCenter,
} from '../model/marker-preview';

export function MarkerPlacementPreview({
    imageUrl,
    geometry,
    transform,
    markerNumber,
    disabled,
    onChange,
}: {
    imageUrl: string;
    geometry: PageGeometry;
    transform: MarkerTransform;
    markerNumber: number | null;
    disabled: boolean;
    onChange: (position: MarkerPrintPosition) => void;
}) {
    const svg = useRef<SVGSVGElement>(null),
        hintId = useId();
    const gesture = useRef<{
        id: number;
        mode: 'move' | 'resize';
        x: number;
        y: number;
        start: MarkerPrintPosition;
    } | null>(null);
    const value = markerToMm(transform, geometry),
        width = pageWidthMm(geometry.format, geometry.widthMm),
        height = width * geometry.aspect;
    const margin = MARKER_RULES.minEdgeMarginMm,
        half = value.sizeMm / 2;
    const handle = Math.max(3, width * 0.018),
        stroke = width / 500;
    const possible = constrainMarkerPosition(value, geometry) !== null;
    function point(event: PointerEvent<SVGElement>) {
        const matrix = svg.current?.getScreenCTM();
        return matrix
            ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
            : null;
    }
    function start(event: PointerEvent<SVGGElement>, mode: 'move' | 'resize') {
        if (disabled || !possible || event.button !== 0 || gesture.current) return;
        const p = point(event);
        if (!p) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.focus();
        svg.current?.setPointerCapture(event.pointerId);
        gesture.current = { id: event.pointerId, mode, x: p.x, y: p.y, start: value };
    }
    function move(event: PointerEvent<SVGSVGElement>) {
        const g = gesture.current;
        if (!g || event.pointerId !== g.id || disabled) return;
        const p = point(event);
        if (!p) return;
        const next =
            g.mode === 'move'
                ? constrainMarkerPosition(
                      {
                          ...g.start,
                          centerXMm: g.start.centerXMm + p.x - g.x,
                          centerYMm: g.start.centerYMm + p.y - g.y,
                      },
                      geometry,
                  )
                : resizeMarkerAtCenter(
                      g.start,
                      g.start.sizeMm + (p.x - g.x) + (p.y - g.y),
                      geometry,
                  );
        if (next) onChange(next);
    }
    function finish(event: PointerEvent<SVGSVGElement>, cancel = false) {
        const g = gesture.current;
        if (!g || g.id !== event.pointerId) return;
        gesture.current = null;
        if (cancel) onChange(g.start);
        if (svg.current?.hasPointerCapture(g.id)) svg.current.releasePointerCapture(g.id);
    }
    function keyDown(event: KeyboardEvent<SVGGElement>, resize = false) {
        if (disabled || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key))
            return;
        event.preventDefault();
        event.stopPropagation();
        const step = event.shiftKey ? 5 : 1;
        const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
        const next = resize
            ? resizeMarkerAtCenter(value, value.sizeMm + direction * step, geometry)
            : constrainMarkerPosition(
                  {
                      ...value,
                      centerXMm:
                          value.centerXMm +
                          (event.key === 'ArrowLeft'
                              ? -step
                              : event.key === 'ArrowRight'
                                ? step
                                : 0),
                      centerYMm:
                          value.centerYMm +
                          (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0),
                  },
                  geometry,
              );
        if (next) onChange(next);
    }
    return (
        <figure className="m-0 flex min-h-0 min-w-0 flex-col gap-3">
            <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg border border-border bg-background p-5">
                <svg
                    ref={svg}
                    viewBox={`0 0 ${width} ${height}`}
                    className="size-full touch-none select-none overflow-visible"
                    aria-label="Bản xem trước vị trí marker trên trang in"
                    onPointerMove={move}
                    onPointerUp={(event) => finish(event)}
                    onPointerCancel={(event) => finish(event, true)}
                    onLostPointerCapture={() => {
                        gesture.current = null;
                    }}
                >
                    <title>Bản xem trước trang in</title>
                    <image
                        href={imageUrl}
                        x="0"
                        y="0"
                        width={width}
                        height={height}
                        preserveAspectRatio="none"
                    />
                    <rect
                        x="0"
                        y="0"
                        width={width}
                        height={height}
                        fill="none"
                        stroke="var(--color-border)"
                        strokeWidth={stroke}
                    />
                    {width > 2 * margin && height > 2 * margin && (
                        <g pointerEvents="none">
                            {[
                                { color: 'var(--editor-marker-safe-area-outline)', thickness: 3 },
                                { color: 'var(--editor-marker-safe-area)', thickness: 1.5 },
                            ].map(({ color, thickness }) => (
                                <rect
                                    key={color}
                                    x={margin}
                                    y={margin}
                                    width={width - 2 * margin}
                                    height={height - 2 * margin}
                                    fill="none"
                                    stroke={color}
                                    strokeWidth={thickness}
                                    strokeDasharray="6 4"
                                    strokeLinejoin="round"
                                    vectorEffect="non-scaling-stroke"
                                />
                            ))}
                        </g>
                    )}
                    {/* biome-ignore lint/a11y/useSemanticElements: SVG handles need SVG coordinates, pointer capture and keyboard access. */}
                    <g
                        role="button"
                        tabIndex={disabled || !possible ? -1 : 0}
                        aria-disabled={disabled || !possible}
                        aria-label="Di chuyển marker"
                        aria-describedby={hintId}
                        onPointerDown={(event) => start(event, 'move')}
                        onKeyDown={(event) => keyDown(event)}
                        className="cursor-grab outline-none active:cursor-grabbing aria-disabled:cursor-default focus-visible:[&>rect]:stroke-ring"
                    >
                        <rect
                            x={value.centerXMm - half}
                            y={value.centerYMm - half}
                            width={value.sizeMm}
                            height={value.sizeMm}
                            fill="var(--color-background)"
                            stroke="var(--color-primary)"
                            strokeWidth={stroke * 2}
                        />
                        <QrCode
                            x={value.centerXMm - half * 0.68}
                            y={value.centerYMm - half * 0.85}
                            width={value.sizeMm * 0.68}
                            height={value.sizeMm * 0.68}
                            className="pointer-events-none text-primary"
                            strokeWidth="1.5"
                            aria-hidden="true"
                        />
                        <text
                            x={value.centerXMm}
                            y={value.centerYMm + half * 0.72}
                            textAnchor="middle"
                            fill="var(--color-primary)"
                            fontSize={value.sizeMm * 0.14}
                            fontWeight="600"
                            pointerEvents="none"
                        >
                            {markerNumber ? `#${markerNumber}` : 'AR'}
                        </text>
                    </g>
                    {/* biome-ignore lint/a11y/useSemanticElements: SVG handles need SVG coordinates, pointer capture and keyboard access. */}
                    <g
                        role="button"
                        tabIndex={disabled || !possible ? -1 : 0}
                        aria-disabled={disabled || !possible}
                        aria-label="Đổi kích thước marker"
                        aria-describedby={hintId}
                        onPointerDown={(event) => start(event, 'resize')}
                        onKeyDown={(event) => keyDown(event, true)}
                        className="cursor-nwse-resize outline-none aria-disabled:cursor-default focus-visible:[&>rect]:stroke-ring"
                    >
                        <rect
                            x={value.centerXMm + half - handle}
                            y={value.centerYMm + half - handle}
                            width={handle * 2}
                            height={handle * 2}
                            fill="transparent"
                        />
                        <rect
                            x={value.centerXMm + half - handle / 2}
                            y={value.centerYMm + half - handle / 2}
                            width={handle}
                            height={handle}
                            rx={stroke}
                            fill="var(--color-background)"
                            stroke="var(--color-primary)"
                            strokeWidth={stroke * 2}
                        />
                    </g>
                </svg>
            </div>
            <figcaption id={hintId} className="flex flex-col gap-1 text-muted-foreground text-xs">
                <span className="flex items-center gap-2">
                    <Move className="size-3.5 shrink-0" aria-hidden="true" />
                    Kéo marker để di chuyển · Kéo góc để đổi kích thước.
                </span>
                <span>Phím mũi tên: 1 mm · Shift: 5 mm. Hình minh họa không dùng để quét.</span>
            </figcaption>
        </figure>
    );
}
