import { readCharacter } from '@bible-strong/avatar-core';
import { Avatar } from '@bible-strong/avatar-react';
import { useEffect, useRef } from 'react';
import { characters, library } from './data';
import { launcherLibrary } from './launcher-library';
import type { MascotState } from './motion';
import { pointerLook } from './pointer-look';

const parsed = { light: readCharacter(characters.light), dark: readCharacter(characters.dark) };
for (const value of Object.values(parsed)) {
    if (!value.ok) throw new Error('Invalid Bookaria mascot character');
}

export default function BokiAnimation({
    theme,
    state,
    size,
    followPointer = false,
    paused = false,
}: {
    theme: 'light' | 'dark';
    state: MascotState;
    size: number;
    followPointer?: boolean;
    paused?: boolean;
}) {
    const host = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (!followPointer || paused || !host.current) return;
        const node = host.current;
        const face = node.querySelector<SVGGElement>('[data-part="face"]');
        if (!face) return;
        // Move just the eyes. Feeding each pointer sample into Avatar wakes the entire renderer.
        face.style.transition = 'transform 140ms ease-out';
        let frame: number | undefined;
        let point: { x: number; y: number } | undefined;
        const update = () => {
            frame = undefined;
            if (!point) return;
            const [x, y] = pointerLook(point.x, point.y, node.getBoundingClientRect(), {
                width: innerWidth,
                height: innerHeight,
            });
            // SVG user units before the native pose scale. Quantize subpixel jitter.
            const target = `translate(${Math.round(x * 32)}px, ${Math.round(-y * 32)}px)`;
            if (face.style.transform !== target) face.style.transform = target;
        };
        const move = (event: PointerEvent) => {
            if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
            point = { x: event.clientX, y: event.clientY };
            if (frame === undefined) frame = requestAnimationFrame(update);
        };
        const reset = () => {
            if (frame !== undefined) cancelAnimationFrame(frame);
            frame = undefined;
            point = undefined;
            face.style.removeProperty('transform');
        };
        window.addEventListener('pointermove', move, { passive: true });
        window.addEventListener('blur', reset);
        document.documentElement.addEventListener('pointerleave', reset);
        return () => {
            if (frame !== undefined) cancelAnimationFrame(frame);
            face.style.removeProperty('transition');
            face.style.removeProperty('transform');
            window.removeEventListener('pointermove', move);
            window.removeEventListener('blur', reset);
            document.documentElement.removeEventListener('pointerleave', reset);
        };
    }, [followPointer, paused]);
    const character = parsed[theme];
    if (!character.ok) return null;
    return (
        <span ref={host} className="inline-flex size-full">
            <Avatar
                character={character.value}
                library={followPointer ? launcherLibrary : library}
                state={`boki-${state}`}
                size={size}
                seed={22}
                ariaLabel="Boki"
                followPointer={false}
                paused={paused}
                settleAfterMs={followPointer ? 2800 : 0}
            />
        </span>
    );
}
