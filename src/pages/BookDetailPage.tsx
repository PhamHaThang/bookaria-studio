import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { BookInfoDialog } from '../features/books/ui/BookInfoDialog';
import { BooksPage } from './BooksPage';

/** Old detail links now open metadata above the book list. */
export function BookDetailPage() {
    const { bookId = '' } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    return (
        <>
            <BooksPage />
            <BookInfoDialog
                key={bookId}
                bookId={bookId}
                onClose={() =>
                    navigate(
                        { pathname: '/books', search: location.search, hash: location.hash },
                        { replace: true },
                    )
                }
            />
        </>
    );
}
