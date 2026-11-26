import type { AssetRef } from '@/shared/contracts/asset.schema';
import {
    type Action,
    ActionSchema,
    findSceneReferenceIssues,
    type InteractionRule,
    InteractionRuleSchema,
    SCENE_LIMITS,
    type Scene,
    type SceneObject,
} from '@/shared/contracts/scene.schema';
import type { InteractionScope } from './interaction-scope';
import { newAction, targetObjects } from './interactions';
import { objectLabels } from './objects';

export const interactionTemplates = [
    {
        id: 'quiz',
        title: 'Câu hỏi Đúng / Sai',
        description: 'Hỏi người đọc, cộng điểm khi đúng và ghi nhận câu trả lời.',
        group: 'Nhiệm vụ và đố vui',
        icon: 'custom',
    },
    {
        id: 'once',
        title: 'Khám phá một lần',
        description: 'Hiện nội dung lần đầu và ghi nhớ đã khám phá.',
        group: 'Nhiệm vụ và đố vui',
        icon: 'custom',
    },
    {
        id: 'unlock',
        title: 'Mở khóa theo điểm',
        description: 'Tự hiện nội dung khi điểm đạt mức đã chọn.',
        group: 'Nhiệm vụ và đố vui',
        icon: 'custom',
    },
    {
        id: 'count',
        title: 'Khám phá đủ số lần',
        description: 'Hiện phần thưởng sau ba lần chạm.',
        group: 'Nhiệm vụ và đố vui',
        icon: 'custom',
    },
    {
        id: 'finish',
        title: 'Hoàn thành trải nghiệm',
        description: 'Đánh dấu hoàn thành và hiện lời kết.',
        group: 'Điều hướng',
        icon: 'page',
    },
    {
        id: 'listen',
        title: 'Chạm để nghe',
        description: 'Đọc tên, phát tiếng động hoặc lời thuyết minh.',
        group: 'Nội dung',
        icon: 'audio',
    },
    {
        id: 'reveal',
        title: 'Chạm để hiện thông tin',
        description: 'Mở câu trả lời, hình ảnh hay thẻ giải thích đang ẩn.',
        group: 'Nội dung',
        icon: 'reveal',
    },
    {
        id: 'reveal-audio',
        title: 'Hiện thông tin và đọc',
        description: 'Hiện nội dung rồi phát lời giải thích tương ứng.',
        group: 'Nội dung',
        icon: 'reveal',
    },
    {
        id: 'toggle',
        title: 'Chạm để hiện / ẩn',
        description: 'Mỗi lần chạm sẽ mở hoặc đóng một nội dung.',
        group: 'Nội dung',
        icon: 'reveal',
    },
    {
        id: 'video',
        title: 'Chạm để phát video',
        description: 'Dùng một hình ảnh hoặc vùng chạm làm nút phát.',
        group: 'Nội dung',
        icon: 'video',
    },
    {
        id: 'link',
        title: 'Mở tài liệu liên quan',
        description: 'Chạm để mở một website hoặc tài liệu trực tuyến.',
        group: 'Nội dung',
        icon: 'link',
    },
    {
        id: 'focus',
        title: 'Phóng to để quan sát',
        description: 'Phóng to nhẹ, dừng một chút rồi trở về kích thước cũ.',
        group: 'Chuyển động',
        icon: 'scale',
    },
    {
        id: 'move',
        title: 'Di chuyển đối tượng',
        description: 'Đưa đối tượng sang một vị trí mới một cách mượt mà.',
        group: 'Chuyển động',
        icon: 'move',
    },
    {
        id: 'animation',
        title: 'Chạm để chạy hoạt cảnh',
        description: 'Phát một hoạt cảnh có sẵn trong mô hình 3D.',
        group: 'Chuyển động',
        icon: 'animation',
    },
    {
        id: 'intro',
        title: 'Mở trang để giới thiệu',
        description: 'Phát lời thuyết minh khi người đọc mở trang.',
        group: 'Tự động',
        icon: 'audio',
    },
    {
        id: 'enter',
        title: 'Nội dung xuất hiện khi vào trang',
        description: 'Tự hiện nội dung khi người đọc mở trang này.',
        group: 'Tự động',
        icon: 'page',
    },
    {
        id: 'leave',
        title: 'Dừng âm thanh khi rời trang',
        description: 'Dừng âm thanh của trang khi người đọc chuyển đi.',
        group: 'Tự động',
        icon: 'audio',
    },
    {
        id: 'custom',
        title: 'Tự kết hợp hành động',
        description: 'Chọn thời điểm bắt đầu và ghép các bước theo ý bạn.',
        group: 'Tự tạo',
        icon: 'custom',
    },
] as const;
export type InteractionTemplateId = (typeof interactionTemplates)[number]['id'];
export function objectName(object?: SceneObject) {
    return object ? object.name || objectLabels[object.type] : 'Chưa chọn đối tượng';
}

export function templateUnavailable(
    id: InteractionTemplateId,
    objects: SceneObject[],
    scope: InteractionScope,
) {
    if (scope.type === 'page' && !['intro', 'enter', 'leave', 'custom', 'unlock'].includes(id))
        return 'Chuyển phạm vi sang Tất cả để tạo tương tác khi chạm.';
    if (scope.type === 'object' && ['intro', 'enter', 'leave'].includes(id))
        return 'Mẫu này bắt đầu từ sự kiện của trang.';
    if (
        !['intro', 'enter', 'leave'].includes(id) &&
        !(id === 'custom' && scope.type === 'page') &&
        !targetObjects(objects, 'onTap').length
    )
        return 'Thêm hình ảnh, chữ, mô hình hoặc vùng chạm trước.';
    if (id === 'video' && !objects.some((o) => o.type === 'video'))
        return 'Thêm một video vào trang trước.';
    if (id === 'animation' && !objects.some((o) => o.type === 'model'))
        return 'Thêm một mô hình 3D có hoạt cảnh trước.';
    if (
        ['reveal', 'reveal-audio', 'toggle'].includes(id) &&
        objects.filter((o) => o.type !== 'audio').length < 2
    )
        return 'Cần một đối tượng để chạm và một nội dung để hiện / ẩn.';
    if (id === 'enter' && !objects.some((o) => o.type !== 'audio'))
        return 'Thêm nội dung vào trang trước.';
    return undefined;
}

export function templateRule(
    id: InteractionTemplateId,
    ruleId: string,
    scene: Scene,
    assets: Record<string, AssetRef>,
    scope: InteractionScope,
): InteractionRule {
    const tappable = targetObjects(scene.objects, 'onTap');
    const source =
        scope.type === 'object' ? tappable.find((o) => o.id === scope.objectId) : tappable[0];
    const other =
        tappable.find((o) => o.id !== source?.id && !o.visible) ||
        tappable.find((o) => o.id !== source?.id);
    const content = other || source;
    const model = source?.type === 'model' ? source : scene.objects.find((o) => o.type === 'model');
    const video = source?.type === 'video' ? source : scene.objects.find((o) => o.type === 'video');
    const audioId =
        scene.objects.find((o) => o.type === 'audio')?.assetId ||
        Object.entries(assets).find(([, a]) => a.type === 'AUDIO')?.[0] ||
        '';
    const show: Action = {
        type: 'setVisible',
        objectId: content?.id || '',
        value: true,
        durationMs: 300,
        delayMsSchema: 0,
    };
    const play: Action = {
        type: 'playAudio',
        assetId: audioId,
        volume: 1,
        loop: false,
        delayMsSchema: 0,
    };
    if (id === 'unlock')
        return {
            id: ruleId,
            name: 'Mở khóa theo điểm',
            enabled: true,
            onRetrigger: 'ignore',
            trigger: {
                type: 'onStateCondition',
                test: { type: 'variable', key: 'score', operator: 'gte', value: 3 },
            },
            actions: [
                { ...show, objectId: scope.type === 'object' ? source?.id || '' : show.objectId },
            ],
        };
    if (['quiz', 'once', 'count', 'finish'].includes(id)) {
        const noop: Action = { type: 'wait', ms: 0 };
        const remember = (key: string, value: boolean | number): Action => ({
            type: 'setState',
            key,
            operation: 'set',
            value,
            delayMsSchema: 0,
        });
        const key = `task_${ruleId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`;
        let steps: Action[],
            edges: { source: string; target: string; port: 'next' | 'true' | 'false' }[];
        const link = (
            source: string,
            target: string,
            port: 'next' | 'true' | 'false' = 'next',
        ) => ({ source, target, port });
        if (id === 'finish') {
            steps = [
                remember('completed', true),
                {
                    type: 'navigate',
                    navigation: { target: 'end', message: 'Bạn đã hoàn thành chuyến khám phá!' },
                    delayMsSchema: 0,
                },
            ];
            edges = [link('start', 'step-0'), link('step-0', 'step-1')];
        } else if (id === 'quiz') {
            const question = newAction('askQuestion') as Extract<Action, { type: 'askQuestion' }>;
            steps = [
                question,
                {
                    type: 'condition',
                    test: {
                        type: 'answer',
                        questionId: question.question.questionId,
                        result: 'correct',
                    },
                    delayMsSchema: 0,
                },
                {
                    type: 'condition',
                    test: { type: 'variable', key, operator: 'eq', value: false },
                    delayMsSchema: 0,
                },
                {
                    type: 'setState',
                    key: 'score',
                    operation: 'increment',
                    value: 1,
                    delayMsSchema: 0,
                },
                remember(key, true),
                noop,
            ];
            edges = [
                link('start', 'step-0'),
                link('step-0', 'step-1'),
                link('step-1', 'step-2', 'true'),
                link('step-1', 'step-5', 'false'),
                link('step-2', 'step-3', 'true'),
                link('step-2', 'step-5', 'false'),
                link('step-3', 'step-4'),
            ];
        } else {
            const test: Extract<Action, { type: 'condition' }>['test'] =
                id === 'once'
                    ? { type: 'variable', key, operator: 'eq', value: false }
                    : id === 'count'
                      ? { type: 'interactionCount', objectId: source?.id || '', min: 3 }
                      : { type: 'variable', key: 'score', operator: 'gte', value: 3 };
            steps = [
                { type: 'condition', test, delayMsSchema: 0 },
                show,
                noop,
                remember(key, true),
            ];
            edges = [
                link('start', 'step-0'),
                link('step-0', 'step-1', 'true'),
                link('step-0', 'step-2', 'false'),
                link('step-1', 'step-3'),
            ];
        }
        return {
            id: ruleId,
            name: interactionTemplates.find((template) => template.id === id)?.title,
            enabled: true,
            trigger: source ? { type: 'onTap', objectId: source.id } : { type: 'onPageEnter' },
            actions: steps,
            onRetrigger: 'ignore',
            workflow: { version: 1, edges },
            editorLayout: [
                { id: 'start', x: 40, y: 80 },
                ...steps.map((_, index) => ({
                    id: `step-${index}`,
                    x: 350 + Math.min(index, 3) * 310,
                    y: index === 3 && id !== 'finish' ? 300 : 80,
                })),
            ],
        };
    }
    let actions: Action[];
    switch (id) {
        case 'intro':
        case 'listen':
            actions = [play];
            break;
        case 'reveal':
        case 'enter':
            actions = [show];
            break;
        case 'reveal-audio':
            actions = [show, play];
            break;
        case 'toggle':
            actions = [
                {
                    type: 'toggleVisible',
                    objectId: content?.id || '',
                    durationMs: 200,
                    delayMsSchema: 0,
                },
            ];
            break;
        case 'video':
            actions = [{ type: 'playVideo', objectId: video?.id || '', delayMsSchema: 0 }];
            break;
        case 'animation':
            actions = [
                {
                    type: 'playAnimation',
                    objectId: model?.id || '',
                    clip:
                        model?.type === 'model'
                            ? assets[model.assetId]?.meta.animations?.[0] || ''
                            : '',
                    loop: false,
                    delayMsSchema: 0,
                },
            ];
            break;
        case 'link':
            actions = [newAction('openUrl')];
            break;
        case 'leave':
            actions = [newAction('stopAudio')];
            break;
        case 'focus': {
            const scale = source?.transform.scale || [1, 1, 1];
            actions = [
                {
                    type: 'transformTo',
                    objectId: source?.id || '',
                    scale: scale.map((v) => v * 1.25) as [number, number, number],
                    durationMs: 400,
                    easing: 'easeInOut',
                    delayMsSchema: 0,
                },
                { type: 'wait', ms: 1200 },
                {
                    type: 'transformTo',
                    objectId: source?.id || '',
                    scale: [...scale] as [number, number, number],
                    durationMs: 400,
                    easing: 'easeInOut',
                    delayMsSchema: 0,
                },
            ];
            break;
        }
        case 'move':
            actions = [
                {
                    type: 'transformTo',
                    objectId: source?.id || '',
                    position: [
                        (source?.transform.position[0] || 0) + 0.2,
                        source?.transform.position[1] || 0,
                        source?.transform.position[2] || 0,
                    ],
                    durationMs: 700,
                    easing: 'easeInOut',
                    delayMsSchema: 0,
                },
            ];
            break;
        default:
            actions = [newAction('wait')];
    }
    return {
        id: ruleId,
        name: interactionTemplates.find((t) => t.id === id)?.title,
        enabled: true,
        trigger:
            id === 'enter' ||
            id === 'intro' ||
            (id === 'custom' && (scope.type === 'page' || !source))
                ? { type: 'onPageEnter' }
                : id === 'leave'
                  ? { type: 'onPageLeave' }
                  : { type: 'onTap', objectId: source?.id || '' },
        actions,
        onRetrigger: 'ignore',
    };
}

/** Human-readable validation; a partial composer never enters the saved scene. */
export function interactionProblems(rule: InteractionRule, scene: Scene): string[] {
    const problems: string[] = [];
    if (
        rule.trigger.type === 'onTap' &&
        !targetObjects(scene.objects, 'onTap').some(
            (o) => o.id === (rule.trigger as { objectId: string }).objectId,
        )
    )
        problems.push('Chọn đối tượng mà người đọc sẽ chạm vào.');
    rule.actions.forEach((a, i) => {
        const step = `Bước ${i + 1}: `;
        const checked = ActionSchema.safeParse(a);
        if (
            !checked.success &&
            ['condition', 'waitUntil', 'setState', 'askQuestion', 'navigate'].includes(a.type)
        ) {
            const key = checked.error.issues[0]?.path.join('.') || '';
            problems.push(
                a.type === 'askQuestion'
                    ? `${step}Nhập câu hỏi, các đáp án và chọn đáp án đúng.`
                    : a.type === 'condition' || a.type === 'waitUntil'
                      ? `${step}Kiểm tra ${key.includes('key') ? 'mã ghi nhớ' : 'đối tượng và giá trị điều kiện'}.`
                      : a.type === 'setState'
                        ? `${step}Kiểm tra mã và giá trị ghi nhớ.`
                        : a.type === 'navigate'
                          ? `${step}Chọn trang đích.`
                          : `${step}Kiểm tra thông số hành động.`,
            );
        }
        if (
            'objectId' in a &&
            !targetObjects(scene.objects, a.type).some((o) => o.id === a.objectId)
        )
            problems.push(`${step}Chọn đối tượng phù hợp.`);
        if (a.type === 'playAudio' && !a.assetId) problems.push(`${step}Chọn âm thanh cần phát.`);
        if (a.type === 'stopAudio' && a.assetId === '')
            problems.push(`${step}Chọn âm thanh cần dừng hoặc chọn Toàn bộ âm thanh của trang.`);
        if (a.type === 'playAnimation' && !a.clip.trim())
            problems.push(`${step}Chọn hoạt cảnh của mô hình.`);
        if (a.type === 'openUrl' && !/^https?:\/\/\S+$/i.test(a.url))
            problems.push(`${step}Nhập liên kết bắt đầu bằng https:// hoặc http://.`);
    });
    if (!problems.length && !InteractionRuleSchema.safeParse(rule).success)
        problems.push(
            'Kiểm tra các thông số. Thời gian và âm lượng phải nằm trong khoảng cho phép.',
        );
    if (!problems.length)
        problems.push(
            ...findSceneReferenceIssues({
                ...scene,
                interactions: [...scene.interactions.filter((item) => item.id !== rule.id), rule],
            })
                .filter((issue) => issue.interactionId === rule.id)
                .map((p) => p.message),
        );
    return [...new Set(problems)];
}

export function actionSummary(action: Action, objects: SceneObject[]): string {
    const target =
        'objectId' in action ? objectName(objects.find((o) => o.id === action.objectId)) : '';
    switch (action.type) {
        case 'controlModel':
            return `${action.operation === 'enable' ? 'Cho phép điều khiển' : action.operation === 'disable' ? 'Dừng điều khiển' : 'Đưa về vị trí đầu'} “${target}”`;
        case 'waitUntil':
            return `Chờ đến khi: ${actionSummary({ ...action, type: 'condition' }, objects)}`;
        case 'condition': {
            const test = action.test;
            if (test.type === 'variable')
                return `${test.key} ${test.operator === 'eq' ? 'bằng' : test.operator === 'ne' ? 'khác' : test.operator === 'gte' ? 'ít nhất' : test.operator === 'gt' ? 'lớn hơn' : test.operator === 'lte' ? 'tối đa' : 'nhỏ hơn'} ${String(test.value)}`;
            if (test.type === 'answer')
                return test.result === 'correct'
                    ? 'Người đọc trả lời đúng?'
                    : 'Người đọc trả lời sai?';
            if (test.type === 'interactionCount') return `Đã chạm ít nhất ${test.min} lần?`;
            return test.value ? 'Đối tượng đang hiển thị?' : 'Đối tượng đang ẩn?';
        }
        case 'setState':
            return `${action.key}: ${action.operation === 'increment' ? 'thay đổi ' : action.operation === 'toggle' ? 'đảo Đúng / Sai' : 'ghi nhớ '}${action.operation === 'toggle' ? '' : String(action.value)}`;
        case 'askQuestion':
            return action.question.title || 'Nhập câu hỏi và đáp án';
        case 'navigate':
            return action.navigation.target === 'end'
                ? 'Kết thúc trải nghiệm'
                : action.navigation.target === 'next'
                  ? 'Trang tiếp theo'
                  : action.navigation.target === 'previous'
                    ? 'Trang trước'
                    : 'Chuyển đến trang đã chọn';
        case 'playAudio':
            return objects.some((o) => o.type === 'audio' && o.assetId === action.assetId)
                ? `Phát “${objectName(objects.find((o) => o.type === 'audio' && o.assetId === action.assetId))}”`
                : 'Phát âm thanh đã chọn';
        case 'stopAudio': {
            if (action.assetId === '') return 'Chọn âm thanh cần dừng';
            if (!action.assetId) return 'Dừng tất cả âm thanh';
            const audio = objects.find((o) => o.type === 'audio' && o.assetId === action.assetId);
            return audio ? `Dừng “${objectName(audio)}”` : 'Dừng âm thanh đã chọn';
        }
        case 'playVideo':
            return `Phát video “${target}”`;
        case 'playAnimation':
            return `Chạy ${action.clip || 'hoạt cảnh'} của “${target}”`;
        case 'setVisible':
            return `${action.value ? 'Hiện' : 'Ẩn'} “${target}”`;
        case 'toggleVisible':
            return `Đổi hiện / ẩn “${target}”`;
        case 'openUrl':
            return action.url ? `Mở ${action.url}` : 'Mở liên kết';
        case 'wait':
            return `Đợi ${Number((action.ms / 1000).toFixed(3))} giây`;
        case 'transformTo':
            return `${[action.position && 'Di chuyển', action.rotation && 'xoay', action.scale && 'đổi kích thước'].filter(Boolean).join(' + ')} “${target}” trong ${action.durationMs / 1000} giây`;
    }
}

export function applyInteraction(
    scene: Scene,
    rule: InteractionRule,
    hideTargetId?: string,
): Scene {
    const problems = interactionProblems(rule, scene);
    if (problems.length) throw new Error(problems[0]);
    if (
        !scene.interactions.some((r) => r.id === rule.id) &&
        scene.interactions.length >= SCENE_LIMITS.maxRules
    )
        throw new Error('Trang đã đạt giới hạn 50 tương tác.');
    if (rule.trigger.type === 'onTap' && hideTargetId === rule.trigger.objectId)
        throw new Error(
            'Đối tượng được chạm cần hiện để người đọc sử dụng. Hãy chọn nội dung khác để ẩn.',
        );
    return {
        ...scene,
        objects: scene.objects.map((o) => (o.id === hideTargetId ? { ...o, visible: false } : o)),
        interactions: scene.interactions.some((r) => r.id === rule.id)
            ? scene.interactions.map((r) =>
                  r.id === rule.id ? InteractionRuleSchema.parse(rule) : r,
              )
            : [...scene.interactions, InteractionRuleSchema.parse(rule)],
    };
}

/** Keep the zoom and return steps paired when a reader-facing template changes target. */
export function updateTemplateActions(
    template: InteractionTemplateId | null,
    before: Action[],
    after: Action[],
    objects: SceneObject[],
): Action[] {
    if (template !== 'focus' || before.length !== 3 || after.length !== 3) return after;
    const first = after[0],
        previous = before[0],
        last = after[2];
    if (
        first.type !== 'transformTo' ||
        previous.type !== 'transformTo' ||
        last.type !== 'transformTo' ||
        first.objectId === previous.objectId
    )
        return after;
    const target = objects.find((o) => o.id === first.objectId);
    if (!target) return after;
    return [
        {
            ...first,
            scale: target.transform.scale.map((v) => v * 1.25) as [number, number, number],
        },
        after[1],
        { ...last, objectId: target.id, scale: [...target.transform.scale] },
    ];
}
