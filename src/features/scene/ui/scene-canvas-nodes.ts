import type { Dispatch, RefObject, SetStateAction } from 'react';
import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { AssetRef } from '@/shared/contracts/asset.schema';
import type { Scene, SceneObject } from '@/shared/contracts/scene.schema';
import { annotationConnectorSide } from '@/shared/scene/annotation-connector';
import { createAudioCard } from '@/shared/scene/audio-card';
import { facesCamera } from '@/shared/scene/audio-kind';
import { createBillboard } from '@/shared/scene/billboard';
import { createTextVisual, disposeTextVisual } from '@/shared/scene/text-renderer';
import { createAssetPlaceholder, waitForVideo } from '../model/asset-placeholder';
import { createModelSelectionBounds } from '../model/model-selection-bounds';
import { isVisibleInEditor, objectLabels } from '../model/objects';
import { applyRenderTransform } from '../model/render-transform';
import type { SceneAudioStore } from '../model/scene-audio-store';
import type { SceneLoadStore } from '../model/scene-load-store';
import { createSceneNodeKey } from '../model/scene-node-key';
import { textVisualColors } from '../model/text-visual-colors';

export type SceneCanvasNode = {
    root: THREE.Group;
    billboard: ReturnType<typeof createBillboard>;
    key: string;
    spec: SceneObject;
    mixer?: THREE.AnimationMixer;
    audio?: HTMLAudioElement;
    audioCard?: ReturnType<typeof createAudioCard>;
    releaseAudio?: () => void;
    modelBounds?: ReturnType<typeof createModelSelectionBounds>;
    textVisual?: Awaited<ReturnType<typeof createTextVisual>>;
    status: 'loading' | 'ready' | 'failed';
    placeholder?: ReturnType<typeof createAssetPlaceholder>;
    abort: AbortController;
    dispose: () => void;
};

type NodeProps = {
    scene: Scene;
    assets: Record<string, AssetRef>;
    selectedIds: string[];
    aspect: number;
    audioStore: SceneAudioStore;
    loadStore: SceneLoadStore;
    disabled: boolean;
    suspended?: boolean;
};

type NodeOptions = {
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    latest: RefObject<NodeProps>;
    themeColor: (token: string) => THREE.Color;
    isDisposed: () => boolean;
    isDragging: () => boolean;
    detachNode: (node: SceneCanvasNode) => void;
    onLoadSettled: () => void;
    setLoading: Dispatch<SetStateAction<number>>;
    setIssues: Dispatch<SetStateAction<Record<string, string>>>;
};

export function applyTransform(node: SceneCanvasNode, object: SceneObject) {
    applyRenderTransform(node.root, object.transform);
}

export function createSceneCanvasNodes({
    scene,
    camera,
    latest,
    themeColor,
    isDisposed,
    isDragging,
    detachNode,
    onLoadSettled,
    setLoading,
    setIssues,
}: NodeOptions) {
    const nodes = new Map<string, SceneCanvasNode>();
    const draco = new DRACOLoader().setDecoderPath('/vendor/draco-0.161.0/');
    const loader = new GLTFLoader().setDRACOLoader(draco);
    function resources(root: THREE.Object3D) {
        root.traverse((object) => {
            if (
                !(
                    object instanceof THREE.Mesh ||
                    object instanceof THREE.Line ||
                    object instanceof THREE.Sprite
                )
            )
                return;
            if ('geometry' in object) object.geometry.dispose();
            for (const mat of Array.isArray(object.material)
                ? object.material
                : [object.material]) {
                for (const item of Object.values(mat))
                    if (item instanceof THREE.Texture) item.dispose();
                mat.dispose();
            }
        });
    }
    const basic = (map: THREE.Texture) =>
        new THREE.MeshBasicMaterial({ map, transparent: true, side: THREE.DoubleSide });
    const plane = (w: number, h: number, mat: THREE.Material) =>
        new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    async function build(spec: SceneObject, key: string) {
        const root = new THREE.Group();
        root.userData.objectId = spec.id;
        scene.add(root);
        let media: HTMLMediaElement | undefined;
        const node: SceneCanvasNode = {
            root,
            billboard: createBillboard(root),
            key,
            spec,
            status: 'loading',
            abort: new AbortController(),
            dispose() {
                node.abort.abort();
                node.releaseAudio?.();
                node.audioCard?.dispose();
                node.placeholder?.dispose();
                node.placeholder = undefined;
                scene.remove(root);
                node.mixer?.stopAllAction();
                if (node.mixer) node.mixer.uncacheRoot(node.mixer.getRoot());
                if (media) {
                    media.pause();
                    media.removeAttribute('src');
                    media.load();
                }
                resources(root);
                root.clear();
            },
        };
        nodes.set(spec.id, node);
        latest.current.loadStore.set(spec.id, { status: 'loading' });
        setIssues((current) => {
            if (!(spec.id in current)) return current;
            const next = { ...current };
            delete next[spec.id];
            return next;
        });
        const initialAsset = 'assetId' in spec ? latest.current.assets[spec.assetId] : undefined;
        setLoading((count) => count + 1);
        try {
            node.placeholder = createAssetPlaceholder(
                spec,
                initialAsset,
                latest.current.aspect,
                themeColor('--text-muted'),
            );
            if (node.placeholder) node.billboard.content.add(node.placeholder.group);
            applyTransform(node, spec);
            const asset = 'assetId' in spec ? latest.current.assets[spec.assetId] : undefined;
            if ('assetId' in spec && !asset)
                throw new Error('Thiếu tài nguyên. Chọn lại tài nguyên trong bảng thuộc tính.');
            if (spec.type === 'model' && asset) {
                const model = await loader.loadAsync(asset.url);
                if (isDisposed() || nodes.get(spec.id) !== node) {
                    resources(model.scene);
                    return;
                }
                node.billboard.content.add(model.scene);
                node.modelBounds = createModelSelectionBounds(model.scene);
                node.mixer = new THREE.AnimationMixer(model.scene);
                if (spec.animation?.autoplay) {
                    const clip = model.animations.find(
                        (clip) => clip.name === spec.animation?.clip,
                    );
                    if (clip) {
                        const action = node.mixer.clipAction(clip);
                        action.setLoop(
                            spec.animation.loop ? THREE.LoopRepeat : THREE.LoopOnce,
                            spec.animation.loop ? Infinity : 1,
                        );
                        action.clampWhenFinished = true;
                        action.play();
                    }
                }
            } else if (spec.type === 'image' && asset) {
                const texture = await new THREE.TextureLoader()
                    .setCrossOrigin('anonymous')
                    .loadAsync(asset.url);
                if (isDisposed() || nodes.get(spec.id) !== node) {
                    texture.dispose();
                    return;
                }
                texture.colorSpace = THREE.SRGBColorSpace;
                const mat = basic(texture);
                mat.opacity = spec.opacity;
                node.billboard.content.add(
                    plane(1, texture.image.height / texture.image.width, mat),
                );
            } else if (spec.type === 'text' || spec.type === 'label') {
                const imageId =
                    spec.presentation?.kind === 'screen'
                        ? spec.presentation.imageAssetId
                        : undefined;
                const visual = await createTextVisual(spec, {
                    imageUrl: imageId ? latest.current.assets[imageId]?.url : undefined,
                });
                if (isDisposed() || nodes.get(spec.id) !== node) {
                    disposeTextVisual(visual.group);
                    return;
                }
                node.textVisual = visual;
                if (node.spec.type === 'text' || node.spec.type === 'label')
                    visual.updateColors?.(textVisualColors(node.spec));
                visual.setExpanded?.(latest.current.selectedIds.includes(spec.id));
                node.billboard.content.add(visual.group);
            } else if (spec.type === 'video' && asset) {
                const video = document.createElement('video');
                media = video;
                video.crossOrigin = 'anonymous';
                video.playsInline = true;
                video.preload = 'auto';
                video.muted = true;
                video.src = asset.url;
                video.addEventListener(
                    'loadeddata',
                    () => {
                        if (!isDisposed() && nodes.get(spec.id) === node)
                            video.currentTime = Math.min(0.05, video.duration || 0);
                    },
                    { once: true },
                );
                video.addEventListener('error', () => {
                    if (!isDisposed() && nodes.get(spec.id) === node)
                        setIssues((current) => ({
                            ...current,
                            [spec.id]: 'Không tải được video. Kiểm tra tệp tài nguyên.',
                        }));
                });
                const texture = new THREE.VideoTexture(video);
                texture.colorSpace = THREE.SRGBColorSpace;
                const surface = plane(
                    1,
                    (asset.meta.height || 1) / (asset.meta.width || 1),
                    basic(texture),
                );
                if (!asset.meta.width || !asset.meta.height)
                    video.addEventListener(
                        'loadedmetadata',
                        () => {
                            if (
                                isDisposed() ||
                                nodes.get(spec.id) !== node ||
                                !video.videoWidth ||
                                !video.videoHeight
                            )
                                return;
                            surface.geometry.dispose();
                            surface.geometry = new THREE.PlaneGeometry(
                                1,
                                video.videoHeight / video.videoWidth,
                            );
                        },
                        { once: true },
                    );
                node.billboard.content.add(surface);
                await waitForVideo(video, node.abort.signal);
            } else if (spec.type === 'hotspot')
                node.billboard.content.add(
                    plane(
                        spec.size[0],
                        spec.size[1],
                        new THREE.MeshBasicMaterial({
                            // This editor-only touch area sits on white paper in either theme.
                            color: 0x333333,
                            transparent: true,
                            opacity: 0.28,
                            side: THREE.DoubleSide,
                            depthWrite: false,
                        }),
                    ),
                );
            else if (spec.type === 'audio' && asset) {
                const element = new Audio();
                media = element;
                node.audio = element;
                element.crossOrigin = 'anonymous';
                element.preload = 'metadata';
                element.loop = spec.loop;
                element.volume = spec.volume;
                element.src = asset.url;
                const card = createAudioCard(spec, asset.meta.durationSec);
                node.audioCard = card;
                node.billboard.content.add(card.group);
                node.releaseAudio = latest.current.audioStore.register(
                    spec.id,
                    element,
                    (state) => {
                        card.setPlayback(state);
                        if (
                            state.playing &&
                            !state.error &&
                            !isDisposed() &&
                            nodes.get(spec.id) === node
                        )
                            setIssues((current) => {
                                if (!current[spec.id]) return current;
                                const next = { ...current };
                                delete next[spec.id];
                                return next;
                            });
                    },
                    (message) => {
                        if (!isDisposed() && nodes.get(spec.id) === node)
                            setIssues((current) => ({ ...current, [spec.id]: message }));
                    },
                );
            }
            if (isDisposed() || nodes.get(spec.id) !== node) {
                node.dispose();
                return;
            }
            node.placeholder?.dispose();
            node.placeholder = undefined;
            node.status = 'ready';
            latest.current.loadStore.set(spec.id);
            setIssues((current) => {
                const copy = { ...current };
                delete copy[spec.id];
                return copy;
            });
            onLoadSettled();
        } catch (cause) {
            if (!isDisposed() && nodes.get(spec.id) === node) {
                node.status = 'failed';
                const message = `${spec.name || objectLabels[spec.type]}: ${cause instanceof Error ? cause.message : 'Không tải được đối tượng.'}`;
                latest.current.loadStore.set(spec.id, { status: 'failed', message });
                setIssues((current) => ({ ...current, [spec.id]: message }));
                onLoadSettled();
            }
        } finally {
            if (!isDisposed()) setLoading((count) => Math.max(0, count - 1));
        }
    }
    const sceneNodeKey = createSceneNodeKey();
    function syncNodes(value: NodeProps) {
        const ids = new Set(value.scene.objects.map((object) => object.id));
        for (const [id, node] of nodes)
            if (!ids.has(id)) {
                detachNode(node);
                node.dispose();
                nodes.delete(id);
                latest.current.loadStore.set(id);
            }
        for (const spec of value.scene.objects) {
            const asset = 'assetId' in spec ? value.assets[spec.assetId] : undefined;
            const imageId =
                (spec.type === 'text' || spec.type === 'label') &&
                spec.presentation?.kind === 'screen'
                    ? spec.presentation.imageAssetId
                    : undefined;
            const key = sceneNodeKey(spec, asset, imageId ? value.assets[imageId]?.url : undefined);
            let node = nodes.get(spec.id);
            if (node && node.key !== key) {
                detachNode(node);
                node.dispose();
                nodes.delete(spec.id);
                node = undefined;
            }
            if (!node) {
                void build(spec, key);
                node = nodes.get(spec.id);
            }
            if (!node) continue;
            if (
                (spec.type === 'text' || spec.type === 'label') &&
                (node.spec.type === 'text' || node.spec.type === 'label') &&
                node.spec !== spec &&
                node.textVisual?.updateColors &&
                JSON.stringify(textVisualColors(node.spec)) !==
                    JSON.stringify(textVisualColors(spec))
            ) {
                node.textVisual.updateColors(textVisualColors(spec));
            }
            node.spec = spec;
            if (
                (spec.type === 'text' || spec.type === 'label') &&
                spec.presentation?.kind === 'annotation'
            )
                node.textVisual?.setAnnotationOffset?.(spec.presentation.labelOffset ?? [0, 0]);
            if (
                (spec.type === 'text' || spec.type === 'label') &&
                spec.presentation?.kind === 'annotation'
            )
                node.textVisual?.setAnnotationConnectorSide?.(
                    annotationConnectorSide(
                        spec.presentation,
                        spec.type === 'label' ? spec.target : [-0.3, 0, 0],
                    ),
                );
            node.textVisual?.setExpanded?.(value.selectedIds.includes(spec.id));
            if (spec.type === 'audio' && node.audio) {
                node.audio.loop = spec.loop;
                node.audio.volume = spec.volume;
                node.audioCard?.setTitle(spec.name || 'Âm thanh');
                node.audioCard?.setKind(spec.audioKind);
                if (value.suspended && !node.audio.paused) value.audioStore.pause(spec.id);
            }
            if (!(isDragging() && latest.current.selectedIds.includes(spec.id))) {
                applyTransform(node, spec);
            }
            node.root.visible = isVisibleInEditor(spec);
            node.billboard.update(
                camera,
                facesCamera(spec),
                (spec.type === 'text' || spec.type === 'label') &&
                    spec.presentation?.kind !== 'extruded',
            );
        }
    }

    function retryNode(id: string) {
        const node = nodes.get(id);
        if (node?.status !== 'failed' || latest.current.disabled) return;
        detachNode(node);
        node.dispose();
        nodes.delete(id);
        onLoadSettled();
    }

    return {
        nodes,
        syncNodes,
        retryNode,
        dispose() {
            for (const node of nodes.values()) node.dispose();
            draco.dispose();
        },
    };
}
