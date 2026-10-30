import type { AssetRef } from '@/shared/contracts/asset.schema';
import type { SceneObject } from '@/shared/contracts/scene.schema';

/** Ignore JSON property order and data updated by sync without rebuilding GPU resources. */
export function createSceneNodeKey() {
    const cache = new WeakMap<SceneObject, { resources: string; key: string }>();
    return (spec: SceneObject, asset?: AssetRef, imageUrl?: string) => {
        const resources = JSON.stringify([
            asset?.url,
            spec.type === 'video'
                ? [asset?.meta.width, asset?.meta.height]
                : spec.type === 'audio'
                  ? asset?.meta.durationSec
                  : undefined,
            imageUrl,
        ]);
        const existing = cache.get(spec);
        if (existing?.resources === resources) return existing.key;
        const {
            transform: _transform,
            name: _name,
            visible: _visible,
            locked: _locked,
            editorHidden: _hidden,
            snapToPaper: _snap,
            billboard: _billboard,
            ...content
        } = spec;
        const visual =
            content.type === 'audio'
                ? {
                      ...content,
                      audioKind: undefined,
                      volume: undefined,
                      loop: undefined,
                      autoplay: undefined,
                  }
                : content.type === 'text' || content.type === 'label'
                  ? {
                        ...content,
                        style: { ...content.style, color: undefined },
                        presentation: content.presentation
                            ? {
                                  ...content.presentation,
                                  ...('background' in content.presentation
                                      ? { background: undefined }
                                      : {}),
                                  ...(content.presentation.kind === 'screen'
                                      ? { buttonBackground: undefined }
                                      : {}),
                                  ...('border' in content.presentation &&
                                  content.presentation.border
                                      ? {
                                            border: {
                                                ...content.presentation.border,
                                                color: undefined,
                                            },
                                        }
                                      : {}),
                                  ...(content.presentation.kind === 'annotation'
                                      ? {
                                            labelOffset: undefined,
                                            connectorSide: undefined,
                                            descriptionColor: undefined,
                                            descriptionBackground: undefined,
                                        }
                                      : {}),
                              }
                            : undefined,
                    }
                  : content;
        const key = JSON.stringify([visual, resources], (_name, value: unknown) => {
            if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
            const record = value as Record<string, unknown>;
            return Object.fromEntries(
                Object.keys(record)
                    .sort()
                    .map((name) => [name, record[name]]),
            );
        });
        cache.set(spec, { resources, key });
        return key;
    };
}
