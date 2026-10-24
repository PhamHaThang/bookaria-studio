import { BookCreateDialog } from '../features/books/ui/BookCreateDialog';
import { BooksPage } from './BooksPage';

export function BookCreatePage() {
    return (
        <>
            <BooksPage />
            <BookCreateDialog />
        </>
    );
}
