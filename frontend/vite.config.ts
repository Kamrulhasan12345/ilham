/// <reference types="vitest/config" />
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
      // A *.test.tsx file legitimately living under src/routes/ (testing a
      // route's own component, e.g. __root.test.tsx) is not itself a route —
      // without this the codegen warns on every build. Matches any test
      // file, not just __root's, so a future route test doesn't reopen this.
      routeFileIgnorePattern: '\\.test\\.tsx$',
    }),
    react(),
  ],
  server: {
    proxy: {
      // In development Vite plays the part nginx plays in production: one
      // origin, /api proxied through. See docs/frontend-prd.md §5.1.
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    globals: true,
    // Two projects, not one suite plus environmentMatchGlobs: Vitest 4 removed
    // environmentMatchGlobs, and a removed option is ignored in silence. The
    // scripts/ tests then ran under jsdom, where import.meta.url is not a
    // file: URL, and fileURLToPath threw. Projects are the documented
    // replacement. Each one names its own environment, so the split is
    // explicit and cannot rot the same way.
    projects: [
      {
        extends: true,
        test: {
          name: 'app',
          environment: 'jsdom',
          setupFiles: ['./src/vitest.setup.ts'],
          include: ['src/**/*.test.{ts,tsx}'],
        },
      },
      {
        extends: true,
        test: {
          name: 'scripts',
          environment: 'node',
          include: ['scripts/**/*.test.ts'],
        },
      },
    ],
  },
});
