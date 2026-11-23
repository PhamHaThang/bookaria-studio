import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AppProviders } from './app/providers';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
    throw new Error('Root element #root not found');
}

// Preserve the boot SVG and its playhead until the shared loading boundary releases it.
const boot = rootElement.querySelector<HTMLElement>('.app-boot');
if (boot) {
    boot.id = 'app-entry-loading';
    if (/^\/books\/[^/]+\/(?:edit|pages\/[^/]+)\/?$/.test(location.pathname))
        boot.setAttribute('data-editor-loading', '');
    document.body.append(boot);
}

createRoot(rootElement).render(
    <StrictMode>
        <AppProviders>
            <App />
        </AppProviders>
    </StrictMode>,
);
