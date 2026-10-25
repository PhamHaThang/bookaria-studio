import * as THREE from 'three';

/** A world-space editor guide. It never belongs to the saved scene object list. */
export function createFrontGuide(
    aspect: number,
    style: {
        surface: string;
        foreground: string;
        border: string;
        font: string;
        anisotropy: number;
    },
) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 288;
    const context = canvas.getContext('2d');
    if (!context) return null;
    function paint() {
        if (!context) return;
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.beginPath();
        context.roundRect(6, 6, 500, 276, 48);
        context.fillStyle = style.surface;
        context.fill();
        context.lineWidth = 2;
        context.strokeStyle = style.border;
        context.stroke();
        context.fillStyle = style.foreground;
        context.font = `600 66px ${style.font}`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('Phía trước', 256, 116);
        context.beginPath();
        context.moveTo(222, 181);
        context.lineTo(290, 181);
        context.lineTo(256, 217);
        context.closePath();
        context.fill();
    }
    paint();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, style.anisotropy);
    const geometry = new THREE.PlaneGeometry(0.44, 0.2475);
    const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'bookaria-front-guide';
    // The page is in XY with +Z above the paper. Its lower edge is the reader's front.
    mesh.position.set(0, -aspect / 2 - 0.26, -0.006);
    mesh.userData.editorHelper = true;
    mesh.raycast = () => undefined;
    let disposed = false;
    void document.fonts.ready
        .then(() => {
            if (disposed) return;
            paint();
            texture.needsUpdate = true;
        })
        .catch(() => undefined);
    return {
        mesh,
        dispose() {
            if (disposed) return;
            disposed = true;
            mesh.removeFromParent();
            geometry.dispose();
            material.dispose();
            texture.dispose();
            canvas.width = canvas.height = 0;
        },
    };
}
