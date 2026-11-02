import { BookariaLogo } from '@/shared/ui/BookariaLogo';

// Fixed geometry: stable across rerenders; only the outer SVG rotates.
const rays = Array.from({ length: 116 }, (_, index) => {
    const angle = (index / 116) * Math.PI * 2;
    const spread = Math.sin(index * 37.13) * 0.5 + 0.5;
    const radius = 184 + spread * 80;
    return {
        id: index,
        x1: 280 + Math.cos(angle) * (94 + spread * 18),
        y1: 280 + Math.sin(angle) * (94 + spread * 18),
        x2: 280 + Math.cos(angle) * radius,
        y2: 280 + Math.sin(angle) * radius,
        opacity: 0.3 + spread * 0.5,
    };
});

export function BrandOrbit() {
    return (
        <div
            className="relative isolate grid h-132 w-full place-items-center max-lg:h-96"
            aria-hidden="true"
        >
            <svg
                aria-hidden="true"
                viewBox="0 0 560 560"
                fill="none"
                className="pointer-events-none absolute size-140 max-w-none motion-safe:animate-[bookaria-signal-orbit_100s_linear_infinite] max-lg:size-108"
            >
                {rays.map((ray) => (
                    <g key={ray.id} opacity={ray.opacity}>
                        <line
                            x1={ray.x1}
                            y1={ray.y1}
                            x2={ray.x2}
                            y2={ray.y2}
                            className="stroke-border"
                            strokeWidth="0.7"
                        />
                        <circle
                            cx={ray.x2}
                            cy={ray.y2}
                            r={ray.id % 4 === 0 ? 1.8 : 1.2}
                            className="fill-muted-foreground/60"
                        />
                    </g>
                ))}
            </svg>
            <div className="relative grid size-44 place-items-center rounded-[40px] border border-border bg-canvas shadow-[inset_0_0_0_1px_#ffffff,0_2px_4px_#1c202408] max-lg:size-36 max-lg:rounded-[32px]">
                <BookariaLogo symbol className="w-28 max-lg:w-24" />
            </div>
        </div>
    );
}
