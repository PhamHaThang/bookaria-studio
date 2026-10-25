import { z } from 'zod';
import type { BookDetail } from '../../../shared/contracts/dto.schema';
import {
    PAGE_SIZE_MM,
    PageWidthMmSchema,
    pageWidthMm,
} from '../../../shared/contracts/marker.schema';

export interface PageSizeMm {
    widthMm: number;
    heightMm: number;
}
const HeightMmSchema = z.number().min(0.1).max(5000).multipleOf(0.1);
const roundMm = (value: number) => Math.round(value * 10) / 10;

/** The PDF.js viewport at scale 1 already includes the page rotation and UserUnit. */
export function pdfPageSizeMm(widthPoints: number, heightPoints: number): PageSizeMm {
    if (![widthPoints, heightPoints].every((value) => Number.isFinite(value) && value > 0))
        throw new Error('Không đọc được kích thước trang PDF.');
    return {
        widthMm: roundMm((widthPoints * 25.4) / 72),
        heightMm: roundMm((heightPoints * 25.4) / 72),
    };
}

export function customBookSize(width: string | number, height: string | number) {
    const w = typeof width === 'string' && !width.trim() ? NaN : Number(width);
    const h = typeof height === 'string' && !height.trim() ? NaN : Number(height);
    if (!PageWidthMmSchema.safeParse(w).success)
        throw new Error('Chiều rộng phải từ 0,1 đến 1.000 mm, tối đa một chữ số thập phân.');
    if (!HeightMmSchema.safeParse(h).success)
        throw new Error('Chiều cao phải từ 0,1 đến 5.000 mm, tối đa một chữ số thập phân.');
    const aspect = h / w;
    if (aspect < 0.2 || aspect > 5)
        throw new Error('Chiều cao phải từ 0,2 đến 5 lần chiều rộng. Hãy điều chỉnh khổ sách.');
    return { pageWidthMm: w, pageAspect: Number(aspect.toFixed(4)) };
}

export function bookPageSize(
    book?: Pick<BookDetail, 'pageFormat' | 'pageAspect' | 'pageWidthMm'>,
): PageSizeMm {
    if (!book) return { widthMm: PAGE_SIZE_MM.A4.width, heightMm: PAGE_SIZE_MM.A4.height };
    if (book.pageFormat !== 'CUSTOM') {
        const size = PAGE_SIZE_MM[book.pageFormat];
        return { widthMm: size.width, heightMm: size.height };
    }
    const widthMm = pageWidthMm(book.pageFormat, book.pageWidthMm);
    return { widthMm, heightMm: roundMm(widthMm * book.pageAspect) };
}
