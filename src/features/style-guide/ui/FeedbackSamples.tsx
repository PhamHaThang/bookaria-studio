import { useState } from 'react';
import { toast } from 'sonner';
import { Alert } from '@/shared/ui/Alert';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Feedback } from '@/shared/ui/Feedback';
import { Progress } from '@/shared/ui/primitives/progress';
import { GuideSection, Sample } from './GuideSection';

export function FeedbackSamples() {
    const [progress, setProgress] = useState(40);
    return (
        <GuideSection
            id="feedback"
            title="Phản hồi & trạng thái"
            description="Thành công ngắn dùng toast ở góc phải dưới, tự đóng sau 4 giây. Lỗi cần sửa và cảnh báo giữ lại tại chỗ. Tiến độ chỉ có phần trăm khi tác vụ đo được."
        >
            <div className="flex flex-col gap-8">
                <Sample
                    title="Alert theo vai trò"
                    source="@/shared/ui/Alert · info / success / warning / danger"
                >
                    <div className="grid grid-cols-2 gap-4 max-[800px]:grid-cols-1">
                        <Alert tone="info">Thông tin: bạn có thể đổi tên sách trong editor.</Alert>
                        <Alert tone="success">Thành công: thông tin mẫu đã được lưu.</Alert>
                        <Alert tone="warning">Cần chú ý: xác minh email trước khi xuất bản.</Alert>
                        <Alert tone="danger">Chưa kết nối được máy chủ. Vui lòng thử lại.</Alert>
                    </div>
                </Sample>
                <Sample
                    title="Toast và lỗi tại chỗ"
                    source="Feedback + một Toaster dùng chung ở gốc ứng dụng"
                >
                    <div className="flex flex-wrap gap-3">
                        <Button
                            onClick={() =>
                                toast.success('Đã lưu thay đổi mẫu.', { duration: 4000 })
                            }
                        >
                            Thử toast thành công
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={() => toast.info('Đây là thông báo mẫu.', { duration: 4000 })}
                        >
                            Thử toast thông tin
                        </Button>
                        <Button variant="outline" onClick={() => toast.dismiss()}>
                            Đóng toast mẫu
                        </Button>
                    </div>
                    <Feedback
                        error="Lỗi mẫu: tệp vượt dung lượng cho phép. Chọn một tệp nhỏ hơn."
                        warning="Cảnh báo mẫu: mô hình nhiều chi tiết có thể tải chậm."
                    />
                </Sample>
                <Sample
                    title="Badge"
                    source="@/shared/ui/Badge · tone dùng chung với dữ liệu nghiệp vụ"
                >
                    <div className="flex flex-wrap items-center gap-3">
                        <Badge>Bản nháp</Badge>
                        <Badge tone="success">Sẵn sàng</Badge>
                        <Badge tone="warning">Đang xử lý</Badge>
                        <Badge tone="danger">Thất bại</Badge>
                        <Badge tone="info">Thư viện chung</Badge>
                    </div>
                </Sample>
                <Sample title="Tiến độ xác định" source="primitives/progress · value=0…100">
                    <div className="flex max-w-140 flex-col gap-3">
                        <div className="flex justify-between gap-4 text-sm">
                            <span>Tiến độ mẫu</span>
                            <span className="tabular-nums">{progress}%</span>
                        </div>
                        <Progress value={progress} aria-label="Tiến độ mẫu" />
                        <div className="flex gap-3">
                            <Button
                                size="sm"
                                variant="secondary"
                                disabled={progress === 100}
                                onClick={() => setProgress((value) => Math.min(100, value + 20))}
                            >
                                Tăng 20%
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setProgress(0)}>
                                Đặt lại tiến độ
                            </Button>
                        </div>
                    </div>
                </Sample>
            </div>
        </GuideSection>
    );
}
