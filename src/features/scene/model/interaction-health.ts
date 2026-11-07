import {
    findSceneReferenceIssues,
    type InteractionRule,
    type Scene,
} from '@/shared/contracts/scene.schema';

export type InteractionProblem = {
    ruleId: string;
    ruleName: string;
    actionIndex: number | null;
    message: string;
};

export function interactionProblems(scene: Scene): InteractionProblem[] {
    return findSceneReferenceIssues(scene).map((issue) => ({
        ruleId: issue.interactionId,
        ruleName:
            scene.interactions.find((rule) => rule.id === issue.interactionId)?.name ||
            'Luồng chưa đặt tên',
        actionIndex: issue.actionIndex,
        message: issue.message,
    }));
}

function questionIds(rules: InteractionRule[]) {
    return new Set(
        rules.flatMap((rule) =>
            rule.actions.flatMap((action) =>
                action.type === 'askQuestion' ? [action.question.questionId] : [],
            ),
        ),
    );
}

/** Include dependent question flows, but leave pre-existing unrelated problems untouched. */
export function objectRemovalImpact(scene: Scene, objectIds: readonly string[]): InteractionRule[] {
    const removed = new Set(objectIds);
    const affected = new Set(
        scene.interactions
            .filter(
                (rule) =>
                    ('objectId' in rule.trigger && removed.has(rule.trigger.objectId)) ||
                    rule.actions.some(
                        (action) =>
                            ('objectId' in action && removed.has(action.objectId)) ||
                            (action.type === 'condition' &&
                                'objectId' in action.test &&
                                removed.has(action.test.objectId)),
                    ),
            )
            .map((rule) => rule.id),
    );
    const originalQuestions = questionIds(scene.interactions);
    for (;;) {
        const available = questionIds(scene.interactions.filter((rule) => !affected.has(rule.id)));
        const missing = (id: string) => originalQuestions.has(id) && !available.has(id);
        const additional = scene.interactions.filter(
            (rule) =>
                !affected.has(rule.id) &&
                ((rule.trigger.type === 'onAnswer' && missing(rule.trigger.questionId)) ||
                    rule.actions.some(
                        (action) =>
                            action.type === 'condition' &&
                            action.test.type === 'answer' &&
                            missing(action.test.questionId),
                    )),
        );
        if (!additional.length) break;
        for (const rule of additional) affected.add(rule.id);
    }
    return scene.interactions.filter((rule) => affected.has(rule.id));
}

/** Build an execution copy; the authored draft and publication validation stay intact. */
export function playableInteractions(scene: Scene) {
    const problems = interactionProblems(scene);
    const invalid = new Set(problems.map((problem) => problem.ruleId));
    let interactions = scene.interactions.filter((rule) => rule.enabled && !invalid.has(rule.id));
    for (;;) {
        const dependent = interactionProblems({ ...scene, interactions });
        if (!dependent.length) break;
        problems.push(...dependent);
        const rejected = new Set(dependent.map((problem) => problem.ruleId));
        interactions = interactions.filter((rule) => !rejected.has(rule.id));
    }
    return { scene: { ...scene, interactions }, problems };
}
