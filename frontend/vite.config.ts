/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// The backend the dev server proxies to. It was http://localhost:3000, written
// in this file, which broke for anybody running the API on another port or in a
// container. DEV_API_TARGET now overrides it, and the old value is the default.
export default defineConfig(({ mode }) => {
  // loadEnv, not process.env: it reads .env, .env.local and .env.[mode] the same
  // way the client does, so one file configures both sides. The third argument
  // is the prefix filter, and '' turns it off — DEV_API_TARGET has no VITE_
  // prefix on purpose, because it must NOT be inlined into the client bundle.
  const env = loadEnv(mode, process.cwd(), '');
  const devApiTarget = env.DEV_API_TARGET || 'http://localhost:3000';

  return {
    plugins: [
      // Vitest never asserts on Tailwind output, and the plugin re-scans
      // every file it transforms — under parallel workers that starves the
      // event loop past Testing Library's 1s findBy budget. Skip it there.
      ...(process.env.VITEST ? [] : [tailwindcss()]),
      tanstackRouter({
        target: 'react',
        // ponytail: no lazy route chunks under Vitest — chunk loading is not
        // under test, and cold workers stall past the findBy budget.
        autoCodeSplitting: !process.env.VITEST,
        // A *.test.tsx file legitimately living under src/routes/ (testing a
        // route's own component, e.g. __root.test.tsx) is not itself a route —
        // without this the codegen warns on every build. Matches any test
        // file, not just __root's, so a future route test doesn't reopen this.
        routeFileIgnorePattern: '\\.test\\.tsx$',
      }),
      react(),
    ],
    resolve: {
      alias: { '@': `${import.meta.dirname}/src` },
    },
    server: {
      proxy: {
        // Development only. In production the app calls the API by its absolute
        // URL from config.js, and there is no proxy in front of it at all — see
        // src/lib/runtimeConfig.ts. This keeps dev on one origin, which is what
        // lets the refresh cookie work without CORS during local work.
        '/api': {
          target: devApiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    test: {
      globals: true,
      // ponytail: 5s default kills healthy tests when 38 files share a slow
      // box (a lazy route + query paint can take 2s+ cold). 10s still fails
      // a genuinely hung test fast enough. Lower it if workers get faster.
      testTimeout: 10_000,
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
  };
});
