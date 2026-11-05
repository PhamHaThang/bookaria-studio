import type { Action, Scene, WorkflowVariable } from '@/shared/contracts/scene.schema';
export type MemoryValue = boolean | number | string;
export const memoryTypeNames = {
    number: 'Điểm / số lượng',
    boolean: 'Trạng thái Đúng / Sai',
    string: 'Nội dung chữ',
};
export const memoryBuiltins: WorkflowVariable[] = [
    { key: 'score', name: 'Điểm số', type: 'number', initialValue: 0 },
    { key: 'completed', name: 'Hoàn thành nhiệm vụ', type: 'boolean', initialValue: false },
    { key: 'reward', name: 'Nhận phần thưởng', type: 'boolean', initialValue: false },
    { key: 'seen', name: 'Xem nội dung', type: 'boolean', initialValue: false },
];
export function memoryKey(action: Action): string | undefined {
    return action.type === 'setState'
        ? action.key
        : action.type === 'condition' && action.test.type === 'variable'
          ? action.test.key
          : undefined;
}
export function memoryDefinitions(
    declared: WorkflowVariable[],
    scenes: Pick<Scene, 'interactions'>[],
): WorkflowVariable[] {
    const found = new Map(declared.map((item) => [item.key, item]));
    for (const scene of scenes)
        for (const action of scene.interactions.flatMap((rule) => rule.actions)) {
            const key = memoryKey(action);
            if (!key || found.has(key)) continue;
            const value =
                action.type === 'setState'
                    ? action.operation === 'toggle'
                        ? false
                        : action.value
                    : action.type === 'condition' && action.test.type === 'variable'
                      ? action.test.value
                      : false;
            const builtin = memoryBuiltins.find((item) => item.key === key);
            const name = builtin?.name || key.replace(/[_:.-]+/g, ' ');
            const definition =
                typeof value === 'number'
                    ? { key, name, type: 'number' as const, initialValue: 0 }
                    : typeof value === 'boolean'
                      ? { key, name, type: 'boolean' as const, initialValue: false }
                      : { key, name, type: 'string' as const, initialValue: '' };
            found.set(key, definition);
        }
    return [...found.values()];
}
export function memoryName(key: string, definitions: WorkflowVariable[]) {
    return (
        definitions.find((item) => item.key === key)?.name ||
        memoryBuiltins.find((item) => item.key === key)?.name ||
        key.replace(/[_:.-]+/g, ' ')
    );
}
export function memoryValue(value: MemoryValue) {
    return typeof value === 'boolean'
        ? value
            ? 'Đúng'
            : 'Sai'
        : typeof value === 'string'
          ? value || '(trống)'
          : String(value);
}
export function memoryUses(
    key: string,
    pages: { id: string; title: string | null; scene: Scene }[],
) {
    return pages.flatMap((page) =>
        page.scene.interactions.flatMap((rule) =>
            rule.actions.flatMap((action, index) =>
                memoryKey(action) === key
                    ? [
                          {
                              pageId: page.id,
                              pageName: page.title || 'Trang sách',
                              ruleId: rule.id,
                              ruleName: rule.name || 'Luồng chưa đặt tên',
                              index,
                          },
                      ]
                    : [],
            ),
        ),
    );
}
export function memoryOperations(definition?: WorkflowVariable) {
    return definition?.type === 'boolean'
        ? [
              { value: 'set', label: 'Đặt Đúng / Sai' },
              { value: 'toggle', label: 'Đảo Đúng / Sai' },
          ]
        : definition?.type === 'string'
          ? [{ value: 'set', label: 'Ghi nội dung' }]
          : [
                { value: 'increment', label: 'Tăng / giảm' },
                { value: 'set', label: 'Đặt thành một số' },
            ];
}
export function selectMemory(
    action: Extract<Action, { type: 'setState' }>,
    definition: WorkflowVariable,
): Extract<Action, { type: 'setState' }> {
    const same = typeof action.value === definition.type;
    return {
        ...action,
        key: definition.key,
        operation:
            definition.type === 'number'
                ? same && action.operation === 'set'
                    ? 'set'
                    : 'increment'
                : 'set',
        value: same
            ? action.value
            : definition.type === 'number'
              ? 1
              : definition.type === 'boolean'
                ? true
                : '',
    };
}
export function memorySummary(action: Action, definitions: WorkflowVariable[]) {
    if (action.type === 'setState') {
        const name = memoryName(action.key, definitions);
        if (action.operation === 'increment')
            return `${Number(action.value) < 0 ? 'Giảm' : 'Tăng'} “${name}” ${Math.abs(Number(action.value))}`;
        if (action.operation === 'toggle') return `Đổi “${name}” giữa Đúng và Sai`;
        return typeof action.value === 'boolean'
            ? `Đặt “${name}”: ${memoryValue(action.value)}`
            : `Đặt “${name}” thành ${memoryValue(action.value)}`;
    }
    if (action.type === 'condition' && action.test.type === 'variable') {
        const test = action.test,
            name = memoryName(test.key, definitions);
        if (typeof test.value === 'boolean')
            return `“${name}” ${test.operator === 'ne' ? 'khác ' : ''}${memoryValue(test.value)}?`;
        const operator = {
            eq: 'bằng',
            ne: 'khác',
            gte: 'ít nhất',
            gt: 'lớn hơn',
            lte: 'không quá',
            lt: 'nhỏ hơn',
        }[test.operator];
        return `“${name}” ${operator} ${memoryValue(test.value)}?`;
    }
    return undefined;
}
