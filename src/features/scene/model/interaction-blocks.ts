import type { AssetRef } from '@/shared/contracts/asset.schema';
import type { BookDetail } from '@/shared/contracts/dto.schema';
import type { Action, Scene, Trigger } from '@/shared/contracts/scene.schema';
import {
    actionPalette,
    type PaletteId,
    paletteAction,
    paletteUnavailable,
} from './interaction-palette';
import { triggerLabels } from './interactions';

export type BlockGroup = 'trigger' | 'condition' | 'action' | 'state' | 'navigation';
export const blockGroups = [
    {
        id: 'trigger',
        label: 'Sự kiện',
        description: 'Vào trang, chạm, nhận diện AR, trả lời…',
        initial: null,
    },
    {
        id: 'condition',
        label: 'Điều kiện',
        description: 'Điểm số, đáp án, số lần chạm, hiển thị…',
        initial: 'condition',
    },
    {
        id: 'action',
        label: 'Hành động',
        description: 'Hiển thị, âm thanh, chuyển động, câu hỏi…',
        initial: 'wait',
    },
    {
        id: 'state',
        label: 'Ghi nhớ',
        description: 'Gán giá trị, cộng điểm hoặc đảo trạng thái.',
        initial: 'setState',
    },
    {
        id: 'navigation',
        label: 'Điều hướng',
        description: 'Chuyển trang, mở liên kết hoặc kết thúc.',
        initial: 'openUrl',
    },
] as const;
export function blockGroup(action?: Action): BlockGroup {
    if (!action) return 'trigger';
    if (action.type === 'condition') return 'condition';
    if (action.type === 'setState') return 'state';
    if (action.type === 'navigate' || action.type === 'openUrl') return 'navigation';
    return 'action';
}
export function blockLabel(action?: Action) {
    return blockGroups.find((group) => group.id === blockGroup(action))?.label || 'Hành động';
}
export function actionVariant(action: Action): string {
    if (action.type === 'condition') return action.test.type;
    if (action.type === 'setState') return action.operation;
    if (action.type === 'navigate') return action.navigation.target;
    if (action.type === 'setVisible' || action.type === 'toggleVisible') return 'visibility';
    if (action.type === 'playAudio' || action.type === 'stopAudio') return 'audio';
    if (action.type === 'transformTo') return 'transform';
    return action.type;
}
export function blockChoices(
    action: Action | undefined,
    trigger: Trigger,
    scene: Scene,
    assets: Record<string, AssetRef>,
) {
    const group = blockGroup(action);
    if (!action)
        return {
            value: trigger.type,
            options: Object.entries(triggerLabels).map(([value, label]) => ({
                value,
                label,
                disabled: false,
            })),
        };
    if (group === 'condition')
        return {
            value: actionVariant(action),
            options: [
                { value: 'variable', label: 'Điểm số / thông tin ghi nhớ', disabled: false },
                { value: 'answer', label: 'Kết quả câu hỏi', disabled: false },
                { value: 'interactionCount', label: 'Số lần chạm', disabled: false },
                { value: 'visible', label: 'Đối tượng đang hiện / ẩn', disabled: false },
            ],
        };
    if (group === 'state')
        return {
            value: actionVariant(action),
            options: [
                { value: 'set', label: 'Gán giá trị / đánh dấu', disabled: false },
                { value: 'increment', label: 'Cộng / trừ điểm', disabled: false },
                { value: 'toggle', label: 'Đảo Đúng / Sai', disabled: false },
            ],
        };
    if (group === 'navigation')
        return {
            value: actionVariant(action),
            options: [
                { value: 'openUrl', label: 'Mở liên kết', disabled: false },
                { value: 'next', label: 'Trang tiếp theo', disabled: false },
                { value: 'previous', label: 'Trang trước', disabled: false },
                { value: 'page', label: 'Một trang cụ thể', disabled: false },
                { value: 'end', label: 'Kết thúc trải nghiệm', disabled: false },
            ],
        };
    const families = [
        { value: 'wait', label: 'Chờ', initial: 'wait' },
        { value: 'visibility', label: 'Hiển thị đối tượng', initial: 'show' },
        { value: 'audio', label: 'Âm thanh', initial: 'playAudio' },
        { value: 'transform', label: 'Chuyển động', initial: 'move' },
        { value: 'playVideo', label: 'Phát video', initial: 'playVideo' },
        { value: 'controlModel', label: 'Điều khiển mô hình', initial: 'controlModel' },
        { value: 'playAnimation', label: 'Chạy hoạt cảnh 3D', initial: 'playAnimation' },
        { value: 'askQuestion', label: 'Hiển thị câu hỏi', initial: 'askQuestion' },
    ] as const;
    return {
        value: actionVariant(action),
        options: families.map((item) => ({
            value: item.value,
            label: item.label,
            disabled: !!paletteUnavailable(item.initial, scene.objects, assets),
        })),
    };
}
/** Operations share one node family; only runtime-compatible fields are carried across. */
export function actionOperationChoices(action?: Action) {
    if (action?.type === 'controlModel')
        return {
            value: action.operation,
            options: [
                { value: 'enable', label: 'Bật điều khiển' },
                { value: 'disable', label: 'Tắt điều khiển' },
                { value: 'reset', label: 'Đặt lại vị trí' },
            ],
        };
    if (action?.type === 'setVisible' || action?.type === 'toggleVisible')
        return {
            value:
                action.type === 'toggleVisible' ? 'toggleVisible' : action.value ? 'show' : 'hide',
            options: [
                { value: 'show', label: 'Hiện' },
                { value: 'hide', label: 'Ẩn' },
                { value: 'toggleVisible', label: 'Đổi ẩn / hiện' },
            ],
        };
    if (action?.type === 'playAudio' || action?.type === 'stopAudio')
        return {
            value: action.type,
            options: [
                { value: 'playAudio', label: 'Phát' },
                { value: 'stopAudio', label: 'Dừng' },
            ],
        };
    return null;
}
export function changeActionOperation(action: Action, value: string): Action {
    const choices = actionOperationChoices(action);
    if (!choices?.options.some((option) => option.value === value))
        throw new Error('Chọn thao tác phù hợp với chức năng của khối.');
    if (choices.value === value) return action;
    if (action.type === 'controlModel')
        return { ...action, operation: value as 'enable' | 'disable' | 'reset' };
    if (action.type === 'setVisible' || action.type === 'toggleVisible') {
        const common = {
            objectId: action.objectId,
            durationMs: action.durationMs,
            delayMsSchema: action.delayMsSchema,
        };
        return value === 'toggleVisible'
            ? { type: 'toggleVisible', ...common }
            : { type: 'setVisible', ...common, value: value === 'show' };
    }
    if (action.type === 'playAudio' || action.type === 'stopAudio')
        return value === 'stopAudio'
            ? {
                  type: 'stopAudio',
                  assetId: action.assetId || undefined,
                  delayMsSchema: action.delayMsSchema,
              }
            : {
                  type: 'playAudio',
                  assetId: action.assetId || '',
                  loop: false,
                  volume: 1,
                  delayMsSchema: action.delayMsSchema,
              };
    return action;
}

/** Grouping is a presentation choice; saved actions retain their existing schema and ids. */
export function changeBlockAction(
    action: Action,
    value: string,
    scene: Scene,
    assets: Record<string, AssetRef>,
    pages: BookDetail['pages'],
): Action {
    if (value.startsWith('operation:'))
        return changeActionOperation(action, value.slice('operation:'.length));
    if (actionVariant(action) === value) return action;
    if (actionOperationChoices(action)?.options.some((option) => option.value === value))
        return changeActionOperation(action, value);
    value =
        ({ visibility: 'show', audio: 'playAudio', transform: 'move' } as Record<string, string>)[
            value
        ] || value;
    const questionId =
        scene.interactions
            .flatMap((rule) => rule.actions)
            .find((item) => item.type === 'askQuestion')?.question.questionId || '';
    if (action.type === 'condition') {
        const test =
            value === 'answer'
                ? { type: 'answer' as const, questionId, result: 'correct' as const }
                : value === 'interactionCount'
                  ? {
                        type: 'interactionCount' as const,
                        objectId: scene.objects.find((object) => object.type !== 'audio')?.id || '',
                        min: 1,
                    }
                  : value === 'visible'
                    ? {
                          type: 'visible' as const,
                          objectId: scene.objects[0]?.id || '',
                          value: true,
                      }
                    : {
                          type: 'variable' as const,
                          key: 'score',
                          operator: 'gte' as const,
                          value: 1,
                      };
        return { ...action, test };
    }
    if (action.type === 'setState') {
        if (!['set', 'increment', 'toggle'].includes(value))
            throw new Error('Chọn cách ghi nhớ hợp lệ.');
        return {
            ...action,
            operation: value as typeof action.operation,
            value:
                value === 'increment'
                    ? typeof action.value === 'number'
                        ? action.value
                        : 1
                    : value === 'toggle'
                      ? true
                      : action.value,
        };
    }
    if (action.type === 'navigate' || action.type === 'openUrl') {
        if (value === 'openUrl')
            return { type: 'openUrl', url: '', delayMsSchema: action.delayMsSchema };
        if (!['next', 'previous', 'page', 'end'].includes(value))
            throw new Error('Chọn đích điều hướng hợp lệ.');
        return {
            type: 'navigate',
            delayMsSchema: action.delayMsSchema,
            navigation: {
                ...(action.type === 'navigate' ? action.navigation : {}),
                target: value as 'next' | 'previous' | 'page' | 'end',
                pageId: value === 'page' ? pages[0]?.id : undefined,
            },
        };
    }
    const choice = actionPalette.find(
        (item) => item.id === value && item.group === 'Hành động — Action',
    );
    if (!choice) throw new Error('Chọn một chức năng trong nhóm Hành động.');
    const reason = paletteUnavailable(choice.id, scene.objects, assets);
    if (reason) throw new Error(reason);
    const target =
        'objectId' in action
            ? scene.objects.find((object) => object.id === action.objectId)
            : 'assetId' in action
              ? scene.objects.find(
                    (object) => object.type === 'audio' && object.assetId === action.assetId,
                )
              : undefined;
    const next = paletteAction(value as PaletteId, target, scene.objects, assets);
    if ('delayMsSchema' in next && 'delayMsSchema' in action)
        next.delayMsSchema = action.delayMsSchema;
    return next;
}
