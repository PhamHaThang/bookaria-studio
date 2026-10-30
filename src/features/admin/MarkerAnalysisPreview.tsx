import { Minus, Plus, RotateCcw } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { MarkerTestResult } from '@/shared/contracts/api/admin.schema';
import { Button } from '@/shared/ui/primitives/button';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/primitives/toggle-group';

export function MarkerAnalysisPreview({ result }: { result: MarkerTestResult }) {
    const [mode, setMode] = useState('features'),
        [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
    const drag = useRef<{ id: number; x: number; y: number } | null>(null);
    const { width, height } = result;
    const layer = useMemo(
        () =>
            mode === 'features'
                ? result.points.map((point) => (
                      <circle
                          key={`${point.x}:${point.y}`}
                          cx={point.x}
                          cy={point.y}
                          r={Math.max(width, height) / 280}
                          fill="var(--status-success-text)"
                          stroke="white"
                          strokeWidth={Math.max(width, height) / 900}
                      />
                  ))
                : mode === 'coverage'
                  ? result.cells.map((count, index) => {
                        const x = ((index % 4) * width) / 4,
                            y = (Math.floor(index / 4) * height) / 4;
                        return (
                            <g key={`${x}:${y}`}>
                                <rect
                                    x={x}
                                    y={y}
                                    width={width / 4}
                                    height={height / 4}
                                    fill={
                                        count
                                            ? 'var(--status-success-text)'
                                            : 'var(--status-danger-text)'
                                    }
                                    fillOpacity={count ? 0.2 : 0.28}
                                    stroke="white"
                                    strokeWidth={Math.max(width, height) / 600}
                                />
                                <rect
                                    x={x + width / 8 - 22}
                                    y={y + height / 8 - 15}
                                    width="44"
                                    height="30"
                                    rx="6"
                                    fill="white"
                                    fillOpacity=".95"
                                />
                                <text
                                    x={x + width / 8}
                                    y={y + height / 8 + 1}
                                    dominantBaseline="middle"
                                    textAnchor="middle"
                                    fontSize="20"
                                    fill="var(--text-primary)"
                                >
                                    {count}
                                </text>
                            </g>
                        );
                    })
                  : null,
        [result, mode, width, height],
    );
    const zoom = (delta: number) =>
        setView((v) => ({ ...v, zoom: Math.max(0.5, Math.min(3, v.zoom + delta)) }));
    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <ToggleGroup
                    type="single"
                    value={mode}
                    onValueChange={(value) => {
                        if (value) setMode(value);
                    }}
                    aria-label="Lớp hiển thị marker"
                >
                    <ToggleGroupItem value="original">Ảnh gốc</ToggleGroupItem>
                    <ToggleGroupItem value="features">Điểm đặc trưng</ToggleGroupItem>
                    <ToggleGroupItem value="coverage">Phân bố 4 × 4</ToggleGroupItem>
                </ToggleGroup>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Thu nhỏ ảnh marker"
                        onClick={() => zoom(-0.25)}
                        disabled={view.zoom <= 0.5}
                    >
                        <Minus />
                    </Button>
                    <span className="w-12 text-center text-muted-foreground text-xs tabular-nums">
                        {Math.round(view.zoom * 100)}%
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Phóng to ảnh marker"
                        onClick={() => zoom(0.25)}
                        disabled={view.zoom >= 3}
                    >
                        <Plus />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Đặt lại góc xem marker"
                        onClick={() => setView({ zoom: 1, x: 0, y: 0 })}
                    >
                        <RotateCcw />
                    </Button>
                </div>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl border border-border bg-white">
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    role="img"
                    aria-label="Ảnh marker và kết quả phân tích"
                    className="h-full max-h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
                    onPointerDown={(event) => {
                        if (event.button !== 0) return;
                        event.currentTarget.setPointerCapture(event.pointerId);
                        drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
                    }}
                    onPointerMove={(event) => {
                        const start = drag.current;
                        if (!start || start.id !== event.pointerId) return;
                        const matrix = event.currentTarget.getScreenCTM();
                        if (!matrix) return;
                        const a = new DOMPoint(start.x, start.y).matrixTransform(matrix.inverse()),
                            b = new DOMPoint(event.clientX, event.clientY).matrixTransform(
                                matrix.inverse(),
                            );
                        setView((v) => ({ ...v, x: v.x + b.x - a.x, y: v.y + b.y - a.y }));
                        drag.current = { ...start, x: event.clientX, y: event.clientY };
                    }}
                    onPointerUp={() => {
                        drag.current = null;
                    }}
                    onPointerCancel={() => {
                        drag.current = null;
                    }}
                    onLostPointerCapture={() => {
                        drag.current = null;
                    }}
                >
                    <title>Ảnh marker và kết quả phân tích</title>
                    <g
                        transform={`translate(${width / 2 + view.x} ${height / 2 + view.y}) scale(${view.zoom}) translate(${-width / 2} ${-height / 2})`}
                    >
                        <image href={result.image} width={width} height={height} />
                        {layer}
                    </g>
                </svg>
            </div>
            <div className="flex flex-wrap justify-between gap-2 text-muted-foreground text-xs">
                <span>
                    {mode === 'features'
                        ? 'Chấm xanh là điểm đặc trưng được phát hiện.'
                        : mode === 'coverage'
                          ? 'Ô đỏ chưa có điểm; số trong ô là số điểm đặc trưng.'
                          : 'Ảnh đã xoay đúng chiều và đặt trên nền trắng.'}
                </span>
                <span>Kéo ảnh để dịch · Dùng + / − để phóng</span>
            </div>
        </div>
    );
}
