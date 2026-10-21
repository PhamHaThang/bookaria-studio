import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target:
                    process.env.API_PROXY_TARGET ||
                    loadEnv(mode, process.cwd(), 'VITE_API_PROXY_TARGET').VITE_API_PROXY_TARGET ||
                    'http://localhost:4000',
                changeOrigin: true,
            },
        },
    },
}));
