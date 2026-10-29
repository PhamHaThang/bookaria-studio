import { MOUSE } from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/** Keep authoring and local playback navigation at the same sensitivity. */
export function configureSceneOrbit(orbit: OrbitControls) {
    orbit.enableDamping = true;
    orbit.dampingFactor = 0.18;
    orbit.minPolarAngle = 0.0001;
    orbit.maxPolarAngle = Math.PI - 0.0001;
    orbit.rotateSpeed = 0.65;
    orbit.panSpeed = 0.8;
    orbit.zoomSpeed = 0.8;
    orbit.zoomToCursor = true;
    orbit.minDistance = 0.15;
    orbit.maxDistance = 15;
    orbit.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN };
}

/** Flush pending deltas without shifting the view that was visible to the user. */
export function stopSceneOrbit(orbit: OrbitControls) {
    const damping = orbit.enableDamping;
    const position = orbit.object.position.clone();
    const target = orbit.target.clone();
    orbit.enableDamping = false;
    orbit.update();
    orbit.object.position.copy(position);
    orbit.target.copy(target);
    orbit.update();
    orbit.enableDamping = damping;
}
