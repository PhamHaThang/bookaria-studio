import { type CSSProperties, type RefObject, useEffect, useId, useRef } from 'react';
import { Button } from '@/shared/ui/primitives/button';
import { VIEW_AXES, type ViewGizmoController } from '../model/view-gizmo';

export function SceneViewGizmo({
    hostRef,
    controller,
}: {
    hostRef: RefObject<HTMLFieldSetElement | null>;
    controller: RefObject<ViewGizmoController | null>;
}) {
    const hint = useId();
    const suppressClick = useRef(false);
    const gesture = useRef<{
        id: number;
        x: number;
        y: number;
        startX: number;
        startY: number;
        moved: boolean;
        control: ViewGizmoController;
    } | null>(null);
    useEffect(() => () => gesture.current?.control.end(), []);

    return (
        <fieldset
            ref={hostRef}
            aria-label="Gizmo góc nhìn 3D"
            aria-describedby={hint}
            data-ready="false"
            className="absolute top-3 right-3 isolate size-32 touch-none select-none rounded-full outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring data-[ready=false]:invisible"
            style={
                {
                    '--view-axis-x': '#b33b45',
                    '--view-axis-y': '#2f7c4f',
                    '--view-axis-z': '#346bc4',
                } as CSSProperties
            }
            onPointerDown={(event) => {
                if (event.button !== 0 || gesture.current) return;
                const control = controller.current;
                if (!control?.begin()) return;
                const target =
                    (event.target as HTMLElement).closest('button') || event.currentTarget;
                target.setPointerCapture(event.pointerId);
                suppressClick.current = false;
                gesture.current = {
                    id: event.pointerId,
                    x: event.clientX,
                    y: event.clientY,
                    startX: event.clientX,
                    startY: event.clientY,
                    moved: false,
                    control,
                };
            }}
            onPointerMove={(event) => {
                const current = gesture.current;
                if (!current || current.id !== event.pointerId) return;
                if (
                    !current.moved &&
                    Math.hypot(event.clientX - current.startX, event.clientY - current.startY) <= 4
                )
                    return;
                current.moved = true;
                current.control.rotate(event.clientX - current.x, event.clientY - current.y);
                current.x = event.clientX;
                current.y = event.clientY;
            }}
            onPointerUp={(event) => {
                const current = gesture.current;
                if (!current || current.id !== event.pointerId) return;
                suppressClick.current = current.moved;
                current.control.end();
                gesture.current = null;
            }}
            onLostPointerCapture={() => {
                const current = gesture.current;
                if (!current) return;
                suppressClick.current = current.moved;
                current.control.end();
                gesture.current = null;
            }}
            onPointerCancel={() => {
                gesture.current?.control.end();
                gesture.current = null;
                suppressClick.current = true;
            }}
            onClickCapture={(event) => {
                if (!suppressClick.current || event.detail === 0) return;
                event.preventDefault();
                event.stopPropagation();
                suppressClick.current = false;
            }}
            onKeyDown={(event) => {
                const moves: Record<string, [number, number]> = {
                    ArrowLeft: [-12, 0],
                    ArrowRight: [12, 0],
                    ArrowUp: [0, -12],
                    ArrowDown: [0, 12],
                };
                const move = moves[event.key];
                if (!move) return;
                event.preventDefault();
                if (controller.current?.begin()) {
                    controller.current.rotate(...move);
                    controller.current.end();
                }
            }}
        >
            <span id={hint} className="sr-only">
                Kéo để xoay góc nhìn, bấm trục để nhìn thẳng theo hướng đó. Khi chọn một trục, dùng
                phím mũi tên để xoay. Đây là góc nhìn camera, không thay đổi đối tượng.
            </span>
            <svg
                viewBox="0 0 128 128"
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 size-full overflow-visible"
            >
                <circle cx="64" cy="64" r="55" className="fill-surface stroke-border" />
                {VIEW_AXES.map((axis) => (
                    <line
                        key={axis.id}
                        data-view-line={axis.id}
                        x1="64"
                        y1="64"
                        x2="64"
                        y2="64"
                        stroke={axis.color}
                        strokeWidth={axis.id.startsWith('+') ? 2 : 1}
                    />
                ))}
                <circle cx="64" cy="64" r="3" className="fill-muted-foreground" />
            </svg>
            {VIEW_AXES.map((axis) => (
                <Button
                    variant="plain"
                    key={axis.id}
                    data-view-axis={axis.id}
                    aria-label={axis.label}
                    className="absolute top-0 left-0 grid size-6 place-items-center rounded-full border font-semibold text-xs leading-none hover:brightness-90 focus-visible:outline-offset-2"
                    style={{
                        color: axis.id.startsWith('+') ? 'var(--text-on-primary)' : axis.color,
                        backgroundColor: axis.id.startsWith('+') ? axis.color : 'var(--bg-surface)',
                        borderColor: axis.color,
                    }}
                    onClick={() => controller.current?.axis(axis.id)}
                >
                    {axis.text}
                </Button>
            ))}
        </fieldset>
    );
}
