import {
    Component,
    lazy,
    type ReactNode,
    Suspense,
    useEffect,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';
import { cn } from '../lib/cn';
import { type MascotState, mascotMotion, taskStates } from '../mascot/motion';
import { useTheme } from '../theme/ThemeProvider';

const Animation = lazy(() => import('../mascot/BokiAnimation'));
type Props = {
    state?: MascotState;
    size?: number;
    animate?: boolean;
    task?: boolean;
    paused?: boolean;
    followPointer?: boolean;
    className?: string;
};

class AnimationBoundary extends Component<
    { children: ReactNode; fallback: ReactNode },
    { failed: boolean }
> {
    state = { failed: false };
    static getDerivedStateFromError() {
        return { failed: true };
    }
    render() {
        return this.state.failed ? this.props.fallback : this.props.children;
    }
}

function StaticImage({
    state,
    size,
    theme,
    loadingMotion = false,
}: {
    state: MascotState;
    size: number;
    theme: 'light' | 'dark';
    loadingMotion?: boolean;
}) {
    return (
        <img
            src={`/brand/mascot/${theme}-${state === 'loading' ? (loadingMotion ? 'loading-loop' : 'loading-poster') : state}.svg`}
            alt=""
            width={size}
            height={size}
            className="block size-full object-contain"
            draggable={false}
            decoding="async"
            onLoad={
                state === 'loading' && loadingMotion
                    ? (event) => {
                          event.currentTarget.dataset.loadingStarted = String(performance.now());
                      }
                    : undefined
            }
        />
    );
}

/** Pure decoration: the surrounding control/status remains the accessible source of meaning. */
export function Boki({
    state = 'idle',
    size = 64,
    animate = false,
    task = taskStates.has(state),
    paused = false,
    followPointer = false,
    className,
}: Props) {
    const { theme } = useTheme();
    return (
        <span
            aria-hidden="true"
            data-boki-state={state}
            className={cn(
                'inline-flex shrink-0 items-center justify-center align-middle leading-none',
                className,
            )}
            style={{ width: size, height: size }}
        >
            {animate ? (
                <Motion
                    state={state}
                    size={size}
                    theme={theme}
                    paused={paused}
                    followPointer={followPointer}
                    task={task}
                />
            ) : (
                <StaticImage state={state} size={size} theme={theme} />
            )}
        </span>
    );
}

function Motion({
    task,
    state,
    size,
    theme,
    paused,
    followPointer,
}: {
    state: MascotState;
    size: number;
    theme: 'light' | 'dark';
    paused: boolean;
    followPointer: boolean;
    task: boolean;
}) {
    const host = useRef<HTMLSpanElement>(null);
    const token = useRef(Symbol('Boki'));
    const [visible, setVisible] = useState(false);
    const [allowed, setAllowed] = useState(false);
    const [settled, setSettled] = useState(false);
    const owner = useSyncExternalStore(
        mascotMotion.subscribe,
        mascotMotion.getSnapshot,
        () => null,
    );
    useEffect(() => {
        setSettled(false);
        if (task || followPointer) return;
        const timer = setTimeout(() => setSettled(true), 3000);
        return () => clearTimeout(timer);
    }, [task, followPointer]);
    useEffect(() => {
        const node = host.current;
        if (!node) return;
        const media = matchMedia('(prefers-reduced-motion: reduce)');
        const sync = () => {
            const dialogs = [
                ...document.querySelectorAll<HTMLElement>(
                    'dialog[open], [role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
                ),
            ];
            const modal = dialogs.at(-1);
            setAllowed(
                !media.matches &&
                    !document.hidden &&
                    !node.closest('[inert]') &&
                    (!modal || modal.contains(node)),
            );
        };
        const intersection = new IntersectionObserver(([entry]) =>
            setVisible(entry.isIntersecting),
        );
        intersection.observe(node);
        // Observe overlay visibility only; avatar path updates never retrigger this observer.
        const overlay = new MutationObserver(sync);
        overlay.observe(document.body, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['open', 'data-state', 'inert'],
        });
        media.addEventListener('change', sync);
        document.addEventListener('visibilitychange', sync);
        sync();
        return () => {
            intersection.disconnect();
            overlay.disconnect();
            media.removeEventListener('change', sync);
            document.removeEventListener('visibilitychange', sync);
        };
    }, []);
    const eligible = allowed && visible && !paused && !settled && state !== 'disabled';
    useEffect(() => {
        if (!eligible) return;
        return mascotMotion.claim(token.current, task ? 2 : 1);
    }, [eligible, task]);
    const active = eligible && owner === token.current;
    // The authored loop owns its phases; requests never choose the mascot's expression.
    const fallback = (
        <StaticImage
            state={state}
            size={size}
            theme={theme}
            loadingMotion={active && state === 'loading'}
        />
    );
    return (
        <span
            ref={host}
            data-boki-motion={active ? 'playing' : 'static'}
            className="inline-flex size-full"
        >
            {(active || (followPointer && allowed && visible)) && state !== 'loading' ? (
                <AnimationBoundary fallback={fallback}>
                    <Suspense fallback={fallback}>
                        <Animation
                            state={state}
                            size={size}
                            theme={theme}
                            followPointer={followPointer}
                            paused={!active}
                        />
                    </Suspense>
                </AnimationBoundary>
            ) : (
                fallback
            )}
        </span>
    );
}

export type { MascotState };
