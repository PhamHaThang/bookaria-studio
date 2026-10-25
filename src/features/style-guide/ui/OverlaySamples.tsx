import { CircleHelp, MoreHorizontal, UserRound } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { ConfirmationDialog } from '@/shared/ui/ConfirmationDialog';
import { AlertDialogAction, AlertDialogCancel } from '@/shared/ui/primitives/alert-dialog';
import { Button as PrimitiveButton } from '@/shared/ui/primitives/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/shared/ui/primitives/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/shared/ui/primitives/dropdown-menu';
import { Field, FieldLabel } from '@/shared/ui/primitives/field';
import { Input } from '@/shared/ui/primitives/input';
import {
    Popover,
    PopoverContent,
    PopoverDescription,
    PopoverHeader,
    PopoverTitle,
    PopoverTrigger,
} from '@/shared/ui/primitives/popover';
import { GuideSection, Sample } from './GuideSection';

export function OverlaySamples() {
    const [confirm, setConfirm] = useState<HTMLElement | null>(null);
    const [name, setName] = useState('Sách mẫu');
    return (
        <GuideSection
            id="overlays"
            title="Modal, menu & trợ giúp"
            description="Form dùng Dialog; hành động cần xác nhận dùng ConfirmationDialog. Menu và popover không làm mất ngữ cảnh trang. Đóng overlay sẽ trả focus về nút mở."
        >
            <div className="grid grid-cols-2 gap-8 max-[800px]:grid-cols-1">
                <Sample
                    title="Sửa thông tin trong Dialog"
                    source="primitives/dialog · title + description + form"
                >
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="secondary">Mở modal mẫu</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Thông tin sách mẫu</DialogTitle>
                                <DialogDescription>
                                    Thử nhập thông tin tại chỗ. Mẫu không gửi yêu cầu lên máy chủ.
                                </DialogDescription>
                            </DialogHeader>
                            <form
                                className="mt-5"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    toast.success(`Đã lưu tên mẫu “${name.trim()}”.`);
                                }}
                            >
                                <Field className="block">
                                    <FieldLabel htmlFor="guide-dialog-name" className="mb-0">
                                        Tên sách mẫu
                                    </FieldLabel>
                                    <Input
                                        id="guide-dialog-name"
                                        required
                                        value={name}
                                        onChange={(event) => setName(event.currentTarget.value)}
                                    />
                                </Field>
                                <div className="mt-6 flex justify-end gap-3">
                                    <DialogClose asChild>
                                        <Button variant="ghost">Đóng mẫu</Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={!name.trim()}>
                                        Lưu tên mẫu
                                    </Button>
                                </div>
                            </form>
                        </DialogContent>
                    </Dialog>
                </Sample>
                <Sample
                    title="Xác nhận hành động"
                    source="@/shared/ui/ConfirmationDialog → AlertDialog"
                >
                    <Button variant="danger" onClick={(event) => setConfirm(event.currentTarget)}>
                        Mở xác nhận mẫu
                    </Button>
                    {confirm && (
                        <ConfirmationDialog
                            title="Xóa bản mẫu?"
                            description="Đây là mẫu giao diện. Không có sách hay tài nguyên thật bị xóa."
                            busy={false}
                            returnFocus={confirm}
                            onClose={() => setConfirm(null)}
                        >
                            <div className="mt-6 flex justify-end gap-3">
                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                <AlertDialogAction
                                    variant="destructive"
                                    onClick={() => {
                                        toast.success('Đã xác nhận thao tác mẫu.');
                                        setConfirm(null);
                                    }}
                                >
                                    Xác nhận mẫu
                                </AlertDialogAction>
                            </div>
                        </ConfirmationDialog>
                    )}
                </Sample>
                <Sample title="Avatar và menu tài khoản" source="Avatar + primitives/dropdown-menu">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <PrimitiveButton variant="outline">
                                <Avatar url={null} />
                                Tài khoản mẫu
                                <MoreHorizontal data-icon="inline-end" />
                            </PrimitiveButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="min-w-56">
                            <DropdownMenuLabel>Tài khoản minh họa</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuGroup>
                                <DropdownMenuItem onSelect={() => toast.info('Mục hồ sơ mẫu.')}>
                                    <UserRound />
                                    Hồ sơ mẫu
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => toast.info('Mục Studio mẫu.')}>
                                    Studio mẫu
                                </DropdownMenuItem>
                            </DropdownMenuGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </Sample>
                <Sample
                    title="Popover và Tooltip"
                    source="primitives/popover; Button title dùng Tooltip chung"
                >
                    <div className="flex flex-wrap gap-3">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="secondary">Mở trợ giúp mẫu</Button>
                            </PopoverTrigger>
                            <PopoverContent align="start">
                                <PopoverHeader>
                                    <PopoverTitle>Trợ giúp tại chỗ</PopoverTitle>
                                    <PopoverDescription>
                                        Giữ nội dung liên quan bên cạnh thao tác hiện tại; dùng
                                        Escape để đóng.
                                    </PopoverDescription>
                                </PopoverHeader>
                            </PopoverContent>
                        </Popover>
                        <PrimitiveButton
                            size="icon"
                            variant="ghost"
                            aria-label="Giải thích công cụ mẫu"
                            title="Chú thích dùng chung của Button"
                        >
                            <CircleHelp />
                        </PrimitiveButton>
                    </div>
                </Sample>
            </div>
        </GuideSection>
    );
}
