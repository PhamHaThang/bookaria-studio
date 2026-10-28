import { MousePointer2 } from 'lucide-react';
import { Button } from '@/shared/ui/Button';
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from '@/shared/ui/primitives/empty';

export function SceneInspectorEmpty({
    empty,
    onList,
    onAddText,
    disabled,
}: {
    empty: boolean;
    onList: () => void;
    onAddText: () => void;
    disabled: boolean;
}) {
    return (
        <Empty className="min-h-72 px-3 py-8">
            <EmptyHeader>
                <EmptyMedia>
                    <MousePointer2 className="size-8" aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>
                    <h3>{empty ? 'Trang chưa có đối tượng' : 'Chọn một đối tượng'}</h3>
                </EmptyTitle>
                <EmptyDescription>
                    {empty
                        ? 'Thêm văn bản, hình ảnh hoặc tài nguyên từ thanh bên trái để bắt đầu.'
                        : 'Nhấp vào đối tượng trên canvas để xem và chỉnh sửa thuộc tính của riêng nó.'}
                </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    onClick={empty ? onAddText : onList}
                >
                    {empty ? 'Thêm văn bản' : 'Xem danh sách đối tượng'}
                </Button>
            </EmptyContent>
        </Empty>
    );
}
