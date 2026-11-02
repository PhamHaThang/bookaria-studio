// Adapted from Spin by Alfie Jones (MIT): https://toggles.dev/toggles/spin
import { type ComponentProps, type CSSProperties, useId } from 'react';
import { cn } from '@/shared/lib/cn';
import { Button } from './button';

export interface SpinProps extends Omit<ComponentProps<typeof Button>, 'children'> {
    duration?: number;
    /** Whether the toggle should render in its dark-theme state. */
    toggled?: boolean;
    [key: `data-${string}`]: string | number | boolean | null | undefined;
}

export function Spin({
    duration = 400,
    toggled,
    className,
    type = 'button',
    title = 'Toggle theme',
    'aria-label': ariaLabel = 'Toggle theme',
    'aria-pressed': ariaPressed,
    ...props
}: SpinProps) {
    const toggleId = useId();

    const clipMainId = `toggles.dev-spin-main-${toggleId}`;

    return (
        <Button
            {...props}
            type={type}
            title={title}
            aria-label={ariaLabel}
            aria-pressed={toggled ?? ariaPressed}
            className={cn(
                className,
                toggled === true ? 'dark' : toggled === false ? 'light' : undefined,
            )}
        >
            <svg
                width="1em"
                height="1em"
                viewBox="0 0 24 24"
                aria-hidden="true"
                style={{ '--toggles-spin--duration': `${duration}ms` } as CSSProperties}
            >
                <defs>
                    <clipPath id={clipMainId}>
                        <path
                            d={'M0 0h25a1 1 0 0010 10v14H0Z'}
                            className="motion-safe:transition-[d,translate] motion-safe:duration-(--toggles-spin--duration) dark:not-supports-[d:path('M0_0')]:-translate-x-3.25 dark:not-supports-[d:path('M0_0')]:translate-y-0.5 motion-safe:dark:delay-[calc(var(--toggles-spin--duration)*0.15)] dark:[d:path('M0_2h13a1_1_0_0010_10v14H0Z')]"
                        />
                    </clipPath>
                </defs>
                <g stroke={'currentColor'} strokeLinecap={'round'}>
                    <circle
                        cx={12}
                        cy={12}
                        r={5}
                        fill={'currentColor'}
                        clipPath={`url(#${clipMainId})`}
                        className="origin-center motion-safe:transition-transform motion-safe:duration-(--toggles-spin--duration) dark:scale-170"
                    />
                    <path
                        d={'M12 1.4v2.4'}
                        fill={'none'}
                        strokeWidth={2}
                        strokeLinejoin={'round'}
                        strokeMiterlimit={0}
                        paintOrder={'stroke markers fill'}
                        className="origin-center motion-safe:transition-transform motion-safe:delay-[calc(var(--toggles-spin--duration)*0.15)] motion-safe:duration-(--toggles-spin--duration) dark:rotate-45 dark:scale-0 motion-safe:dark:delay-0"
                    />
                    <path
                        d={'m20.3 3.7-2.5 2.5'}
                        fill={'none'}
                        strokeWidth={2}
                        strokeLinejoin={'round'}
                        strokeMiterlimit={0}
                        paintOrder={'stroke markers fill'}
                        className="origin-center motion-safe:transition-transform motion-safe:delay-[calc(var(--toggles-spin--duration)*0.15)] motion-safe:duration-(--toggles-spin--duration) dark:rotate-45 dark:scale-0 motion-safe:dark:delay-0"
                    />
                    <path
                        d={'M22.6 12h-2.4'}
                        fill={'none'}
                        strokeWidth={2}
                        strokeLinejoin={'round'}
                        strokeMiterlimit={0}
                        paintOrder={'stroke markers fill'}
                        className="origin-center motion-safe:transition-transform motion-safe:delay-[calc(var(--toggles-spin--duration)*0.15)] motion-safe:duration-(--toggles-spin--duration) dark:rotate-45 dark:scale-0 motion-safe:dark:delay-0"
                    />
                    <path
                        d={'M12 22.6v-2.4'}
                        fill={'none'}
                        strokeWidth={2}
                        strokeLinejoin={'round'}
                        strokeMiterlimit={0}
                        paintOrder={'stroke markers fill'}
                        className="origin-center motion-safe:transition-transform motion-safe:delay-[calc(var(--toggles-spin--duration)*0.15)] motion-safe:duration-(--toggles-spin--duration) dark:rotate-45 dark:scale-0 motion-safe:dark:delay-0"
                    />
                    <path
                        d={'M1.4 12h2.4'}
                        fill={'none'}
                        strokeWidth={2}
                        strokeLinejoin={'round'}
                        strokeMiterlimit={0}
                        paintOrder={'stroke markers fill'}
                        className="origin-center motion-safe:transition-transform motion-safe:delay-[calc(var(--toggles-spin--duration)*0.15)] motion-safe:duration-(--toggles-spin--duration) dark:rotate-45 dark:scale-0 motion-safe:dark:delay-0"
                    />
                    <path
                        d={'m20.3 20.3-2.5-2.5'}
                        fill={'none'}
                        strokeWidth={2}
                        strokeLinejoin={'round'}
                        strokeMiterlimit={0}
                        paintOrder={'stroke markers fill'}
                        className="origin-center motion-safe:transition-transform motion-safe:delay-[calc(var(--toggles-spin--duration)*0.15)] motion-safe:duration-(--toggles-spin--duration) dark:rotate-45 dark:scale-0 motion-safe:dark:delay-0"
                    />
                    <path
                        d={'m3.7 20.3 2.5-2.5'}
                        fill={'none'}
                        strokeWidth={2}
                        strokeLinejoin={'round'}
                        strokeMiterlimit={0}
                        paintOrder={'stroke markers fill'}
                        className="origin-center motion-safe:transition-transform motion-safe:delay-[calc(var(--toggles-spin--duration)*0.15)] motion-safe:duration-(--toggles-spin--duration) dark:rotate-45 dark:scale-0 motion-safe:dark:delay-0"
                    />
                    <path
                        d={'m3.7 3.7 2.5 2.5'}
                        fill={'none'}
                        strokeWidth={2}
                        strokeLinejoin={'round'}
                        strokeMiterlimit={0}
                        paintOrder={'stroke markers fill'}
                        className="origin-center motion-safe:transition-transform motion-safe:delay-[calc(var(--toggles-spin--duration)*0.15)] motion-safe:duration-(--toggles-spin--duration) dark:rotate-45 dark:scale-0 motion-safe:dark:delay-0"
                    />
                </g>
            </svg>
        </Button>
    );
}
