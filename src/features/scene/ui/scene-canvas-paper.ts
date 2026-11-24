import type { Dispatch, SetStateAction } from 'react';
import * as THREE from 'three';
import { pageImageSize } from '../model/page-image-fit';

type PaperOptions = {
    scene: THREE.Scene;
    getAspect: () => number;
    isDisposed: () => boolean;
    setIssues: Dispatch<SetStateAction<Record<string, string>>>;
};

export function createSceneCanvasPaper({ scene, getAspect, isDisposed, setIssues }: PaperOptions) {
    const paper = new THREE.Mesh(
        new THREE.PlaneGeometry(1, getAspect()),
        new THREE.MeshBasicMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1,
        }),
    );
    paper.position.z = -0.003;
    scene.add(paper);
    const paperImage = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
    );
    paperImage.name = 'bookaria-page-image';
    paperImage.position.copy(paper.position);
    paperImage.visible = false;
    scene.add(paperImage);
    const paperTexture = new THREE.TextureLoader();
    paperTexture.setCrossOrigin('anonymous');
    let paperSource = '';
    function updatePaperImage(source: string) {
        if (source === paperSource) return;
        paperSource = source;
        paperTexture.load(
            source,
            (texture) => {
                if (isDisposed() || source !== paperSource) {
                    texture.dispose();
                    return;
                }
                texture.colorSpace = THREE.SRGBColorSpace;
                const size = pageImageSize(
                    texture.image.naturalWidth || texture.image.width,
                    texture.image.naturalHeight || texture.image.height,
                    getAspect(),
                );
                paperImage.scale.set(size.width, size.height, 1);
                const previous = paperImage.material.map;
                paperImage.material.map = texture;
                paperImage.material.needsUpdate = true;
                paperImage.visible = true;
                previous?.dispose();
                setIssues((current) => {
                    if (!current.page) return current;
                    const next = { ...current };
                    delete next.page;
                    return next;
                });
            },
            undefined,
            () => {
                if (!isDisposed() && source === paperSource)
                    setIssues((current) => ({
                        ...current,
                        page: 'Không tải được ảnh trang. Kiểm tra kết nối và chọn lại ảnh.',
                    }));
            },
        );
    }
    return {
        paper,
        updatePaperImage,
        dispose() {
            paperImage.material.map?.dispose();
            paperImage.geometry.dispose();
            paperImage.material.dispose();
            paper.geometry.dispose();
            paper.material.dispose();
        },
    };
}
