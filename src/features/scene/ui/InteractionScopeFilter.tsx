import { Box, Image, MousePointer2, Tag, Type, Video, Volume2 } from 'lucide-react';
import { useState } from 'react';
import type { AssetRef } from '@/shared/contracts/asset.schema';
import type { SceneObject } from '@/shared/contracts/scene.schema';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/primitives/button';
import { SearchInput } from '@/shared/ui/SearchInput';
import { OBJECT_MIME } from '../model/interaction-palette';
import { objectLabels } from '../model/objects';

const icons = {
    model: Box,
    image: Image,
    text: Type,
    video: Video,
    hotspot: MousePointer2,
    label: Tag,
};
export function ObjectThumbnail({
    object,
    assets,
}: {
    object: SceneObject;
    assets: Record<string, AssetRef>;
}) {
    const [failed, setFailed] = useState<string | null>(null);
    const asset = 'assetId' in object ? assets[object.assetId] : undefined;
    const url = asset?.thumbnailUrl || (object.type === 'image' ? asset?.url : undefined);
    if (url && url !== failed)
        return (
            <img
                src={url}
                alt=""
                loading="lazy"
                decoding="async"
                className="size-full object-contain p-1.5"
                onError={() => setFailed(url)}
            />
        );
    if (object.type === 'text' || object.type === 'label')
        return (
            <span className="line-clamp-3 w-full whitespace-pre-line px-1.5 text-center font-semibold text-[10px] leading-tight">
                {object.text || object.name || objectLabels[object.type]}
            </span>
        );
    const Icon = object.type === 'audio' ? Volume2 : icons[object.type];
    return <Icon aria-hidden="true" strokeWidth={1.6} />;
}

/** Object references stay beside the palette; selection never switches the active flow. */
export function InteractionScopeFilter({
    selectedId,
    objects,
    assets,
    onSelect,
    onDragObject,
    disabled = false,
}: {
    selectedId?: string;
    objects: SceneObject[];
    assets: Record<string, AssetRef>;
    onSelect: (id: string | undefined) => void;
    onDragObject: (id: string | null) => void;
    disabled?: boolean;
}) {
    const [query, setQuery] = useState('');
    const matches = objects.filter((object) =>
        `${object.name || ''} ${'text' in object ? object.text : ''} ${objectLabels[object.type]}`
            .toLocaleLowerCase('vi')
            .includes(query.trim().toLocaleLowerCase('vi')),
    );
    return (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="shrink-0 px-3">
                <SearchInput
                    aria-label="Tìm đối tượng trong tương tác"
                    placeholder="Tìm đối tượng…"
                    value={query}
                    onValueChange={setQuery}
                />
            </div>
            <fieldset
                className="m-0 flex min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain border-0 px-3 pt-0 pb-3"
                aria-label="Đối tượng trong trang"
            >
                {matches.map((object) => (
                    <Button
                        key={object.id}
                        variant="plain"
                        aria-label={`Đối tượng: ${object.name || objectLabels[object.type]}`}
                        aria-pressed={selectedId === object.id}
                        disabled={disabled}
                        draggable={!disabled}
                        className={cn(
                            'flex min-h-14 w-full shrink-0 cursor-grab justify-start gap-3 px-2 text-left hover:bg-hover active:cursor-grabbing',
                            selectedId === object.id && 'bg-selected',
                        )}
                        onClick={() => onSelect(selectedId === object.id ? undefined : object.id)}
                        onDragStart={(event) => {
                            event.dataTransfer.setData(OBJECT_MIME, object.id);
                            event.dataTransfer.effectAllowed = 'copy';
                            onDragObject(object.id);
                        }}
                        onDragEnd={() => onDragObject(null)}
                    >
                        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border [&_svg]:size-5">
                            <ObjectThumbnail object={object} assets={assets} />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="truncate text-sm">
                                {object.name || objectLabels[object.type]}
                            </span>
                            <span className="text-muted-foreground text-xs">
                                {objectLabels[object.type]}
                            </span>
                        </span>
                    </Button>
                ))}
                {!matches.length && (
                    <p className="m-0 px-2 py-4 text-muted-foreground text-xs leading-5">
                        {objects.length
                            ? 'Không tìm thấy đối tượng phù hợp.'
                            : 'Thêm đối tượng ở tab Thiết kế để dùng trong tương tác.'}
                    </p>
                )}
            </fieldset>
        </div>
    );
}
