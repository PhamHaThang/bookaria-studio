import { Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/shared/ui/primitives/button';

export function HomeLink() {
    return (
        <Button variant="ghost" size="sm" asChild>
            <Link to="/">
                <Home data-icon="inline-start" />
                Trang chủ
            </Link>
        </Button>
    );
}
