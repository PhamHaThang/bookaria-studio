import { Link } from 'react-router-dom';
import { Button } from '@/shared/ui/Button';

export function NotFoundPage() {
    return (
        <section className="mx-auto max-w-160 py-20 text-center">
            <h1 className="mb-4 text-3xl">Không tìm thấy trang</h1>
            <p className="mb-8 text-muted-foreground">
                Liên kết có thể đã thay đổi. Bạn có thể về trang chủ hoặc khám phá những cuốn sách
                đang được chia sẻ.
            </p>
            <div className="flex justify-center gap-3">
                <Button asChild>
                    <Link to="/">Về trang chủ</Link>
                </Button>
                <Button variant="secondary" asChild>
                    <Link to="/library">Khám phá sách</Link>
                </Button>
            </div>
        </section>
    );
}
