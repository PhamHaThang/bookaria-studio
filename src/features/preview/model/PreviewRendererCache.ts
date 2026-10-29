import { WebGLRenderer } from 'three';

/** One idle context per mounted editor; scenes, media and controls still release on exit. */
export class PreviewRendererCache {
    private renderer: WebGLRenderer | null = null;

    acquire() {
        if (this.renderer?.getContext().isContextLost()) this.dispose();
        this.renderer ??= new WebGLRenderer({ antialias: true });
        return this.renderer;
    }

    release(renderer: WebGLRenderer) {
        if (renderer !== this.renderer) return;
        renderer.setAnimationLoop(null);
        renderer.renderLists.dispose();
        renderer.domElement.remove();
    }

    dispose() {
        const renderer = this.renderer;
        this.renderer = null;
        if (!renderer) return;
        renderer.setAnimationLoop(null);
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
    }
}
