import {
    AudioLines,
    CircleHelp,
    Clock3,
    Database,
    Eye,
    GitBranch,
    LayoutTemplate,
    Link2,
    Move,
    Navigation,
    Plus,
    Video,
    WandSparkles,
    Zap,
} from 'lucide-react';
import { type ReactNode, useRef, useState } from 'react';
import type { AssetRef } from '@/shared/contracts/asset.schema';
import type { ActionType, Scene, Trigger } from '@/shared/contracts/scene.schema';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/primitives/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/shared/ui/primitives/dropdown-menu';
import { blockGroups } from '../model/interaction-blocks';
import { ACTION_MIME, type PaletteId, TRIGGER_MIME } from '../model/interaction-palette';
import type { InteractionScope } from '../model/interaction-scope';
import type { InteractionTemplateId } from '../model/interaction-templates';
import { InteractionTemplateDialog } from './InteractionTemplateDialog';

export const actionIcons: Record<ActionType, typeof Eye> = {
    condition: GitBranch,
    setState: Database,
    askQuestion: CircleHelp,
    navigate: Navigation,
    playAudio: AudioLines,
    stopAudio: AudioLines,
    playVideo: Video,
    playAnimation: WandSparkles,
    setVisible: Eye,
    toggleVisible: Eye,
    transformTo: Move,
    wait: Clock3,
    openUrl: Link2,
};
export function ActionPalette({
    onTrigger,
    onChoose,
    disabled = false,
    descriptions = false,
}: {
    descriptions?: boolean;
    scene: Scene;
    assets: Record<string, AssetRef>;
    onChoose: (id: PaletteId) => void;
    onTrigger?: (trigger?: Trigger) => void;
    disabled?: boolean;
}) {
    const groups = blockGroups.filter((group) => group.id !== 'trigger' || onTrigger);
    return (
        <div className="flex min-h-0 flex-col gap-1 overflow-y-auto overscroll-contain">
            {groups.map((group) => {
                const Icon =
                    group.id === 'trigger'
                        ? Zap
                        : group.id === 'condition'
                          ? GitBranch
                          : group.id === 'state'
                            ? Database
                            : group.id === 'navigation'
                              ? Navigation
                              : WandSparkles;
                return (
                    <Button
                        key={group.id}
                        aria-label={group.label}
                        title={descriptions ? undefined : group.description}
                        variant="plain"
                        disabled={disabled}
                        draggable={!disabled}
                        className={cn(
                            'flex w-full justify-start gap-3 rounded-md px-2 py-2 text-left hover:bg-hover',
                            descriptions ? 'min-h-16 items-start' : 'min-h-10 items-center',
                        )}
                        onDragStart={(event) => {
                            event.dataTransfer.setData(
                                group.id === 'trigger' ? TRIGGER_MIME : ACTION_MIME,
                                group.initial || 'group',
                            );
                            event.dataTransfer.effectAllowed = 'copy';
                        }}
                        onClick={() => {
                            if (group.initial) onChoose(group.initial);
                            else onTrigger?.();
                        }}
                    >
                        <Icon
                            className={cn('size-5 shrink-0', descriptions && 'mt-0.5')}
                            strokeWidth={1.7}
                        />
                        <span className="flex min-w-0 flex-col gap-1">
                            <span className="font-medium text-sm">{group.label}</span>
                            {descriptions && (
                                <span className="whitespace-normal font-normal text-muted-foreground text-xs leading-5">
                                    {group.description}
                                </span>
                            )}
                        </span>
                    </Button>
                );
            })}
        </div>
    );
}
export function TemplateMenu({
    scene,
    scope,
    onChoose,
    disabled,
    children,
}: {
    scene: Scene;
    scope: InteractionScope;
    onChoose: (id: InteractionTemplateId) => void;
    disabled?: boolean;
    children?: ReactNode;
}) {
    const [templatesOpen, setTemplatesOpen] = useState(false);
    const trigger = useRef<HTMLButtonElement>(null);
    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild ref={trigger} disabled={disabled}>
                    {children || (
                        <Button disabled={disabled} size="sm">
                            <Plus data-icon="inline-start" />
                            Thêm tương tác
                        </Button>
                    )}
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="start"
                    className="w-48"
                    onCloseAutoFocus={(event) => {
                        if (templatesOpen) event.preventDefault();
                    }}
                >
                    <DropdownMenuGroup>
                        <DropdownMenuItem disabled={disabled} onSelect={() => onChoose('custom')}>
                            <Plus />
                            Luồng mới
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            disabled={disabled}
                            onSelect={() => setTemplatesOpen(true)}
                        >
                            <LayoutTemplate />
                            Dùng mẫu
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>
            <InteractionTemplateDialog
                open={templatesOpen}
                onOpenChange={setTemplatesOpen}
                scene={scene}
                scope={scope}
                disabled={disabled}
                onChoose={onChoose}
                returnFocus={() => trigger.current?.focus()}
            />
        </>
    );
}
