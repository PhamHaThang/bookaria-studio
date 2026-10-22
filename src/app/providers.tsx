import { QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect } from 'react';
import { auth } from '../features/auth';
import { enableVietnameseMessages } from '../shared/contracts/error.schema';
import { queryClient } from './query-client';

enableVietnameseMessages();
export function AppProviders({ children }: { children: ReactNode }) {
    useEffect(
        () =>
            auth.store.subscribe((next, previous) => {
                if (next.user?.id !== previous.user?.id) queryClient.clear();
            }),
        [],
    );
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
