import { type CSSProperties, type RefObject, useRef, useState } from 'react';
import { Button } from '@/shared/ui/primitives/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/primitives/tooltip';

/** Virtual local Z extends down-left from the origin, away from the positive X/Y handles. */
export function SceneDepthGizmo({
    buttonRef,
    disabled,
}: {
    buttonRef: RefObject<HTMLButtonElement | null>;
    disabled: boolean;
}) {
    const [open, setOpen] = useState(false);
    const suppressTooltip = useRef(false);
    return (
        <Tooltip
            open={open}
            onOpenChange={(next) => {
                if (
                    next &&
                    (suppressTooltip.current || buttonRef.current?.dataset.dragging === 'true')
                )
                    return;
                setOpen(next);
            }}
        >
            <TooltipTrigger asChild>
                <Button
                    ref={buttonRef}
                    variant="plain"
                    aria-label="Độ sâu Z cục bộ"
                    onPointerDownCapture={() => {
                        suppressTooltip.current = true;
                        setOpen(false);
                    }}
                    onPointerUpCapture={() => {
                        suppressTooltip.current = false;
                    }}
                    onPointerCancelCapture={() => {
                        suppressTooltip.current = false;
                    }}
                    onLostPointerCaptureCapture={() => {
                        suppressTooltip.current = false;
                    }}
                    data-depth-handle
                    data-dragging="false"
                    disabled={disabled}
                    className="group/depth absolute top-0 left-0 z-3 size-10 cursor-nesw-resize touch-none select-none rounded-full p-0"
                    style={
                        {
                            visibility: 'hidden',
                            '--depth-axis': '#215dd0',
                            '--depth-axis-active': '#ffff00',
                        } as CSSProperties
                    }
                >
                    <svg
                        viewBox="0 0 40 40"
                        aria-hidden="true"
                        className="pointer-events-none block size-full overflow-visible"
                    >
                        <line
                            data-depth-axis-link
                            x1="56"
                            y1="-16"
                            x2="20"
                            y2="20"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            className="stroke-[var(--depth-axis)] group-hover/depth:stroke-[var(--depth-axis-active)] group-data-[dragging=true]/depth:stroke-[var(--depth-axis-active)]"
                        />
                        <circle
                            cx="20"
                            cy="20"
                            r="16"
                            fill="none"
                            stroke="var(--depth-axis)"
                            strokeWidth="1"
                            className="opacity-50 group-hover/depth:opacity-100 group-data-[dragging=true]/depth:opacity-100"
                        />
                        <circle
                            cx="20"
                            cy="20"
                            r="12"
                            strokeWidth="2.5"
                            className="fill-[var(--depth-axis)] stroke-surface group-hover/depth:fill-[var(--depth-axis-active)] group-data-[dragging=true]/depth:fill-[var(--depth-axis-active)]"
                        />
                        <text
                            x="20"
                            y="20.5"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontSize="11"
                            fontWeight="700"
                            className="fill-surface group-hover/depth:fill-foreground group-data-[dragging=true]/depth:fill-foreground"
                        >
                            Z
                        </text>
                    </svg>
                    <span
                        data-depth-feedback
                        aria-hidden="true"
                        className="pointer-events-none absolute top-full left-1/2 mt-4 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 font-medium text-foreground text-xs tabular-nums shadow-sm group-data-[dragging=true]/depth:block"
                    />
                </Button>
            </TooltipTrigger>
            {open && (
                <TooltipContent side="right" sideOffset={8}>
                    Z cục bộ · Kéo theo trục xanh để di chuyển
                </TooltipContent>
            )}
        </Tooltip>
    );
}
