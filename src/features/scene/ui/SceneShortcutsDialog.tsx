import { Keyboard, MousePointer2, Move, Scan, Undo2 } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { Button } from '@/shared/ui/primitives/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/shared/ui/primitives/dialog';
import { Kbd, KbdGroup } from '@/shared/ui/primitives/kbd';
import { Separator } from '@/shared/ui/primitives/separator';

function Keys({ keys }: { keys: string[] }) {
    return (
        <KbdGroup>
            {keys.map((key, index) => (
                <Fragment key={key}>
                    {index > 0 && <span aria-hidden="true">+</span>}
                    <Kbd>{key}</Kbd>
                </Fragment>
            ))}
        </KbdGroup>
    );
}

type Shortcut = { label: string; input: ReactNode };
const groups = [
    {
        id: 'view',
        title: 'Góc nhìn',
        icon: MousePointer2,
        items: [
            { label: 'Xoay góc nhìn', input: 'Kéo chuột trái' },
            {
                label: 'Dịch góc nhìn',
                input: (
                    <>
                        <span>Kéo phải /</span>
                        <Keys keys={['Space']} />
                        <span>+ kéo</span>
                    </>
                ),
            },
            { label: 'Thu / phóng', input: 'Cuộn chuột' },
            { label: 'Zoom liên tục', input: 'Giữ giữa + kéo dọc' },
            { label: 'Đưa đối tượng vào giữa', input: <Keys keys={['F']} /> },
        ] satisfies Shortcut[],
    },
    {
        id: 'selection',
        title: 'Chọn đối tượng',
        icon: Scan,
        items: [
            {
                label: 'Chọn nhiều',
                input: (
                    <>
                        <Keys keys={['Shift']} />
                        <span>/</span>
                        <Keys keys={['Ctrl']} />
                        <span>+ nhấp</span>
                    </>
                ),
            },
            {
                label: 'Kéo khung chọn',
                input: (
                    <>
                        <Keys keys={['Shift']} />
                        <span>+ kéo trên canvas</span>
                    </>
                ),
            },
            { label: 'Chọn tất cả', input: <Keys keys={['Ctrl', 'A']} /> },
            { label: 'Bỏ chọn', input: <Keys keys={['Esc']} /> },
        ] satisfies Shortcut[],
    },
    {
        id: 'transform',
        title: 'Biến đổi',
        icon: Move,
        items: [
            { label: 'Di chuyển', input: <Keys keys={['W']} /> },
            { label: 'Xoay', input: <Keys keys={['E']} /> },
            { label: 'Kích thước', input: <Keys keys={['R']} /> },
            { label: 'Trục thế giới / cục bộ', input: <Keys keys={['L']} /> },
            { label: 'Bật / tắt snap', input: <Keys keys={['N']} /> },
            { label: 'Bắt bước khi di chuyển / xoay', input: <Keys keys={['Shift']} /> },
            { label: 'Giữ tỉ lệ khi scale', input: <Keys keys={['Shift']} /> },
            { label: 'Hủy thao tác đang kéo', input: <Keys keys={['Esc']} /> },
        ] satisfies Shortcut[],
    },
    {
        id: 'edit',
        title: 'Chỉnh sửa',
        icon: Undo2,
        items: [
            { label: 'Hoàn tác', input: <Keys keys={['Ctrl', 'Z']} /> },
            { label: 'Làm lại', input: <Keys keys={['Ctrl', 'Shift', 'Z']} /> },
            { label: 'Nhân bản', input: <Keys keys={['Ctrl', 'D']} /> },
            { label: 'Xóa đối tượng', input: <Keys keys={['Delete']} /> },
            { label: 'Lưu nội dung', input: <Keys keys={['Ctrl', 'S']} /> },
        ] satisfies Shortcut[],
    },
];

export function SceneShortcutsDialog({
    onClose,
    returnFocus,
}: {
    onClose: () => void;
    returnFocus: HTMLElement | null;
}) {
    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent
                className="flex max-h-[calc(100dvh_-_48px)] w-[min(840px,_calc(100vw_-_48px))] max-w-none flex-col overflow-hidden p-0"
                onCloseAutoFocus={(event) => {
                    if (returnFocus?.isConnected) {
                        event.preventDefault();
                        returnFocus.focus({ preventScroll: true });
                    }
                }}
            >
                <DialogHeader className="shrink-0 px-6 py-5 pr-16">
                    <DialogTitle size="lg" className="flex items-center gap-3">
                        <Keyboard className="size-6" strokeWidth={1.5} aria-hidden="true" />
                        Phím tắt trong editor
                    </DialogTitle>
                    <DialogDescription>
                        Tra cứu nhanh các thao tác chuột và bàn phím.
                    </DialogDescription>
                </DialogHeader>
                <Separator />
                <div className="grid min-h-0 grid-cols-2 gap-x-8 gap-y-5 overflow-y-auto px-6 py-4">
                    {groups.map((group) => (
                        <section key={group.id} aria-labelledby={`editor-shortcuts-${group.id}`}>
                            <h3
                                id={`editor-shortcuts-${group.id}`}
                                className="mb-2 flex items-center gap-2 text-sm"
                            >
                                <group.icon className="size-4" aria-hidden="true" />
                                {group.title}
                            </h3>
                            <dl className="m-0">
                                {group.items.map((item) => (
                                    <div
                                        key={item.label}
                                        className="flex min-h-7 items-center justify-between gap-3 py-1 text-sm"
                                        data-shortcut-row
                                    >
                                        <dt>{item.label}</dt>
                                        <dd className="m-0 flex shrink-0 items-center justify-end gap-1.5 text-muted-foreground">
                                            {item.input}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </section>
                    ))}
                </div>
                <Separator />
                <div className="flex shrink-0 items-center justify-between gap-6 px-6 py-3">
                    <p className="m-0 flex items-center gap-1.5 text-muted-foreground text-xs">
                        Trên macOS, dùng <Kbd>⌘</Kbd> thay cho <Kbd>Ctrl</Kbd>.
                    </p>
                    <DialogClose asChild>
                        <Button className="min-w-28">Đã hiểu</Button>
                    </DialogClose>
                </div>
            </DialogContent>
        </Dialog>
    );
}
