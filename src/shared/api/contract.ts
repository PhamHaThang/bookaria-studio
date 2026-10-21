import type { AxiosResponse } from 'axios';
import { z } from 'zod';

export class ContractError extends Error {
    constructor() {
        super(
            'Dữ liệu từ máy chủ không đúng hợp đồng API. Vui lòng thử lại hoặc báo cho nhóm phát triển.',
        );
        this.name = 'ContractError';
    }
}
/**
 * Đọc dữ liệu từ phản hồi của API và kiểm tra xem nó có đúng định dạng không.
 * @param response Phản hồi từ API
 * @param schema Schema để kiểm tra dữ liệu
 * @returns Dữ liệu đã được kiểm tra
 */
export function readData<T>(response: AxiosResponse<unknown>, schema: z.ZodType<T>): T {
    const result = z.object({ data: schema }).safeParse(response.data);
    if (!result.success) throw new ContractError();
    return result.data.data;
}
/**
 * Kiểm tra xem phản hồi từ API có đúng mã trạng thái mong đợi không.
 * @param response Phản hồi từ API
 * @param status Mã trạng thái mong đợi
 * @throws ContractError nếu mã trạng thái không đúng
 */
export function expectStatus(response: AxiosResponse<unknown>, status: number): void {
    if (response.status !== status) throw new ContractError();
}
