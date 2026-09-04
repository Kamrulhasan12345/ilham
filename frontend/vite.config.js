/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            // In development Vite plays the part nginx plays in production: one
            // origin, /api proxied through. See docs/frontend-prd.md §5.1.
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                rewrite: function (path) { return path.replace(/^\/api/, ''); },
            },
        },
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/vitest.setup.ts'],
        include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
    },
});
