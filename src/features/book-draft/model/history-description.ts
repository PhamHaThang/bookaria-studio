import type { Page, PageSummary } from '@/shared/contracts/dto.schema';
import type { InteractionRule, Scene } from '@/shared/contracts/scene.schema';
import { objectLabels } from '../../scene/model/objects';
import { fingerprint, type WorkingBook } from './draft-model';

export type HistoryTarget = { pageId: string; ruleId: string };
export type HistoryChange = {
    label: string;
    scope: 'interaction' | 'object' | 'page' | 'book';
    undoMessage: string;
    redoMessage: string;
    undoTarget?: HistoryTarget;
    redoTarget?: HistoryTarget;
};
export type HistoryFeedback = {
    scope: HistoryChange['scope'];
    message: string;
    target?: HistoryTarget;
};
export function historyFeedback(change: HistoryChange, redo = false): HistoryFeedback {
    return {
        scope: change.scope,
        message: redo ? change.redoMessage : change.undoMessage,
        target: redo ? change.redoTarget : change.undoTarget,
    };
}
const different = (a: unknown, b: unknown) => fingerprint(a) !== fingerprint(b);
function basic(label: string, scope: HistoryChange['scope']): HistoryChange {
    return {
        label,
        scope,
        undoMessage: `Đã hoàn tác: ${label}.`,
        redoMessage: `Đã làm lại: ${label}.`,
    };
}
function ruleChange(
    before: InteractionRule[],
    after: InteractionRule[],
    pageId: string,
): HistoryChange {
    const old = new Map(before.map((rule) => [rule.id, rule]));
    const next = new Map(after.map((rule) => [rule.id, rule]));
    const changed = [...new Set([...old.keys(), ...next.keys()])].filter((id) =>
        different(old.get(id), next.get(id)),
    );
    if (changed.length !== 1) return basic('Cập nhật các luồng tương tác', 'interaction');
    const id = changed[0],
        a = old.get(id),
        b = next.get(id);
    const name = (rule: InteractionRule) => `“${rule.name?.trim() || 'Luồng chưa đặt tên'}”`;
    const undoTarget = a ? { pageId, ruleId: id } : undefined;
    const redoTarget = b ? { pageId, ruleId: id } : undefined;
    if (!a && b)
        return {
            label: `Thêm luồng ${name(b)}`,
            scope: 'interaction',
            undoMessage: `Đã bỏ luồng ${name(b)} vừa thêm.`,
            redoMessage: `Đã khôi phục luồng ${name(b)}.`,
            redoTarget,
        };
    if (a && !b)
        return {
            label: `Xóa luồng ${name(a)}`,
            scope: 'interaction',
            undoMessage: `Đã khôi phục luồng ${name(a)}.`,
            redoMessage: `Đã xóa luồng ${name(a)}.`,
            undoTarget,
        };
    if (!a || !b) return basic('Chỉnh sửa tương tác', 'interaction');
    const label =
        a.name !== b.name
            ? `Đổi tên luồng ${name(a)} thành ${name(b)}`
            : a.enabled !== b.enabled
              ? `${b.enabled ? 'Bật' : 'Tắt'} luồng ${name(b)}`
              : different(a.trigger, b.trigger)
                ? `Đổi sự kiện của luồng ${name(b)}`
                : different(a.actions, b.actions) || different(a.workflow, b.workflow)
                  ? `Chỉnh sửa luồng ${name(b)}`
                  : different(a.editorLayout, b.editorLayout)
                    ? `Di chuyển khối trong luồng ${name(b)}`
                    : `Chỉnh sửa luồng ${name(b)}`;
    return {
        label,
        scope: 'interaction',
        undoMessage: `Đã khôi phục luồng ${name(a)}.`,
        redoMessage: `Đã áp dụng lại thay đổi trong luồng ${name(b)}.`,
        undoTarget,
        redoTarget,
    };
}
export function describeSceneChange(before: Scene, after: Scene, pageId: string): HistoryChange {
    if (
        !different(before.objects, after.objects) &&
        different(before.interactions, after.interactions)
    )
        return ruleChange(before.interactions, after.interactions, pageId);
    const old = new Map(before.objects.map((object) => [object.id, object]));
    const next = new Map(after.objects.map((object) => [object.id, object]));
    const added = after.objects.filter((object) => !old.has(object.id));
    const removed = before.objects.filter((object) => !next.has(object.id));
    const objectName = (object: Scene['objects'][number]) =>
        `“${object.name?.trim() || objectLabels[object.type]}”`;
    if (added.length && !removed.length)
        return basic(
            added.length === 1
                ? `Thêm đối tượng ${objectName(added[0])}`
                : `Thêm ${added.length} đối tượng`,
            'object',
        );
    if (removed.length && !added.length)
        return basic(
            removed.length === 1
                ? `Xóa đối tượng ${objectName(removed[0])}`
                : `Xóa ${removed.length} đối tượng`,
            'object',
        );
    const changed = after.objects.filter((object) => different(old.get(object.id), object));
    const verb = (a: Scene['objects'][number], b: Scene['objects'][number]) => {
        const keys = Object.keys(b).filter((key) =>
            different(a[key as keyof typeof a], b[key as keyof typeof b]),
        );
        if (keys.length === 1 && keys[0] === 'transform') {
            const parts = ['position', 'rotation', 'scale'].filter((key) =>
                different(
                    a.transform[key as keyof typeof a.transform],
                    b.transform[key as keyof typeof b.transform],
                ),
            );
            if (parts.length === 1)
                return parts[0] === 'position'
                    ? 'Di chuyển'
                    : parts[0] === 'rotation'
                      ? 'Xoay'
                      : 'Đổi kích thước';
        }
        if (keys.length === 1 && keys[0] === 'visible') return b.visible ? 'Hiện' : 'Ẩn';
        if (keys.length === 1 && keys[0] === 'locked') return b.locked ? 'Khóa' : 'Mở khóa';
        return 'Chỉnh sửa';
    };
    const previousObject = changed.length === 1 ? old.get(changed[0].id) : undefined;
    if (previousObject)
        return basic(
            `${verb(previousObject, changed[0])} đối tượng ${objectName(changed[0])}`,
            'object',
        );
    if (changed.length > 1) return basic(`Chỉnh sửa ${changed.length} đối tượng`, 'object');
    if (
        different(
            before.objects.map((object) => object.id),
            after.objects.map((object) => object.id),
        )
    )
        return basic('Đổi thứ tự đối tượng', 'object');
    return basic('Chỉnh sửa nội dung trang', 'page');
}
/** Labels come from the actual before/after snapshots, including grouped drag gestures. */
export function describeDraftChange(
    before: WorkingBook,
    after: WorkingBook,
    loaded: Record<string, Page>,
    focus: string,
): HistoryChange {
    if (different(before.workflowVariables || [], after.workflowVariables || []))
        return basic('Cập nhật thông tin ghi nhớ của sách', 'book');
    const old = new Map(before.pages.map((page) => [page.id, page]));
    const next = new Map(after.pages.map((page) => [page.id, page]));
    const name = (page: PageSummary) => `“${page.title?.trim() || `Trang ${page.orderIndex + 1}`}”`;
    const added = after.pages.filter((page) => !old.has(page.id));
    const removed = before.pages.filter((page) => !next.has(page.id));
    if (added.length)
        return basic(
            added.length === 1 ? `Thêm trang ${name(added[0])}` : `Thêm ${added.length} trang`,
            'page',
        );
    if (removed.length)
        return basic(
            removed.length === 1 ? `Xóa trang ${name(removed[0])}` : `Xóa ${removed.length} trang`,
            'page',
        );
    if (
        different(
            before.pages.map((page) => page.id),
            after.pages.map((page) => page.id),
        )
    )
        return basic('Sắp xếp thứ tự trang', 'page');
    const ids = [focus, ...after.pages.map((page) => page.id).filter((id) => id !== focus)];
    for (const id of ids) {
        const a = old.get(id),
            b = next.get(id);
        if (!a || !b) continue;
        if (a.title !== b.title) return basic(`Đổi tên trang ${name(a)} thành ${name(b)}`, 'page');
        const previous = before.overrides[id] || loaded[id];
        const current = after.overrides[id] || loaded[id];
        if (!previous || !current) continue;
        if (different(previous.scene, current.scene))
            return describeSceneChange(previous.scene, current.scene, id);
        if (different(previous.image, current.image))
            return basic(`Đổi ảnh nền trang ${name(b)}`, 'page');
        if (different(previous.settings, current.settings))
            return basic(`Đổi thiết lập trang ${name(b)}`, 'page');
        if (
            different(
                [previous.markerMode, previous.markerNumber, previous.bookariaMarker],
                [current.markerMode, current.markerNumber, current.bookariaMarker],
            )
        )
            return basic(`Đổi AR Marker của trang ${name(b)}`, 'page');
    }
    return basic('Chỉnh sửa sách', 'book');
}
