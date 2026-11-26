import { ZodError } from 'zod';
import type { InteractionProblem } from '../../scene/model/interaction-health';

export type PreviewRepair = {
    kind: 'interaction' | 'memory' | 'scene';
    ruleId?: string;
    actionIndex?: number | null;
};
export type PreviewFailure = { message: string; repair?: PreviewRepair; retryable: boolean };
export class PreviewDataError extends Error {
    readonly repair: PreviewRepair;
    constructor(message: string, repair: PreviewRepair) {
        super(message);
        this.repair = repair;
    }
}
export function interactionFailure(problem: InteractionProblem) {
    const location =
        problem.actionIndex === null ? 'Sự kiện bắt đầu' : `Bước ${problem.actionIndex + 1}`;
    return new PreviewDataError(
        `“${problem.ruleName}” · ${location}: ${problem.message}. Chọn lại đối tượng hoặc sửa bước này trong Tương tác.`,
        {
            kind: 'interaction',
            ruleId: problem.ruleId,
            actionIndex: problem.actionIndex,
        },
    );
}
export function previewFailure(cause: unknown): PreviewFailure {
    if (cause instanceof PreviewDataError)
        return { message: cause.message, repair: cause.repair, retryable: false };
    if (cause instanceof ZodError) {
        const issue = cause.issues[0];
        const memory = issue?.path[0] === 'workflowVariables';
        return {
            message: memory
                ? `Thông tin ghi nhớ chưa hợp lệ: ${issue.message} Mở Ghi nhớ để sửa tên hoặc giá trị.`
                : 'Nội dung trang chưa hợp lệ. Quay lại Thiết kế để kiểm tra các trường được đánh dấu.',
            repair: { kind: memory ? 'memory' : 'scene' },
            retryable: false,
        };
    }
    return {
        message:
            cause instanceof Error ? cause.message : 'Chưa tải được bản xem trước. Hãy thử lại.',
        retryable: true,
    };
}
