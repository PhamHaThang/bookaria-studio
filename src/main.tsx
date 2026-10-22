import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AppProviders } from './app/providers';
import './index.css';
import './app/studio.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
    throw new Error('Root element #root not found');
}

createRoot(rootElement).render(
    <StrictMode>
        <AppProviders>
            <App />
        </AppProviders>
    </StrictMode>,
);
