import {
    type CSSProperties,
    createContext,
    type ReactNode,
    useContext,
    useEffect,
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
    useEffect(() => {
        function resetHover() {
            setHovered(false);
            setFocused(false);
        }
        window.addEventListener('blur', resetHover);
        return () => window.removeEventListener('blur', resetHover);
    }, []);

    return (
        <HoverContext.Provider
            value={{
                enter: () => setHovered(true),
                leave: () => setHovered(false),
                focus: () => setFocused(true),
                blur: () => setFocused(false),
            }}
        >
            <SidebarProvider
                open={hovered || focused}
                data-sidebar-expanded={hovered || focused}
                onOpenChange={setHovered}
                className="workbench-body relative min-h-0 items-stretch [--canvas-hints-height:2.5rem] [--sidebar-toolbar-offset:0px] data-[sidebar-expanded=true]:[--sidebar-toolbar-offset:calc(var(--sidebar-width)_-_var(--sidebar-width-icon))] [&>[data-slot=sidebar]]:relative [&>[data-slot=sidebar]]:w-(--sidebar-width-icon) [&>[data-slot=sidebar]]:shrink-0 [&_[data-slot=sidebar-gap]]:w-(--sidebar-width-icon) [&_[data-slot=sidebar-gap]]:transition-none"
                style={
                    { '--sidebar-width': '208px', '--sidebar-width-icon': '72px' } as CSSProperties
                }
            >
                {children}
                <div
                    data-canvas-hints-host
                    className="absolute inset-x-0 bottom-0 z-20 min-h-10 bg-surface [.scene-editor[data-panel=preview]_&]:hidden"
                />
            </SidebarProvider>
        </HoverContext.Provider>
    );
}
