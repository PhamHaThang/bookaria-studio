import type { RefObject } from 'react';
import * as THREE from 'three';
import type { createAssetPlaceholder } from '../model/asset-placeholder';
import type { LocalDepthDrag } from '../model/local-depth';
import { pageUnitsToMm } from '../model/scene-units';
import { layoutSelectionTools, projectSelectionBounds } from '../model/selection-tools';

export function observeSceneCanvasLayout(element: HTMLElement) {
    const viewport = element.parentElement;
    const stage = viewport?.parentElement;
    const pageDock = element
        .closest('.scene-editor')
        ?.querySelector<HTMLElement>('[data-page-dock]');
    const workspace = element.closest<HTMLElement>('.scene-workspace');
    const workbench = workspace?.closest<HTMLElement>('.workbench-body');
    const hints = workbench?.querySelector<HTMLElement>('[data-canvas-hints-host]');
    const footer = stage?.querySelector<HTMLElement>('[data-canvas-footer]');
    const dockSurface = pageDock?.querySelector<HTMLElement>('.page-strip-region');
    // The page dock grows when unsaved changes or feedback appear.
    // Measure it on resize instead of guessing a fixed bottom offset.
    const positionFeedback = () => {
        if (workspace && hints && hints.getBoundingClientRect().height > 0) {
            const reserved =
                workspace.getBoundingClientRect().bottom - hints.getBoundingClientRect().top;
            workbench?.style.setProperty('--canvas-hints-height', `${Math.ceil(reserved)}px`);
        }
        if (!viewport || !pageDock) return;
        const bottom = Math.max(
            16,
            element.getBoundingClientRect().bottom - pageDock.getBoundingClientRect().top + 12,
        );
        viewport.style.setProperty('--transform-feedback-bottom', `${bottom}px`);
        if (workspace && stage && dockSurface && footer) {
            const tools = footer.getBoundingClientRect();
            if (!tools.height) return;
            const pages = dockSurface.getBoundingClientRect();
            const workspaceBottom = workspace.getBoundingClientRect().bottom;
            const dockInset = pages.height ? workspaceBottom - pages.top + 12 : 0;
            const overlapsDock =
                pages.height > 0 && tools.left < pages.right + 8 && tools.right + 8 > pages.left;
            const stageBottom = stage.getBoundingClientRect().bottom;
            const inset = overlapsDock
                ? stageBottom - pages.top + 8
                : pages.height
                  ? stageBottom - pages.bottom
                  : 16;
            footer.style.setProperty('--canvas-tools-inset', `${inset}px`);
            const panelAnchor = workspaceBottom - footer.getBoundingClientRect().top + 12;
            const dockClearance = tools.right - pages.right;
            const panelBottom = Math.max(panelAnchor, dockClearance >= 408 ? 0 : dockInset);
            const widePanelBottom = Math.max(panelAnchor, dockClearance >= 688 ? 0 : dockInset);
            const layersBottom = tools.right - pages.right >= 332 ? 100 : Math.max(100, dockInset);
            workspace.style.setProperty('--scene-assistant-panel-bottom', `${panelBottom}px`);
            workspace.style.setProperty(
                '--scene-assistant-wide-panel-bottom',
                `${widePanelBottom}px`,
            );
            workspace.style.setProperty(
                '--scene-layers-bottom',
                `${Math.max(layersBottom, panelAnchor - 4)}px`,
            );
        }
    };
    const feedbackLayout = new ResizeObserver(positionFeedback);
    feedbackLayout.observe(element);
    if (hints) feedbackLayout.observe(hints);
    if (pageDock) feedbackLayout.observe(pageDock);
    if (dockSurface) feedbackLayout.observe(dockSurface);
    if (footer) feedbackLayout.observe(footer);
    footer?.addEventListener('transitionend', positionFeedback);
    const inspectorLayout = new MutationObserver(positionFeedback);
    if (workspace)
        inspectorLayout.observe(workspace, { attributeFilter: ['data-inspector-visible'] });
    return () => {
        feedbackLayout.disconnect();
        inspectorLayout.disconnect();
        footer?.removeEventListener('transitionend', positionFeedback);
        workbench?.style.removeProperty('--canvas-hints-height');
        viewport?.style.removeProperty('--transform-feedback-bottom');
    };
}

type OverlayOptions = {
    canvas: HTMLCanvasElement;
    camera: THREE.PerspectiveCamera;
    leftTools: RefObject<HTMLDivElement | null>;
    rightTools: RefObject<HTMLDivElement | null>;
    loadingHost: RefObject<HTMLDivElement | null>;
    depthButton: HTMLButtonElement | null;
    depthLink: Element | null | undefined;
    widthMmRef: RefObject<number>;
    billboardPivot: THREE.Group;
    nodes: ReadonlyMap<
        string,
        { root: THREE.Group; placeholder?: ReturnType<typeof createAssetPlaceholder> }
    >;
    selectionFrame: () => { bounds: THREE.Box3; matrix: THREE.Matrix4 } | undefined;
    selectionBounds: () => THREE.Box3;
    isDragging: () => boolean;
    isOutlineVisible: () => boolean;
    getDepthDrag: () => { start: LocalDepthDrag } | null;
    canUseDepth: () => boolean;
};

export function createSceneCanvasOverlays({
    canvas,
    camera,
    leftTools,
    rightTools,
    loadingHost,
    depthButton,
    depthLink,
    widthMmRef,
    billboardPivot,
    nodes,
    selectionFrame,
    selectionBounds,
    isDragging,
    isOutlineVisible,
    getDepthDrag,
    canUseDepth,
}: OverlayOptions) {
    const depthFeedback = depthButton?.querySelector('[data-depth-feedback]');
    const depthFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 });
    function positionSelectionTools() {
        const left = leftTools.current,
            right = rightTools.current;
        if (!left || !right) return;
        const viewport = {
            width: canvas.clientWidth,
            height: canvas.clientHeight,
        };
        const frame = selectionFrame();
        const bounds =
            !isDragging() && isOutlineVisible()
                ? frame
                    ? projectSelectionBounds(frame.bounds, camera, viewport, frame.matrix)
                    : projectSelectionBounds(selectionBounds(), camera, viewport)
                : null;
        if (!bounds) {
            left.style.visibility = 'hidden';
            right.style.visibility = 'hidden';
            return;
        }
        const inspector = canvas
            .closest('.scene-workspace')
            ?.querySelector('aside[aria-label="Bảng chỉnh sửa"]');
        const covered = inspector
            ? Math.max(
                  0,
                  canvas.getBoundingClientRect().right - inspector.getBoundingClientRect().left,
              )
            : 0;
        const positions = layoutSelectionTools(
            bounds,
            { ...viewport, width: Math.max(1, viewport.width - covered) },
            { width: left.offsetWidth, height: left.offsetHeight },
            { width: right.offsetWidth, height: right.offsetHeight },
        );
        for (const [rail, position] of [
            [left, positions.left],
            [right, positions.right],
        ] as const) {
            const transform = `translate3d(${Math.round(position.x)}px, ${Math.round(position.y)}px, 0)`;
            if (rail.style.transform !== transform) rail.style.transform = transform;
            rail.style.visibility = 'visible';
        }
    }
    const depthScreen = new THREE.Vector3(),
        depthOffset = new THREE.Vector3();
    function positionDepthHandle() {
        if (!depthButton) return;
        const depthDrag = getDepthDrag();
        const show = Boolean(depthDrag) || (!isDragging() && canUseDepth());
        if (!show) {
            depthButton.style.visibility = 'hidden';
            return;
        }
        billboardPivot.getWorldPosition(depthScreen).project(camera);
        if (depthScreen.z < -1 || depthScreen.z > 1) {
            depthButton.style.visibility = 'hidden';
            return;
        }
        const width = canvas.clientWidth,
            height = canvas.clientHeight;
        const originX = ((depthScreen.x + 1) * width) / 2;
        const originY = ((1 - depthScreen.y) * height) / 2;
        const x = Math.round(
            THREE.MathUtils.clamp(
                originX - 36 - depthButton.offsetWidth / 2,
                8,
                Math.max(8, width - depthButton.offsetWidth - 8),
            ),
        );
        const y = Math.round(
            THREE.MathUtils.clamp(
                originY + 36 - depthButton.offsetHeight / 2,
                8,
                Math.max(8, height - depthButton.offsetHeight - 8),
            ),
        );
        if (depthLink) {
            const linkX = String(Number((originX - x).toFixed(2)));
            const linkY = String(Number((originY - y).toFixed(2)));
            if (depthLink.getAttribute('x1') !== linkX) depthLink.setAttribute('x1', linkX);
            if (depthLink.getAttribute('y1') !== linkY) depthLink.setAttribute('y1', linkY);
        }
        const transform = `translate3d(${x}px, ${y}px, 0)`;
        if (depthButton.style.transform !== transform) depthButton.style.transform = transform;
        const active = String(Boolean(depthDrag));
        if (depthButton.dataset.dragging !== active) depthButton.dataset.dragging = active;
        if (depthDrag && depthFeedback) {
            const offset = depthOffset
                .copy(billboardPivot.position)
                .sub(depthDrag.start.position)
                .dot(depthDrag.start.axis);
            const text = `Z ${offset >= 0 ? '+' : ''}${depthFormat.format(pageUnitsToMm(offset, widthMmRef.current))} mm`;
            if (depthFeedback.textContent !== text) depthFeedback.textContent = text;
        }
        depthButton.style.visibility = 'visible';
    }
    const loadingBounds = new THREE.Box3();
    function positionLoadingCards() {
        const host = loadingHost.current;
        if (!host?.childElementCount) return;
        const width = canvas.clientWidth,
            height = canvas.clientHeight;
        for (const child of host.children) {
            if (!(child instanceof HTMLElement)) continue;
            const node = nodes.get(child.dataset.assetLoading || '');
            const bounds =
                node?.placeholder && node.root.visible
                    ? projectSelectionBounds(
                          loadingBounds.setFromObject(node.placeholder.group),
                          camera,
                          { width, height },
                      )
                    : null;
            if (!bounds) {
                child.style.visibility = 'hidden';
                continue;
            }
            const x = THREE.MathUtils.clamp(
                (bounds.left + bounds.right - child.offsetWidth) / 2,
                12,
                Math.max(12, width - child.offsetWidth - 12),
            );
            const y = THREE.MathUtils.clamp(
                (bounds.top + bounds.bottom - child.offsetHeight) / 2,
                70,
                Math.max(70, height - child.offsetHeight - 70),
            );
            const transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
            if (child.style.transform !== transform) child.style.transform = transform;
            child.style.visibility = 'visible';
        }
    }
    return { positionSelectionTools, positionDepthHandle, positionLoadingCards };
}
