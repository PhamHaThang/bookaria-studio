import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { ManifestAsset } from '../contracts/asset.schema';
import type { ManifestPage } from '../contracts/manifest.schema';
import type { Action, SceneObject } from '../contracts/scene.schema';
import { createAudioCard, observeAudio } from '../scene/audio-card';
import { facesCamera } from '../scene/audio-kind';
import { createBillboard } from '../scene/billboard';
import { createTextVisual } from '../scene/text-renderer';
import { fetchBytes } from './fetchBytes';
import { InteractionRunner, sleep } from './InteractionRunner';

type Hooks = {
    tap?: (id: string) => void;
    notice: (message: string) => void;
    link: (url: string) => void;
    log: (message: string) => void;
};
type Node = {
    spec: SceneObject;
    root: THREE.Group;
    billboard: ReturnType<typeof createBillboard>;
    mixer?: THREE.AnimationMixer;
    clips?: THREE.AnimationClip[];
    video?: HTMLVideoElement;
    audio?: HTMLAudioElement;
    audioCard?: ReturnType<typeof createAudioCard>;
    releaseAudio?: () => void;
    textTap?: (uv?: { x: number; y: number }) => void;
    setTextExpanded?: (expanded: boolean) => boolean;
};
const radians = (n: number) => THREE.MathUtils.degToRad(n);
const easing = {
    linear: (t: number) => t,
    easeIn: (t: number) => t * t,
    easeOut: (t: number) => 1 - (1 - t) ** 2,
    easeInOut: (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
};

export async function buildScene(
    page: ManifestPage,
    assets: Record<string, ManifestAsset>,
    signal: AbortSignal,
    hooks: Hooks,
) {
    const group = new THREE.Group();
    const nodes = new Map<string, Node>(),
        textures = new Set<THREE.Texture>(),
        media = new Set<HTMLMediaElement>();
    const audio = new Map<string, HTMLAudioElement>();
    const audioAssets = new Map<HTMLAudioElement, string>();
    const playAttempts = new WeakMap<HTMLMediaElement, number>();
    const blockedMedia = new Set<HTMLMediaElement>();
    let lifecycle = 0;
    const blobUrls: string[] = [];
    const draco = new DRACOLoader().setDecoderPath('/vendor/draco-0.161.0/');
    const loader = new GLTFLoader().setDRACOLoader(draco);
    let muted = false,
        disposed = false;
    const activeTweens = new Map<string, AbortController>();
    const materialDefaults = new WeakMap<
        THREE.Material,
        { opacity: number; transparent: boolean }
    >();
    const visibilityGeneration = new Map<string, number>();
    const visibilityProgress = new Map<string, number>();
    const runner = new InteractionRunner(page.scene.interactions, execute, hooks.notice);
    function dispose() {
        if (disposed) return;
        disposed = true;
        runner.dispose();
        for (const tween of activeTweens.values()) tween.abort();
        for (const item of media) {
            item.pause();
            item.removeAttribute('src');
            item.load();
        }
        for (const node of nodes.values()) {
            node.releaseAudio?.();
            node.audioCard?.dispose();
            node.mixer?.stopAllAction();
            if (node.mixer) node.mixer.uncacheRoot(node.mixer.getRoot());
        }
        group.traverse((object) => {
            if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Line)) return;
            object.geometry.dispose();
            for (const material of Array.isArray(object.material)
                ? object.material
                : [object.material]) {
                for (const value of Object.values(material))
                    if (value instanceof THREE.Texture) textures.add(value);
                material.dispose();
            }
        });
        for (const texture of textures) {
            if (texture.image instanceof ImageBitmap) texture.image.close();
            texture.dispose();
        }
        for (const url of blobUrls) URL.revokeObjectURL(url);
        draco.dispose();
        group.clear();
    }
    async function texture(url: string) {
        const bytes = await fetchBytes(url, signal, 20 * 1024 * 1024);
        signal.throwIfAborted();
        const blob = new Blob([bytes]);
        const bitmap = await createImageBitmap(blob, { imageOrientation: 'flipY' });
        if (signal.aborted || disposed) {
            bitmap.close();
            signal.throwIfAborted();
            throw new Error('Đã dừng tải trang.');
        }
        const result = new THREE.Texture(bitmap);
        result.colorSpace = THREE.SRGBColorSpace;
        result.needsUpdate = true;
        textures.add(result);
        return result;
    }
    const plane = (width: number, height: number, material: THREE.Material) =>
        new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    const material = (map: THREE.Texture) =>
        new THREE.MeshBasicMaterial({ map, transparent: true, side: THREE.DoubleSide });
    function safePlay(element: HTMLMediaElement) {
        if (disposed) return;
        const attempt = (playAttempts.get(element) || 0) + 1;
        playAttempts.set(element, attempt);
        const playing = element.play();
        playing
            ?.then(() => {
                if (!disposed && playAttempts.get(element) === attempt)
                    blockedMedia.delete(element);
            })
            .catch(() => {
                if (disposed || playAttempts.get(element) !== attempt) return;
                blockedMedia.add(element);
                for (const node of nodes.values())
                    if (node.audio === element)
                        node.audioCard?.setPlayback({
                            playing: false,
                            waiting: false,
                            currentTime: element.currentTime || 0,
                            duration: Number.isFinite(element.duration) ? element.duration : 0,
                            error: 'Không phát được âm thanh. Hãy thử lại.',
                        });
                if (!disposed)
                    hooks.notice(
                        'Trình duyệt chưa phát được âm thanh/video. Chạm “Thử phát media” hoặc kiểm tra tệp.',
                    );
            });
    }
    function getAudio(id: string, key = id) {
        let element = audio.get(key);
        if (element) return element;
        const asset = assets[id];
        if (asset?.type !== 'AUDIO') throw new Error('Thiếu tài nguyên âm thanh.');
        element = new Audio();
        element.crossOrigin = 'anonymous';
        element.preload = 'metadata';
        element.src = asset.url;
        element.muted = muted;
        element.addEventListener('error', () => {
            if (!disposed)
                hooks.notice('Không tải được âm thanh. Kiểm tra tài nguyên hoặc thử lại.');
        });
        audio.set(key, element);
        audioAssets.set(element, id);
        media.add(element);
        return element;
    }
    function stopMedia() {
        blockedMedia.clear();
        for (const element of media) {
            playAttempts.set(element, (playAttempts.get(element) || 0) + 1);
            element.pause();
            try {
                element.currentTime = 0;
            } catch {}
        }
    }
    async function tween(
        key: string,
        duration: number,
        signal: AbortSignal,
        update: (progress: number) => void,
    ) {
        activeTweens.get(key)?.abort();
        const local = new AbortController();
        activeTweens.set(key, local);
        const combined = AbortSignal.any([signal, local.signal]);
        const start = performance.now();
        try {
            if (!duration) {
                combined.throwIfAborted();
                update(1);
                return true;
            }
            while (true) {
                combined.throwIfAborted();
                const t = Math.min(1, (performance.now() - start) / duration);
                update(t);
                if (t === 1) break;
                await sleep(16, combined);
            }
            return true;
        } catch (error) {
            if (!local.signal.aborted) throw error;
            return false;
        } finally {
            if (activeTweens.get(key) === local) activeTweens.delete(key);
        }
    }
    async function execute(action: Exclude<Action, { type: 'wait' }>, actionSignal: AbortSignal) {
        hooks.log(action.type);
        if (action.type === 'playAudio') {
            const element = getAudio(action.assetId);
            element.loop = action.loop;
            element.volume = action.volume;
            element.currentTime = 0;
            safePlay(element);
            return;
        }
        if (action.type === 'stopAudio') {
            for (const element of media) {
                if (
                    element instanceof HTMLAudioElement &&
                    (!action.assetId || audioAssets.get(element) === action.assetId)
                ) {
                    playAttempts.set(element, (playAttempts.get(element) || 0) + 1);
                    element.pause();
                    blockedMedia.delete(element);
                    element.currentTime = 0;
                }
            }
            return;
        }
        if (action.type === 'openUrl') {
            hooks.link(action.url);
            return;
        }
        const node = nodes.get(action.objectId);
        if (!node) throw new Error('Không tìm thấy đối tượng của hành động.');
        if (action.type === 'playAnimation') {
            const clip = node.clips?.find((clip) => clip.name === action.clip);
            if (!clip || !node.mixer) throw new Error(`Mô hình không có clip “${action.clip}”.`);
            node.mixer.stopAllAction();
            const animation = node.mixer.clipAction(clip);
            animation.reset();
            animation.setLoop(
                action.loop ? THREE.LoopRepeat : THREE.LoopOnce,
                action.loop ? Infinity : 1,
            );
            animation.clampWhenFinished = !action.loop;
            animation.play();
            return;
        }
        if (action.type === 'playVideo') {
            if (!node.video) throw new Error('Đối tượng không phải video.');
            safePlay(node.video);
            return;
        }
        if (action.type === 'setVisible' || action.type === 'toggleVisible') {
            const visible = action.type === 'setVisible' ? action.value : !node.root.visible;
            const generation = (visibilityGeneration.get(node.spec.id) || 0) + 1;
            visibilityGeneration.set(node.spec.id, generation);
            // Root visibility is separate from author-defined opacity of image/materials.
            const materials: { material: THREE.Material; opacity: number; transparent: boolean }[] =
                [];
            node.root.traverse((object) => {
                if (object instanceof THREE.Mesh)
                    for (const mat of Array.isArray(object.material)
                        ? object.material
                        : [object.material]) {
                        let base = materialDefaults.get(mat);
                        if (!base) {
                            base = { opacity: mat.opacity, transparent: mat.transparent };
                            materialDefaults.set(mat, base);
                        }
                        materials.push({ material: mat, ...base });
                    }
            });
            const start = visibilityProgress.get(node.spec.id) ?? (node.root.visible ? 1 : 0);
            node.root.visible = true;
            try {
                const completed = await tween(
                    `${node.spec.id}:visible`,
                    action.durationMs,
                    actionSignal,
                    (t) => {
                        const opacity = THREE.MathUtils.lerp(start, visible ? 1 : 0, t);
                        visibilityProgress.set(node.spec.id, opacity);
                        for (const item of materials) {
                            item.material.transparent = true;
                            item.material.opacity = item.opacity * opacity;
                        }
                    },
                );
                if (completed && visibilityGeneration.get(node.spec.id) === generation) {
                    node.root.visible = visible;
                    visibilityProgress.set(node.spec.id, visible ? 1 : 0);
                }
            } finally {
                if (visibilityGeneration.get(node.spec.id) === generation)
                    for (const item of materials) {
                        item.material.opacity = item.opacity;
                        item.material.transparent = item.transparent;
                    }
            }
            return;
        }
        if (action.type === 'transformTo') {
            const before = {
                position: node.root.position.clone(),
                rotation: new THREE.Vector3(
                    node.root.rotation.x,
                    node.root.rotation.y,
                    node.root.rotation.z,
                ),
                scale: node.root.scale.clone(),
            };
            await tween(`${node.spec.id}:transform`, action.durationMs, actionSignal, (t) => {
                const amount = easing[action.easing](t);
                if (action.position)
                    node.root.position.lerpVectors(
                        before.position,
                        new THREE.Vector3(...action.position),
                        amount,
                    );
                if (action.rotation) {
                    const value = new THREE.Vector3().lerpVectors(
                        before.rotation,
                        new THREE.Vector3(...action.rotation.map(radians)),
                        amount,
                    );
                    node.root.rotation.set(value.x, value.y, value.z);
                }
                if (action.scale)
                    node.root.scale.lerpVectors(
                        before.scale,
                        new THREE.Vector3(...action.scale),
                        amount,
                    );
            });
        }
    }
    try {
        const background = await texture(page.imageUrl);
        signal.throwIfAborted();
        const paper = plane(
            1,
            page.aspect,
            new THREE.MeshBasicMaterial({ map: background, side: THREE.DoubleSide }),
        );
        paper.position.z = -0.002;
        paper.name = 'page-background';
        group.add(paper);
        // Sequential loading bounds peak memory and makes cancellation deterministic.
        for (const spec of page.scene.objects) {
            signal.throwIfAborted();
            const root = new THREE.Group();
            root.name = spec.id;
            root.position.fromArray(spec.transform.position);
            root.rotation.set(
                ...(spec.transform.rotation.map(radians) as [number, number, number]),
            );
            root.scale.fromArray(spec.transform.scale);
            root.visible = spec.visible;
            root.userData.objectId = spec.id;
            const node: Node = { spec, root, billboard: createBillboard(root) };
            nodes.set(spec.id, node);
            group.add(root);
            if (spec.type === 'model') {
                const asset = assets[spec.assetId];
                if (asset?.type !== 'MODEL') throw new Error('Thiếu tài nguyên mô hình.');
                const bytes = await fetchBytes(asset.url, signal);
                const gltf = await loader.parseAsync(bytes, new URL('.', asset.url).href);
                node.billboard.content.add(gltf.scene);
                node.mixer = new THREE.AnimationMixer(gltf.scene);
                node.clips = gltf.animations;
            } else if (spec.type === 'image') {
                const asset = assets[spec.assetId];
                if (asset?.type !== 'IMAGE') throw new Error('Thiếu tài nguyên ảnh.');
                const map = await texture(asset.url);
                const mat = material(map);
                mat.opacity = spec.opacity;
                const image = map.image as ImageBitmap;
                node.billboard.content.add(plane(1, image.height / image.width, mat));
            } else if (spec.type === 'text' || spec.type === 'label') {
                const presentation = spec.presentation;
                const visual = await createTextVisual(spec, {
                    imageUrl:
                        presentation?.kind === 'screen' && presentation.imageAssetId
                            ? assets[presentation.imageAssetId]?.url
                            : undefined,
                    signal,
                });
                node.billboard.content.add(visual.group);
                node.textTap = visual.tap ?? visual.next;
                node.setTextExpanded = visual.setExpanded;
                if (presentation?.kind === 'annotation' && presentation.description) {
                    node.textTap = visual.toggleDescription
                        ? () => {
                              visual.toggleDescription?.();
                          }
                        : () => hooks.notice(presentation.description);
                }
                if (
                    presentation?.kind === 'screen' &&
                    presentation.buttonLabel &&
                    presentation.buttonUrl
                ) {
                    const url = presentation.buttonUrl;
                    node.textTap = () => hooks.link(url);
                }
            } else if (spec.type === 'video') {
                const asset = assets[spec.assetId];
                if (asset?.type !== 'VIDEO') throw new Error('Thiếu tài nguyên video.');
                const element = document.createElement('video');
                element.crossOrigin = 'anonymous';
                element.playsInline = true;
                element.preload = 'metadata';
                element.loop = spec.loop;
                element.muted = spec.muted;
                element.volume = spec.volume;
                element.src = asset.url;
                node.video = element;
                media.add(element);
                element.addEventListener('error', () => {
                    if (!disposed) hooks.notice('Không tải được video của trang.');
                });
                const map = new THREE.VideoTexture(element);
                map.colorSpace = THREE.SRGBColorSpace;
                textures.add(map);
                const surface = plane(
                    1,
                    (asset.meta?.height || 1) / (asset.meta?.width || 1),
                    material(map),
                );
                if (!asset.meta?.width || !asset.meta?.height)
                    element.addEventListener(
                        'loadedmetadata',
                        () => {
                            if (
                                disposed ||
                                signal.aborted ||
                                !element.videoWidth ||
                                !element.videoHeight
                            )
                                return;
                            surface.geometry.dispose();
                            surface.geometry = new THREE.PlaneGeometry(
                                1,
                                element.videoHeight / element.videoWidth,
                            );
                        },
                        { once: true },
                    );
                node.billboard.content.add(surface);
            } else if (spec.type === 'hotspot') {
                const hitArea = plane(
                    spec.size[0],
                    spec.size[1],
                    new THREE.MeshBasicMaterial({
                        transparent: true,
                        opacity: 0,
                        side: THREE.DoubleSide,
                        depthWrite: false,
                    }),
                );
                node.billboard.content.add(hitArea);
                if (spec.showHint) {
                    const radius = Math.min(spec.size[0], spec.size[1]) * 0.25;
                    const hint = new THREE.Mesh(
                        new THREE.RingGeometry(radius * 0.7, radius, 32),
                        new THREE.MeshBasicMaterial({
                            color: 0x252525,
                            transparent: true,
                            opacity: 0.65,
                            side: THREE.DoubleSide,
                            depthWrite: false,
                        }),
                    );
                    hint.position.z = 0.0001;
                    node.billboard.content.add(hint);
                }
            } else if (spec.type === 'audio') {
                const element = getAudio(spec.assetId, `object:${spec.id}`);
                node.audio = element;
                element.loop = spec.loop;
                element.volume = spec.volume;
                const card = createAudioCard(spec, assets[spec.assetId]?.meta?.durationSec);
                node.audioCard = card;
                node.billboard.content.add(card.group);
                node.releaseAudio = observeAudio(element, card.setPlayback);
                // Asset actions control the first visible player for this asset as well.
                if (!audio.has(spec.assetId)) audio.set(spec.assetId, element);
            }
        }
        if (page.settings.backgroundAudioAssetId)
            getAudio(page.settings.backgroundAudioAssetId, 'background');
        if (page.settings.narrationAssetId) getAudio(page.settings.narrationAssetId, 'narration');
        signal.throwIfAborted();
        return {
            group,
            runner,
            nodes,
            update(delta: number, camera: THREE.Camera) {
                for (const node of nodes.values()) {
                    node.mixer?.update(delta);
                    const spec = node.spec;
                    node.billboard.update(
                        camera,
                        facesCamera(spec),
                        (spec.type === 'text' || spec.type === 'label') &&
                            spec.presentation?.kind !== 'extruded',
                    );
                }
            },
            start() {
                lifecycle++;
                runner.cancelAll();
                for (const node of nodes.values()) {
                    if (node.spec.type === 'audio' && node.spec.autoplay && node.audio)
                        safePlay(node.audio);
                    if (node.spec.type === 'video' && node.spec.autoplay && node.video)
                        safePlay(node.video);
                    if (node.spec.type === 'model' && node.spec.animation?.autoplay)
                        void execute(
                            {
                                type: 'playAnimation',
                                objectId: node.spec.id,
                                clip: node.spec.animation.clip,
                                loop: node.spec.animation.loop,
                                delayMsSchema: 0,
                            },
                            signal,
                        ).catch((error) => hooks.notice(error.message));
                }
                if (page.settings.backgroundAudioAssetId) {
                    const element = getAudio(page.settings.backgroundAudioAssetId, 'background');
                    element.loop = page.settings.backgroundLoop;
                    safePlay(element);
                }
                if (page.settings.narrationAssetId)
                    safePlay(getAudio(page.settings.narrationAssetId, 'narration'));
                void runner.fire({ type: 'onPageEnter' });
            },
            async leave() {
                const current = ++lifecycle;
                runner.cancelAll();
                stopMedia();
                const deadline = setTimeout(() => {
                    if (current === lifecycle) runner.cancelAll();
                }, 2000);
                try {
                    await runner.fire({ type: 'onPageLeave' });
                } finally {
                    clearTimeout(deadline);
                    if (current === lifecycle) stopMedia();
                }
            },
            tap(id: string, uv?: { x: number; y: number }) {
                if (disposed) return;
                const tapped = nodes.get(id);
                if (tapped?.root.visible) {
                    const ownTap = page.scene.interactions.some(
                        (rule) =>
                            rule.enabled &&
                            rule.trigger.type === 'onTap' &&
                            rule.trigger.objectId === id,
                    );
                    if (tapped.audio && ((uv && tapped.audioCard?.isPlayHit(uv)) || !ownTap)) {
                        const element = tapped.audio;
                        if (element.paused || element.error) {
                            if (element.error) element.load();
                            safePlay(element);
                        } else {
                            playAttempts.set(element, (playAttempts.get(element) || 0) + 1);
                            blockedMedia.delete(element);
                            element.pause();
                        }
                        hooks.tap?.(id);
                        return;
                    }
                    for (const [otherId, node] of nodes)
                        if (otherId !== id) node.setTextExpanded?.(false);
                    nodes.get(id)?.textTap?.(uv);
                    hooks.tap?.(id);
                    void runner.fire({ type: 'onTap', objectId: id });
                }
            },
            mute(value: boolean) {
                muted = value;
                for (const element of media) {
                    const node = [...nodes.values()].find((node) => node.video === element);
                    element.muted =
                        value || (node?.spec.type === 'video' && node.spec.muted) || false;
                }
            },
            retryMedia() {
                for (const element of blockedMedia) safePlay(element);
            },
            stopMedia,
            dispose,
        };
    } catch (error) {
        dispose();
        throw error;
    }
}
export type PageRuntime = Awaited<ReturnType<typeof buildScene>>;
