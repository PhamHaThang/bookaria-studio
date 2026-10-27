import { RefreshCw, Trash2, TriangleAlert, X } from 'lucide-react';
import type { RefObject } from 'react';
import type { SceneObject } from '@/shared/contracts/scene.schema';
import { Button } from '@/shared/ui/primitives/button';
import { Spinner } from '@/shared/ui/primitives/spinner';
import type { SceneLoadState } from '../model/scene-load-store';

export function SceneAssetLoading({
    objects,
    states,
    hostRef,
    disabled,
    onRetry,
    onRemove,
}: {
    objects: SceneObject[];
    states: ReadonlyMap<string, SceneLoadState>;
    hostRef: RefObject<HTMLDivElement | null>;
    disabled: boolean;
    onRetry: (id: string) => void;
    onRemove: (id: string) => void;
}) {
    return (
        <div ref={hostRef} className="pointer-events-none absolute inset-0 z-2">
            {objects.flatMap((object) => {
                const state = states.get(object.id);
                if (
                    !state ||
                    object.editorHidden ||
                    !['model', 'image', 'video'].includes(object.type)
                )
                    return [];
                const name = object.name || 'Tài nguyên';
                const failed = state.status === 'failed';
                return [
                    <fieldset
                        key={object.id}
                        data-asset-loading={object.id}
                        data-load-status={state.status}
                        aria-label={`${name}: ${failed ? 'không tải được' : 'đang tải'}`}
                        aria-busy={!failed}
                        style={{ visibility: 'hidden' }}
                        className="pointer-events-auto absolute top-0 left-0 m-0 flex w-44 min-w-0 flex-col items-center gap-2 rounded-xl border-0 bg-surface px-3 py-4 text-center shadow-[0_4px_18px_#0000001a]"
                    >
                        {!failed && (
                            <Button
                                variant="plain"
                                size="icon-xs"
                                className="absolute top-1 right-1"
                                aria-label={`Hủy tải ${name}`}
                                title="Hủy tải và xóa đối tượng"
                                disabled={disabled || object.locked}
                                onClick={() => onRemove(object.id)}
                            >
                                <X />
                            </Button>
                        )}
                        {failed ? (
                            <TriangleAlert className="size-6 text-destructive" aria-hidden="true" />
                        ) : (
                            <img
                                src="/brand/bookaria-symbol.svg"
                                alt=""
                                width={48}
                                height={24}
                                className="h-auto w-12 motion-safe:animate-[bookaria-loading-pulse_1.8s_ease-in-out_infinite]"
                            />
                        )}
                        <p className="m-0 max-w-full truncate font-medium text-xs" title={name}>
                            {name}
                        </p>
                        <p
                            role={failed ? 'alert' : 'status'}
                            className="m-0 flex items-center justify-center gap-2 text-muted-foreground text-xs"
                        >
                            {!failed && <Spinner />}
                            {failed
                                ? 'Không tải được tài nguyên'
                                : object.type === 'model'
                                  ? 'Đang tải mô hình…'
                                  : object.type === 'video'
                                    ? 'Đang tải video…'
                                    : 'Đang tải ảnh…'}
                        </p>
                        {failed && (
                            <div className="flex items-center gap-2">
                                <Button
                                    size="sm"
                                    disabled={disabled}
                                    onClick={() => onRetry(object.id)}
                                >
                                    <RefreshCw data-icon="inline-start" />
                                    Thử lại
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`Xóa ${name}`}
                                    disabled={disabled || object.locked}
                                    onClick={() => onRemove(object.id)}
                                >
                                    <Trash2 />
                                </Button>
                            </div>
                        )}
                    </fieldset>,
                ];
            })}
        </div>
    );
}
