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
    'h-10 gap-3 rounded-lg px-1.5 text-[14px] group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:p-1.5! transition-colors [&_svg]:size-7';
const menuClass = 'gap-4';
const iconStrokeWidth = 1.5;
const labelClass =
    'min-w-0 whitespace-nowrap transition-opacity duration-150 group-data-[collapsible=icon]:opacity-0 motion-reduce:transition-none';

function SidebarSectionLabel({
    children,
    divider = false,
}: {
    children: ReactNode;
    divider?: boolean;
}) {
    const { open } = useSidebar();

    return (
        <SidebarGroupLabel className="pointer-events-none relative mb-3 h-5 overflow-hidden px-1.5 font-semibold text-[10px] uppercase tracking-wide transition-none group-data-[collapsible=icon]:mt-0 group-data-[collapsible=icon]:opacity-100">
            <span
                aria-hidden={!open}
                className="whitespace-nowrap transition-opacity duration-150 group-data-[collapsible=icon]:opacity-0 motion-reduce:transition-none"
            >
                {children}
            </span>
            {divider && (
                <SidebarSeparator
                    aria-hidden="true"
                    className="absolute top-1/2 left-0 mx-0 h-px w-10 transition-opacity duration-150 group-data-[state=expanded]:opacity-0 motion-reduce:transition-none"
                />
            )}
        </SidebarGroupLabel>
    );
}

export function SceneEditorSidebar({
    activeObjectType,
    activePanel,
    disabled,
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
            className="scene-add absolute top-0 left-0 h-[calc(100dvh_-_76px_-_var(--canvas-hints-height,2.5rem))] min-h-0 w-(--sidebar-width)! overflow-hidden border-0! transition-[clip-path] duration-200 ease-out [clip-path:inset(0_-24px_0_0)] before:pointer-events-none before:absolute before:inset-y-0 before:left-[calc(var(--sidebar-width-icon)_-_1px)] before:z-1 before:w-px before:bg-border before:transition-opacity before:duration-150 group-data-[collapsible=icon]:w-(--sidebar-width)! group-data-[state=expanded]:shadow-[4px_0_16px_#00000014] group-data-[collapsible=icon]:duration-150 group-data-[state=expanded]:before:opacity-0 motion-reduce:transition-none motion-reduce:before:transition-none group-data-[collapsible=icon]:[clip-path:inset(0_calc(var(--sidebar-width)_-_var(--sidebar-width-icon))_0_0)] [.scene-editor[data-panel=preview]_&]:h-[calc(100dvh_-_76px)]"
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
                className="justify-center-safe gap-3 py-0 group-data-[collapsible=icon]:overflow-y-auto"
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
