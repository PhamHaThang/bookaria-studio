import {
    checkMarkerPlacement,
    type MarkerTransform,
    MarkerTransformSchema,
    type PageGeometry,
    pageWidthMm,
} from '../../../shared/contracts/marker.schema';

export function placementFromForm(form: FormData, page: PageGeometry): MarkerTransform {
    const values = ['centerX', 'centerY', 'size'].map((key) => {
        const text = String(form.get(key) ?? '').trim();
        if (!text || !Number.isFinite(Number(text)))
            throw new Error('Nhập đủ vị trí và kích thước marker bằng số.');
        return Number(text);
    });
    const [x, y, size] = values;
    const width = pageWidthMm(page.format);
    const transform = MarkerTransformSchema.parse({
        x: x / width - 0.5,
        y: page.aspect / 2 - y / width,
        size: size / width,
    });
    const issues = checkMarkerPlacement(transform, page);
    if (issues.length) throw new Error(issues.map((issue) => issue.message).join(' '));
    return transform;
}
