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

export function SceneWorkbench({ children }: { children: ReactNode }) {
    const [hovered, setHovered] = useState(false);
    const [focused, setFocused] = useState(false);
    const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    function clearTimers() {
        if (openTimer.current !== null) clearTimeout(openTimer.current);
        if (closeTimer.current !== null) clearTimeout(closeTimer.current);
        openTimer.current = null;
        closeTimer.current = null;
    }

    useEffect(() => {
        function resetHover() {
            if (openTimer.current !== null) clearTimeout(openTimer.current);
            if (closeTimer.current !== null) clearTimeout(closeTimer.current);
            setHovered(false);
            setFocused(false);
        }
        window.addEventListener('blur', resetHover);
        return () => {
            window.removeEventListener('blur', resetHover);
            if (openTimer.current !== null) clearTimeout(openTimer.current);
            if (closeTimer.current !== null) clearTimeout(closeTimer.current);
        };
    }, []);

    return (
        <HoverContext.Provider
            value={{
                enter: () => {
                    clearTimers();
                    openTimer.current = setTimeout(() => setHovered(true), 100);
                },
                leave: () => {
                    clearTimers();
                    closeTimer.current = setTimeout(() => setHovered(false), 180);
                },
                focus: () => {
                    clearTimers();
                    setFocused(true);
                },
                blur: () => setFocused(false),
            }}
        >
            <SidebarProvider
                open={hovered || focused}
                onOpenChange={(value) => {
                    clearTimers();
                    setHovered(value);
                }}
                className="workbench-body relative min-h-0 items-stretch [&>[data-slot=sidebar]]:relative [&>[data-slot=sidebar]]:w-14 [&>[data-slot=sidebar]]:shrink-0 [&_[data-slot=sidebar-gap]]:w-14 [&_[data-slot=sidebar-gap]]:transition-none"
                style={
                    { '--sidebar-width': '184px', '--sidebar-width-icon': '56px' } as CSSProperties
                }
            >
                {children}
            </SidebarProvider>
        </HoverContext.Provider>
    );
}
