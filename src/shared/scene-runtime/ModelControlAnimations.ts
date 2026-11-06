import * as THREE from 'three';
import type { SceneObject } from '../contracts/scene.schema';
import type { ModelMotion } from './ModelControls';

type AnimatedNode = {
    spec: SceneObject;
    mixer?: THREE.AnimationMixer;
    clips?: THREE.AnimationClip[];
};
/** Locomotion clips blend on transitions only; faded actions are stopped after the blend. */
export class ModelControlAnimations {
    private nodes: ReadonlyMap<string, AnimatedNode>;
    private retiring = new Map<THREE.AnimationAction, number>();
    private beforeChange: (id: string) => void;
    constructor(
        nodes: ReadonlyMap<string, AnimatedNode>,
        beforeChange: (id: string) => void = () => {},
    ) {
        this.nodes = nodes;
        this.beforeChange = beforeChange;
    }
    set(id: string, motion: ModelMotion) {
        const node = this.nodes.get(id);
        if (!node?.mixer || node.spec.type !== 'model') return;
        const config = node.spec.controls;
        if (!config?.idleClip && !config?.moveClip) return;
        const authored =
            motion === 'inactive' && node.spec.animation?.autoplay
                ? node.spec.animation
                : undefined;
        const name =
            motion === 'moving'
                ? config.moveClip
                : motion === 'idle'
                  ? config.idleClip
                  : authored?.clip;
        const clip = node.clips?.find((clip) => clip.name === name);
        const next = clip ? node.mixer.clipAction(clip) : undefined;
        this.beforeChange(id);
        for (const clip of node.clips || []) {
            const action = node.mixer.existingAction(clip);
            if (action && action !== next && action.isRunning()) {
                action.fadeOut(0.15);
                this.retiring.set(action, 0.15);
            }
        }
        if (!next) return;
        const wasRetiring = this.retiring.delete(next);
        next.setLoop(
            authored && !authored.loop ? THREE.LoopOnce : THREE.LoopRepeat,
            authored && !authored.loop ? 1 : Infinity,
        );
        next.clampWhenFinished = Boolean(authored && !authored.loop);
        if (!next.isRunning())
            next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.15).play();
        else if (wasRetiring) next.fadeIn(0.15);
    }
    release(id: string) {
        const node = this.nodes.get(id);
        if (!node?.mixer) return;
        for (const clip of node.clips || []) {
            const action = node.mixer.existingAction(clip);
            if (action) this.retiring.delete(action);
        }
    }
    update(delta: number) {
        for (const [action, remaining] of this.retiring) {
            if (remaining <= delta) {
                action.stop();
                this.retiring.delete(action);
            } else this.retiring.set(action, remaining - delta);
        }
    }
    dispose() {
        this.retiring.clear();
    }
}
