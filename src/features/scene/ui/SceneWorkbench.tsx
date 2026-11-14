import {
    type CSSProperties,
    createContext,
    type ReactNode,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';
import { SidebarProvider } from '@/shared/ui/primitives/sidebar';

const HoverContext = createContext<{
    enter: () => void;
    leave: () => void;
    focus: () => void;
    blur: () => void;
} | null>(null);

export function useSceneSidebarHover() {
    const context = useContext(HoverContext);
    if (!context) throw new Error('Scene sidebar must be inside SceneWorkbench.');
    return context;
}

export function SceneWorkbench({
    children,
    hintsVisible = true,
    hints,
}: {
    children: ReactNode;
    hintsVisible?: boolean;
    hints?: ReactNode;
}) {
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);
    const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
    useEffect(() => {
        function resetHover() {
            clearTimeout(closeTimer.current);
            setHovered(false);
            setFocused(false);
        }
        window.addEventListener('blur', resetHover);
        return () => {
            clearTimeout(closeTimer.current);
            window.removeEventListener('blur', resetHover);
        };
    }, []);

    return (
        <HoverContext.Provider
            value={{
                enter: () => {
                    clearTimeout(closeTimer.current);
                    setHovered(true);
                },
                leave: () => {
                    clearTimeout(closeTimer.current);
                    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                        setHovered(false);
                        return;
                    }
                    closeTimer.current = setTimeout(() => setHovered(false), 100);
                },
                focus: () => setFocused(true),
                blur: () => setFocused(false),
            }}
        >
            <SidebarProvider
                open={hovered || focused}
                data-sidebar-expanded={hovered || focused}
                onOpenChange={(open) => {
                    clearTimeout(closeTimer.current);
                    setHovered(open);
                }}
                className="workbench-body relative min-h-0 items-stretch [--canvas-hints-height:2.5rem] [--sidebar-motion-duration:210ms] [--sidebar-motion-ease:cubic-bezier(0.4,0,0.2,1)] [--sidebar-toolbar-offset:0px] data-[sidebar-expanded=true]:[--sidebar-motion-duration:240ms] data-[sidebar-expanded=true]:[--sidebar-motion-ease:cubic-bezier(0.22,1,0.36,1)] data-[sidebar-expanded=true]:[--sidebar-toolbar-offset:calc(var(--sidebar-width)_-_var(--sidebar-width-icon))] [&>[data-slot=sidebar]]:relative [&>[data-slot=sidebar]]:w-(--sidebar-width-icon) [&>[data-slot=sidebar]]:shrink-0 [&_[data-slot=sidebar-gap]]:w-(--sidebar-width-icon) [&_[data-slot=sidebar-gap]]:transition-none"
                style={
                    { '--sidebar-width': '208px', '--sidebar-width-icon': '72px' } as CSSProperties
                }
            >
                {children}
                <div
                    data-canvas-hints-host
                    hidden={!hintsVisible}
                    className="absolute inset-x-0 bottom-0 z-20 min-h-10 bg-surface [&[hidden]]:hidden"
                >
                    {hints}
                </div>
            </SidebarProvider>
        </HoverContext.Provider>
    );
}
