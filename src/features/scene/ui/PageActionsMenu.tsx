import { ArrowLeft, ArrowRight, Copy, Pencil, Trash2 } from 'lucide-react';
import {
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from '@/shared/ui/primitives/dropdown-menu';

export function PageActionsMenu({
    title,
    locked,
    first,
    last,
    onRename,
    onMove,
    onDuplicate,
    onDelete,
}: {
    title: string;
    locked: boolean;
    first: boolean;
    last: boolean;
    onRename: () => void;
    onMove: (direction: -1 | 1) => void;
    onDuplicate: () => void;
    onDelete: () => void;
}) {
    return (
        <DropdownMenuContent
            id="page-actions-menu"
            side="top"
            align="center"
            sideOffset={8}
            collisionPadding={8}
            className="w-56"
            aria-label={title}
            onCloseAutoFocus={(event) => {
                if (document.querySelector('[role=dialog],[role=alertdialog]'))
                    event.preventDefault();
            }}
        >
            <DropdownMenuLabel>{title}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
                <DropdownMenuItem
                    disabled={locked}
                    onSelect={(event) => {
                        event.preventDefault();
                        onRename();
                    }}
                >
                    <Pencil />
                    Đổi tên trang
                </DropdownMenuItem>
                <DropdownMenuItem
                    disabled={locked || first}
                    onSelect={(event) => {
                        event.preventDefault();
                        onMove(-1);
                    }}
                >
                    <ArrowLeft />
                    Đưa lên trước
                </DropdownMenuItem>
                <DropdownMenuItem
                    disabled={locked || last}
                    onSelect={(event) => {
                        event.preventDefault();
                        onMove(1);
                    }}
                >
                    <ArrowRight />
                    Đưa ra sau
                </DropdownMenuItem>
                <DropdownMenuItem
                    disabled={locked}
                    onSelect={(event) => {
                        event.preventDefault();
                        onDuplicate();
                    }}
                >
                    <Copy />
                    Nhân bản trang
                </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
                <DropdownMenuItem
                    variant="destructive"
                    disabled={locked}
                    onSelect={(event) => {
                        event.preventDefault();
                        onDelete();
                    }}
                >
                    <Trash2 />
                    Xóa trang
                </DropdownMenuItem>
            </DropdownMenuGroup>
        </DropdownMenuContent>
    );
}
