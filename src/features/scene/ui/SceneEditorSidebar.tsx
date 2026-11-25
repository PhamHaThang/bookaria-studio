import {
    Box,
    Image,
    Keyboard,
    MousePointer2,
    QrCode,
    Settings2,
    Type,
    Video,
    Volume2,
    Zap,
} from 'lucide-react';
import type { ReactNode, Ref } from 'react';
import type { SceneObjectType } from '@/shared/contracts/scene.schema';
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarSeparator,
    useSidebar,
} from '@/shared/ui/primitives/sidebar';
import { objectLabels } from '../model/objects';
import { useSceneSidebarHover } from './SceneWorkbench';

const tools = [
    { type: 'model', icon: Box },
    { type: 'image', icon: Image },
    { type: 'text', icon: Type },
    { type: 'video', icon: Video },
    { type: 'audio', icon: Volume2 },
    { type: 'hotspot', icon: MousePointer2 },
] as const;

const itemClass =
    'h-10 gap-2.5 rounded-lg px-[9px] text-sm text-muted-foreground transition-colors duration-150 hover:bg-hover hover:text-foreground active:bg-selected active:text-foreground disabled:opacity-40 data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:hover:bg-primary group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:px-[9px]! group-data-[collapsible=icon]:py-2! motion-safe:active:[--tool-shift:1px] motion-safe:[&:hover:not(:active)]:[--tool-shift:3px] motion-safe:[&>svg]:translate-x-[var(--tool-shift,0px)] motion-safe:[&>svg]:transition-[translate] motion-safe:[&>svg]:duration-150 motion-safe:[&>svg]:ease-out motion-reduce:transition-none [&_svg]:size-[22px]';
const menuClass = 'm-0 gap-2 p-0 [@media(max-height:700px)]:gap-1';
const iconStrokeWidth = 1.75;
const labelClass =
    'min-w-0 whitespace-nowrap transition-[opacity,translate] duration-150 ease-out group-data-[collapsible=icon]:opacity-0 motion-safe:group-data-[collapsible=icon]:-translate-x-1 motion-safe:group-data-[state=expanded]:delay-[60ms,0ms] motion-safe:group-data-[state=expanded]:translate-x-[var(--tool-shift,0px)] motion-reduce:transition-none';

function SidebarSectionLabel({
    children,
    divider = false,
}: {
    children: ReactNode;
    divider?: boolean;
}) {
    const { open } = useSidebar();

    return (
        <SidebarGroupLabel className="pointer-events-none relative mb-1 h-5 overflow-hidden px-2.5 font-medium text-muted-foreground text-xs transition-none group-data-[collapsible=icon]:mt-0 group-data-[collapsible=icon]:opacity-100 [@media(max-height:700px)]:mb-0 [@media(max-height:700px)]:h-4">
            <span
                aria-hidden={!open}
                className="whitespace-nowrap transition-[opacity,translate] duration-150 ease-out group-data-[collapsible=icon]:opacity-0 motion-safe:group-data-[collapsible=icon]:-translate-x-1 motion-safe:group-data-[state=expanded]:delay-60 motion-reduce:transition-none"
            >
                {children}
            </span>
            {divider && (
                <SidebarSeparator
                    aria-hidden="true"
                    className="absolute top-1/2 left-1 mx-0 h-px w-8! bg-border transition-opacity duration-150 ease-out group-data-[state=expanded]:opacity-0 motion-safe:group-data-[state=collapsed]:delay-60 motion-reduce:transition-none"
                />
            )}
        </SidebarGroupLabel>
    );
}

export function SceneEditorSidebar({
    activeObjectType,
    activePanel,
    disabled,
    pageUnavailable = false,
    objectLimitReached,
    helpOpen,
    onAdd,
    onInteractions,
    onRecognition,
    onSettings,
    onShortcuts,
    shortcutsRef,
}: {
    activeObjectType?: SceneObjectType;
    activePanel: 'properties' | 'interactions' | 'settings' | 'preview';
    disabled: boolean;
    pageUnavailable?: boolean;
    objectLimitReached: boolean;
    helpOpen: boolean;
    onAdd: (type: SceneObjectType) => void;
    onInteractions: () => void;
    onRecognition: () => void;
    onSettings: () => void;
    onShortcuts: () => void;
    shortcutsRef: Ref<HTMLButtonElement>;
}) {
    const { enter, leave, focus, blur } = useSceneSidebarHover();

    return (
        <Sidebar
            collapsible="icon"
            role="complementary"
            aria-label="Công cụ editor"
            className="scene-add absolute top-0 left-0 h-[calc(100dvh_-_64px_-_var(--canvas-hints-height,2.5rem))] min-h-0 w-(--sidebar-width)! overflow-hidden border-0! transition-[clip-path] duration-(--sidebar-motion-duration) ease-(--sidebar-motion-ease) [clip-path:inset(0)] after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border after:transition-transform after:duration-(--sidebar-motion-duration) after:ease-(--sidebar-motion-ease) group-data-[collapsible=icon]:w-(--sidebar-width)! group-data-[collapsible=icon]:after:-translate-x-[calc(var(--sidebar-width)_-_var(--sidebar-width-icon))] motion-reduce:transition-none motion-reduce:after:transition-none group-data-[collapsible=icon]:[clip-path:inset(0_calc(var(--sidebar-width)_-_var(--sidebar-width-icon))_0_0)]"
            onPointerEnter={(event) => {
                if (event.pointerType !== 'touch') enter();
            }}
            onPointerLeave={leave}
            onPointerDownCapture={blur}
            onFocusCapture={(event) => {
                if (event.target.matches(':focus-visible')) focus();
            }}
            onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) blur();
            }}
        >
            <SidebarContent
                id="scene-sidebar-content"
                className="justify-center-safe gap-2 overscroll-y-contain py-3 group-data-[collapsible=icon]:overflow-y-auto [@media(max-height:700px)]:gap-1 [@media(max-height:700px)]:py-1.5"
            >
                <SidebarGroup className="shrink-0 px-[calc((var(--sidebar-width-icon)_-_2.5rem)/2)] py-0">
                    <SidebarSectionLabel>Thêm đối tượng</SidebarSectionLabel>
                    <SidebarGroupContent>
                        <SidebarMenu className={menuClass}>
                            {tools.map(({ type, icon: Icon }) => (
                                <SidebarMenuItem key={type}>
                                    <SidebarMenuButton
                                        type="button"
                                        className={itemClass}
                                        aria-label={objectLabels[type]}
                                        aria-haspopup={type === 'hotspot' ? undefined : 'dialog'}
                                        aria-pressed={activeObjectType === type}
                                        isActive={activeObjectType === type}
                                        disabled={disabled || objectLimitReached}
                                        onClick={() => onAdd(type)}
                                    >
                                        <Icon strokeWidth={iconStrokeWidth} aria-hidden="true" />
                                        <span className={labelClass}>{objectLabels[type]}</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
                <SidebarGroup className="shrink-0 px-[calc((var(--sidebar-width-icon)_-_2.5rem)/2)] py-0">
                    <SidebarSectionLabel divider>Tương tác và AR</SidebarSectionLabel>
                    <SidebarGroupContent>
                        <SidebarMenu className={menuClass}>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    type="button"
                                    className={itemClass}
                                    aria-label="Mở tương tác"
                                    disabled={pageUnavailable}
                                    aria-pressed={activePanel === 'interactions'}
                                    isActive={activePanel === 'interactions'}
                                    onClick={onInteractions}
                                >
                                    <Zap strokeWidth={iconStrokeWidth} aria-hidden="true" />
                                    <span className={labelClass}>Tương tác</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    type="button"
                                    className={itemClass}
                                    aria-label="Thiết lập AR Marker"
                                    disabled={pageUnavailable}
                                    aria-haspopup="dialog"
                                    onClick={onRecognition}
                                >
                                    <QrCode strokeWidth={iconStrokeWidth} aria-hidden="true" />
                                    <span className={labelClass}>AR Marker</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
                <SidebarGroup className="shrink-0 px-[calc((var(--sidebar-width-icon)_-_2.5rem)/2)] py-0">
                    <SidebarSectionLabel divider>Cài đặt</SidebarSectionLabel>
                    <SidebarGroupContent>
                        <SidebarMenu className={menuClass}>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    type="button"
                                    className={itemClass}
                                    aria-label="Thiết lập trang"
                                    disabled={pageUnavailable}
                                    aria-controls="panel-settings"
                                    aria-expanded={activePanel === 'settings'}
                                    isActive={activePanel === 'settings'}
                                    onClick={onSettings}
                                >
                                    <Settings2 strokeWidth={iconStrokeWidth} aria-hidden="true" />
                                    <span className={labelClass}>Thiết lập trang</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    type="button"
                                    ref={shortcutsRef}
                                    className={itemClass}
                                    aria-label="Phím tắt"
                                    aria-haspopup="dialog"
                                    aria-expanded={helpOpen}
                                    isActive={helpOpen}
                                    onClick={onShortcuts}
                                >
                                    <Keyboard strokeWidth={iconStrokeWidth} aria-hidden="true" />
                                    <span className={labelClass}>Phím tắt</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    );
}
