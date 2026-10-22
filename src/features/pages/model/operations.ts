import axios from 'axios';
import { ContractError } from '../../../shared/api/contract';
import type { MarkerWarning } from '../../../shared/contracts/marker.schema';
export function movedPageIds(pages: { id: string }[], id: string, direction: -1 | 1) {
    const ids = pages.map((page) => page.id);
    const index = ids.indexOf(id),
        target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return null;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    return ids;
}
// A POST can have committed even if its response was lost. Do not silently repeat it.
export function uncertainWrite(error: unknown) {
    return (
        error instanceof ContractError ||
        (axios.isAxiosError(error) && (!error.response || error.response.status >= 500))
    );
}
export function markerWarningText(warning: MarkerWarning) {
    if (warning.startsWith('SIMILAR_TO:')) return 'Ảnh nhận diện giống một trang khác trong sách.';
    const labels: Record<string, string> = {
        NO_MARKER_AVAILABLE: 'Chưa có marker Bookaria khả dụng; trang đang không dùng AR.',
        LOW_SCORE: 'Ảnh nhận diện khó quét. Hãy chọn ảnh có nhiều chi tiết hơn.',
        NOT_SCORED: 'Ảnh nhận diện chưa có điểm đánh giá.',
        MARKER_TOO_SMALL: 'Marker quá nhỏ khi in.',
        MARKER_NEAR_EDGE: 'Marker quá gần mép trang.',
    };
    return labels[warning] || warning;
}
