import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { LocalPreviewStage } from '../../src/features/preview/model/LocalPreviewStage';
import { ModelControlProperties } from '../../src/features/scene/ui/ModelControlProperties';
import { SceneUnitsProvider } from '../../src/features/scene/ui/SceneUnits';
import { PageSettingsSchema, SceneSchema } from '../../src/shared/contracts/scene.schema';
import { buildScene } from '../../src/shared/scene-runtime/buildScene';
import { askWorkflowQuestion } from '../../src/shared/scene-runtime/WorkflowPrompt';
import { ThemeProvider } from '../../src/shared/theme/ThemeProvider';

const assetId = '11111111-1111-4111-8111-111111111111';
const scene = SceneSchema.parse({
    schemaVersion: 1,
    objects: [
        {
            id: 'car',
            name: 'Xe thử nghiệm',
            type: 'model',
            assetId,
            transform: { position: [0, 0, 0.17] },
            controls: { enabled: true, autoRotate: false, idleClip: 'Idle', moveClip: 'Run' },
        },
    ],
    interactions: [
        {
            id: 'disable',
            trigger: { type: 'onTap', objectId: 'car' },
            actions: [{ type: 'controlModel', objectId: 'car', operation: 'disable' }],
        },
        {
            id: 'enable',
            trigger: { type: 'onMarkerFound' },
            actions: [{ type: 'controlModel', objectId: 'car', operation: 'enable' }],
        },
    ],
});
if (new URLSearchParams(location.search).has('multiple')) {
    scene.objects.push({
        ...structuredClone(scene.objects[0]),
        id: 'other',
        name: 'Xe thứ hai',
        transform: { position: [-0.1, 0, 0.25], rotation: [0, 0, 0], scale: [1, 1, 1] },
        controls: {
            enabled: true,
            speed: 0.15,
            bounds: 'free',
            autoRotate: false,
            forwardAxis: '+z',
            idleClip: 'Idle',
            moveClip: 'Run',
        },
    });
}
function Harness() {
    const host = useRef<HTMLDivElement>(null);
    const [model, setModel] = useState(
        scene.objects[0] as Extract<(typeof scene.objects)[number], { type: 'model' }>,
    );
    useEffect(() => {
        if (!host.current) return;
        const stage = new LocalPreviewStage(host.current);
        const abort = new AbortController();
        let cleanup = () => {};
        void buildScene(
            {
                pageId: assetId,
                title: 'Điều khiển',
                aspect: 1.4,
                imageUrl: '',
                thumbnailUrl: '',
                marker: { mode: 'NONE' },
                settings: PageSettingsSchema.parse({}),
                scene,
            },
            {
                [assetId]: {
                    id: assetId,
                    type: 'MODEL',
                    url: `${location.origin}/tests/browser/model-controls.gltf`,
                    meta: {},
                },
            },
            abort.signal,
            { notice: console.error, link: () => {}, log: () => {} },
            { background: false },
        ).then((runtime) => {
            if (abort.signal.aborted) {
                runtime.dispose();
                return;
            }
            cleanup = () => runtime.dispose();
            stage.setRuntime(runtime);
            stage.start();
            Object.assign(window, {
                __model: {
                    runtime,
                    stage,
                    position: () => runtime.nodes.get('car')?.root.position.toArray(),
                    question: () =>
                        askWorkflowQuestion(
                            {
                                questionId: 'q',
                                title: 'Tạm dừng điều khiển?',
                                choices: [
                                    { id: 'yes', text: 'Đồng ý' },
                                    { id: 'no', text: 'Không' },
                                ],
                                correctChoiceId: 'yes',
                            },
                            abort.signal,
                        ),
                },
            });
        });
        return () => {
            abort.abort();
            stage.dispose();
            cleanup();
        };
    }, []);
    return (
        <ThemeProvider>
            <main className="flex h-dvh overflow-hidden bg-surface text-foreground">
                <aside className="w-72 shrink-0 overflow-y-auto border-border border-r p-5 max-sm:hidden">
                    <h1 className="mb-5 font-semibold text-base">Điều khiển</h1>
                    <SceneUnitsProvider widthMm={210}>
                        <ModelControlProperties
                            object={model}
                            clips={['Idle', 'Run']}
                            id="test-model"
                            disabled={false}
                            onChange={(controls) => {
                                setModel({ ...model, controls });
                                Object.assign(window, { __modelConfig: controls });
                            }}
                        />
                    </SceneUnitsProvider>
                </aside>
                <div ref={host} className="relative min-w-0 flex-1 overflow-hidden" />
            </main>
        </ThemeProvider>
    );
}
createRoot(document.getElementById('root') as HTMLElement).render(<Harness />);
