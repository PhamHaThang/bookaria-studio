import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { AssetRef } from '@/shared/contracts/asset.schema';
import type { Scene } from '@/shared/contracts/scene.schema';
import { Button } from '@/shared/ui/primitives/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/primitives/popover';
import type { InteractionFlow } from '../model/interaction-flow';
import { actionTitle, type PaletteId } from '../model/interaction-palette';
import { ActionPalette } from './InteractionAddMenu';

const ports = [
    { id: 'true', label: 'Đúng', color: 'text-success-foreground' },
    { id: 'false', label: 'Sai', color: 'text-danger-foreground' },
] as const;
type BranchPort = (typeof ports)[number]['id'];

export function InteractionConditionBranches({
    graph,
    stepId,
    scene,
    assets,
    disabled,
    onAdd,
}: {
    graph: InteractionFlow;
    stepId: string;
    scene: Scene;
    assets: Record<string, AssetRef>;
    disabled: boolean;
    onAdd: (id: PaletteId, port: BranchPort) => void;
}) {
    const [open, setOpen] = useState<BranchPort | null>(null);
    return (
        <div className="flex flex-col gap-2">
            <h3 className="m-0 font-medium text-sm">Nhánh kết quả</h3>
            <ul className="m-0 list-none divide-y divide-border rounded-md border border-border p-0">
                {ports.map(({ id, label, color }) => {
                    const edge = graph.edges.find(
                        (item) => item.source === stepId && item.port === id,
                    );
                    const action = graph.nodes.find((item) => item.id === edge?.target)?.action;
                    const title = action && actionTitle(action);
                    return (
                        <li key={id} className="flex min-h-11 items-center gap-3 px-3 py-1.5">
                            <span className={`w-9 shrink-0 font-medium text-xs ${color}`}>
                                {label}
                            </span>
                            {title ? (
                                <span className="min-w-0 text-sm" title={title}>
                                    {title}
                                </span>
                            ) : (
                                <Popover
                                    open={open === id}
                                    onOpenChange={(next) => setOpen(next ? id : null)}
                                >
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size="xs"
                                            disabled={disabled}
                                            aria-label={`Thêm bước nhánh ${label}`}
                                        >
                                            <Plus data-icon="inline-start" />
                                            Thêm bước
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        align="end"
                                        className="max-h-[min(420px,75dvh)]"
                                        aria-label={`Thêm bước nhánh ${label}`}
                                    >
                                        <ActionPalette
                                            scene={scene}
                                            assets={assets}
                                            disabled={disabled}
                                            descriptions
                                            onChoose={(choice) => {
                                                setOpen(null);
                                                onAdd(choice, id);
                                            }}
                                        />
                                    </PopoverContent>
                                </Popover>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
