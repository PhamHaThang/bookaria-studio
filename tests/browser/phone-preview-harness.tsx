import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { PublicBookDialog } from '../../src/features/discovery/PublicBookDialog';
import { PhonePreviewDialog } from '../../src/features/preview/ui/PhonePreviewDialog';
import { ThemeProvider } from '../../src/shared/theme/ThemeProvider';
import { Toaster } from '../../src/shared/ui/primitives/sonner';
import { TooltipProvider } from '../../src/shared/ui/primitives/tooltip';
import '../../src/index.css';

function PhoneHarness() {
    const [bookId, setBookId] = useState('22222222-2222-4222-8222-222222222222');
    const [pageId, setPageId] = useState('11111111-1111-4111-8111-000000000001');
    const [unsaved, setUnsaved] = useState(false);
    const [open, setOpen] = useState(true);
    Object.assign(window, { __phonePreview: { setBookId, setPageId, setUnsaved } });
    return (
        <main className="min-h-dvh bg-background">
            {open && (
                <PhonePreviewDialog
                    bookId={bookId}
                    pageId={pageId}
                    unsaved={unsaved}
                    onClose={() => setOpen(false)}
                />
            )}
        </main>
    );
}
const library = new URLSearchParams(location.search).get('view') === 'library';
const router = createMemoryRouter(
    [{ path: '*', element: library ? <PublicBookDialog /> : <PhoneHarness /> }],
    {
        initialEntries: [library ? '/library?book=link-audit' : '/'],
    },
);
createRoot(document.getElementById('root') as HTMLElement).render(
    <ThemeProvider>
        <TooltipProvider>
            <QueryClientProvider
                client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
            >
                <RouterProvider router={router} />
                <Toaster />
            </QueryClientProvider>
        </TooltipProvider>
    </ThemeProvider>,
);
