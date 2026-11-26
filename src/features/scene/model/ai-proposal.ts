import {
    applyAiObjectEdits,
    type InteractionAiPlan,
} from '../../../shared/contracts/api/interaction-ai.schema';
import type { AssetRef } from '../../../shared/contracts/asset.schema';
import type { Page } from '../../../shared/contracts/dto.schema';
import {
    findSceneReferenceIssues,
    type InteractionRule,
    InteractionRuleSchema,
    type Scene,
    type SceneObject,
    SceneSchema,
    type WorkflowVariable,
    WorkflowVariablesSchema,
} from '../../../shared/contracts/scene.schema';
import { arrangeFlow, flowToRule, restoreFlowLayout } from './interaction-flow';
import { refreshMovementLoop } from './movement-sequence';

export function proposalSnapshot(
    page: Pick<Page, 'id' | 'revision'>,
    scene: Scene,
    assets: Record<string, AssetRef>,
    bookContext?: {
        variables: WorkflowVariable[];
        pages: { id: string; title?: string | null }[];
        targetRuleId?: string;
        targetObjectId?: string;
    },
) {
    return JSON.stringify({
        pageId: page.id,
        revision: page.revision,
        scene,
        assets: Object.entries(assets).map(([id, { type, meta }]) => [id, type, meta]),
        bookContext: bookContext && {
            ...bookContext,
            pages: bookContext.pages.map(({ id, title }) => ({ id, title })),
        },
    });
}

export type AppliedAiPlan = {
    rules: { before?: InteractionRule; after: InteractionRule }[];
    variables: WorkflowVariable[];
    objects?: { before?: SceneObject; after: SceneObject }[];
    removedObjects?: { item: SceneObject; index: number }[];
    removedRules?: { item: InteractionRule; index: number }[];
};

function checkSceneChanges(before: Scene, after: Scene, changed: Set<string>) {
    const issues = new Set(findSceneReferenceIssues(before).map((item) => JSON.stringify(item)));
    const error = findSceneReferenceIssues(after).find(
        (item) => changed.has(item.interactionId) || !issues.has(JSON.stringify(item)),
    );
    if (error) throw new Error(error.message);
    if (!SceneSchema.safeParse(after).success)
        throw new Error('Thay đổi vượt giới hạn của trang hoặc có mã luồng bị trùng.');
}

export function stageAiPlan(scene: Scene, variables: WorkflowVariable[], plan: InteractionAiPlan) {
    const seen = new Set<string>();
    const objects = applyAiObjectEdits(
        scene.objects,
        plan.objectEdits ?? [],
        plan.objectAdds,
        plan.removeObjectIds,
    );
    const movedObjects = new Set(
        objects.flatMap((object) => {
            const before = scene.objects.find((previous) => previous.id === object.id);
            return before && JSON.stringify(before.transform) !== JSON.stringify(object.transform)
                ? [object.id]
                : [];
        }),
    );
    const removeRules = new Set(plan.removeRuleIds);
    if (
        removeRules.size !== (plan.removeRuleIds?.length ?? 0) ||
        [...removeRules].some((id) => !scene.interactions.some((item) => item.id === id))
    )
        throw new Error('Luồng cần xóa không tồn tại hoặc bị trùng.');
    const rules = plan.rules.map(({ replaceId, rule }) => {
        const id = replaceId ?? rule.id;
        if (seen.has(id) || removeRules.has(id)) throw new Error('Đề xuất thay đổi trùng luồng.');
        seen.add(id);
        const before = scene.interactions.find((item) => item.id === id);
        if (replaceId && !before) throw new Error('Luồng cần sửa đã bị xóa.');
        if (!replaceId && before) throw new Error('Đề xuất này đã được áp dụng.');
        const candidate = InteractionRuleSchema.parse({ ...rule, id });
        const graph = restoreFlowLayout(candidate);
        const updatedGraph =
            movedObjects.size > 0 ||
            JSON.stringify([before?.actions, before?.workflow]) !==
                JSON.stringify([candidate.actions, candidate.workflow])
                ? refreshMovementLoop(graph, objects)
                : graph;
        const after =
            before && candidate.editorLayout && candidate.workflow
                ? {
                      ...candidate,
                      ...(updatedGraph.movementLoop
                          ? { movementLoop: updatedGraph.movementLoop }
                          : {}),
                  }
                : flowToRule(arrangeFlow(updatedGraph), candidate);
        return { before, after };
    });
    for (const before of scene.interactions) {
        if (
            seen.has(before.id) ||
            removeRules.has(before.id) ||
            !before.movementLoop ||
            !before.actions.some(
                (action) => action.type === 'transformTo' && movedObjects.has(action.objectId),
            )
        )
            continue;
        const graph = restoreFlowLayout(before);
        const refreshed = refreshMovementLoop(graph, objects);
        if (refreshed === graph) continue;
        rules.push({ before, after: { ...before, movementLoop: refreshed.movementLoop } });
        seen.add(before.id);
    }
    const changes = new Map(rules.map((item) => [item.after.id, item.after]));
    const originalObjects = new Map(scene.objects.map((item) => [item.id, item]));
    const next = {
        ...scene,
        objects,
        interactions: [
            ...scene.interactions
                .filter((rule) => !removeRules.has(rule.id))
                .map((rule) => changes.get(rule.id) ?? rule),
            ...rules.filter((item) => !item.before).map((item) => item.after),
        ],
    };
    checkSceneChanges(scene, next, seen);
    return {
        scene: next,
        variables: WorkflowVariablesSchema.parse([...variables, ...plan.variables]),
        edit: {
            rules,
            variables: plan.variables,
            objects: objects.flatMap((after) => {
                const before = originalObjects.get(after.id);
                return before !== after ? [{ before, after }] : [];
            }),
            removedObjects: scene.objects.flatMap((item, index) =>
                plan.removeObjectIds?.includes(item.id) ? [{ item, index }] : [],
            ),
            removedRules: scene.interactions.flatMap((item, index) =>
                removeRules.has(item.id) ? [{ item, index }] : [],
            ),
        } satisfies AppliedAiPlan,
    };
}

export function aiPlanState(scene: Scene, variables: WorkflowVariable[], edit: AppliedAiPlan) {
    const states = [
        ...edit.rules.map(({ before, after }) => [
            scene.interactions.find(({ id }) => id === after.id),
            before,
            after,
        ]),
        ...(edit.objects ?? []).map(({ before, after }) => [
            scene.objects.find(({ id }) => id === after.id),
            before,
            after,
        ]),
        ...(edit.removedObjects ?? []).map(({ item }) => [
            scene.objects.find(({ id }) => id === item.id),
            item,
            undefined,
        ]),
        ...(edit.removedRules ?? []).map(({ item }) => [
            scene.interactions.find(({ id }) => id === item.id),
            item,
            undefined,
        ]),
        ...edit.variables.map((item) => [
            variables.find(({ key }) => key === item.key),
            undefined,
            item,
        ]),
    ];
    const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    if (states.every(([current, , after]) => equal(current, after))) return 'applied';
    if (states.every(([current, before]) => equal(current, before))) return 'undone';
    return 'changed';
}
