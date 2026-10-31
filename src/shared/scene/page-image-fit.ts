/** Fit the complete background image inside a page, in page-width units. */
export function pageImageSize(width: number, height: number, pageAspect: number) {
    if (![width, height, pageAspect].every((value) => Number.isFinite(value) && value > 0))
        throw new Error('Kích thước ảnh trang không hợp lệ.');
    const imageAspect = height / width;
    const fittedWidth = Math.min(1, pageAspect / imageAspect);
    return { width: fittedWidth, height: fittedWidth * imageAspect };
}
