# Frontend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the frontend project — Vite/React/TypeScript scaffold, the Layer-0
design tokens, the API client, the auth context and route guards, the app shell, the
TanStack Router skeleton, and the Docker packaging — so every later phase in
`docs/frontend-prd.md` §14 has a working, tested foundation to build on.

**Architecture:** A four-layer frontend (tokens → primitives → domain → routes) per
`docs/frontend-prd.md` §4, served by Vite in development and by nginx in production,
talking to the API over one origin at `/api`. This plan builds the scaffold, Layer 0,
and the cross-cutting plumbing (API client, auth, guards, shell, router). It does
**not** build Layer 1 primitives, any real page, or any domain component — those are
later phases, listed in the Roadmap section at the end of this document.

**Tech Stack:** Vite, React 18, TypeScript, TanStack Router (file-based), TanStack
Query, Zod, Biome, Vitest, Testing Library, nginx (production), Docker Compose.

**Spec:** `docs/frontend-prd.md` (primary), `docs/design/DESIGN.md` and
`docs/design/specimen.html` (tokens), `docs/backend-prd.md` (the API contract this
plan's client code is built against), `docs/database.md` (schema reference). Read
`docs/frontend-prd.md` in full before starting — this plan implements only its §14
build-order item 1 ("Foundation").

## Global Constraints

These apply to every task below; they are copied verbatim or near-verbatim from the
specs so an executor never has to go hunting for them.

- **No corpus writes, ever.** The frontend never writes to `corpus.*`. (frontend-prd
  §1 non-goals; root `CLAUDE.md`)
- **Four layers, one direction.** `tokens.css` (Layer 0) → primitives in `src/ui/`
  (Layer 1) → domain components in `src/domain/` (Layer 2) → routes in `src/routes/`
  (Layer 3). A layer imports only from the layer below it. This plan only builds
  Layer 0 plus the cross-cutting `src/lib/`, `src/auth/`, and `src/app/` code; Layers
  1–3 proper start in later phases. (frontend-prd §4.1)
- **No raw literal outside Layer 0.** A colour, size, space, radius, or duration
  literal outside `tokens.css` is a defect — always `var(--token)`. The one exception
  is a border-width declaration, which may stay a literal `1px`/`2px`. (frontend-prd
  §4.2) Task 9 in this plan builds the CI check for this rule.
- **Logical CSS properties everywhere** — `margin-inline-start`, not `margin-left`.
  (frontend-prd D7)
- **English interface, left to right. Arabic sits in `dir="rtl"` islands.**
  (frontend-prd D6)
- **A typed API contract, no mock layer.** Build against the real contract in
  `docs/backend-prd.md`, not a fake backend. (frontend-prd D8)
- **The access token lives in memory only** — never `localStorage` or
  `sessionStorage`. The refresh token is an opaque string in an `httpOnly` cookie;
  JavaScript never reads it. (frontend-prd D9, §5.3)
- **Refresh is single-flight.** Many requests can 401 at once; the client keeps
  exactly one pending refresh promise and every waiting request awaits it.
  (frontend-prd §5.3)
- **One origin.** Only `/auth/refresh` and `/auth/logout` send
  `credentials: 'include'`, because only those two read the cookie. (frontend-prd
  §5.2)
- **Every response passes through a zod schema at the API client boundary.** A schema
  failure is a real failure, not a warning. (frontend-prd §5.2)
- **Biome for lint and format.** One tool, one config file. (frontend-prd D13)
- **No cards, no panels, no shadows.** Grouping is the rail tint and 48px of air.
  (frontend-prd §4.5.10, DESIGN.md §7)
- **A visible focus ring is an outline, never a `box-shadow`** — 2px `--index`,
  offset 2px, on `:focus-visible`. (DESIGN.md §2.7)
- **`prefers-reduced-motion` collapses every duration to 0.01ms**, but the state
  still changes. (frontend-prd §10)
- **This repository's documents use ASD-STE100 Simplified Technical English** — short
  sentences, active voice, present tense, one instruction per sentence. Any prose this
  plan asks an executor to write (UI copy, comments, docs) follows this style. (root
  `CLAUDE.md`)
- **Branch discipline.** Do all of this work on a feature branch (for example
  `feat/frontend-foundation`), never directly on `master`. Commit after every step
  marked "Commit" below. (root `CLAUDE.md`)

### A known, deliberate gap this plan works around

`backend/` today is a minimal Hono scaffold (3 read-only routes, no auth, no
envelope). `docs/backend-prd.md` is the plan of record and supersedes it — where they
disagree, the backend PRD wins (root `CLAUDE.md`, frontend-prd companion-files note).
This plan's API client, auth context, and route guards are built against the **target
contract in `docs/backend-prd.md`** (the JSON envelope, `/auth/*`, `GET /auth/me`),
not against what `backend/` returns today. That means:

- Task 3's and Task 4's automated tests use mocked `fetch` responses shaped like the
  target contract, and pass regardless of what `backend/` currently does.
- There is no live end-to-end auth flow to click through until the real Express
  backend (`docs/backend-prd.md` week 3 gate) exists. That is expected, not a defect
  in this plan — it is called out again at the relevant tasks.
- Task 8 containers the **current** `backend/` scaffold unchanged (a mechanical
  Docker step, no backend logic touched) purely so `docker compose up` produces a
  real three-service stack today, per frontend-prd D11. When the Express rewrite
  lands in the same directory, the same Dockerfile keeps working unmodified.

---

## File structure this plan produces

```
frontend/
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── biome.json
├── .gitignore
├── Dockerfile
├── nginx.conf
├── scripts/
│   ├── check-token-literals.mjs
│   └── check-token-literals.test.ts
└── src/
    ├── main.tsx
    ├── vite-env.d.ts
    ├── vitest.setup.ts
    ├── routeTree.gen.ts        (generated by the router plugin; committed)
    ├── router.tsx
    ├── styles/
    │   ├── tokens.css
    │   ├── reset.css
    │   └── base.css
    ├── lib/
    │   ├── apiClient.ts
    │   └── apiClient.test.ts
    ├── auth/
    │   ├── guards.ts
    │   ├── guards.test.ts
    │   ├── AuthContext.tsx
    │   └── AuthContext.test.tsx
    ├── app/
    │   ├── theme.ts
    │   ├── theme.test.ts
    │   ├── ThemeSwitch.tsx
    │   ├── ThemeSwitch.module.css
    │   ├── ThemeSwitch.test.tsx
    │   ├── Shell.tsx
    │   ├── Shell.module.css
    │   └── Shell.test.tsx
    └── routes/
        ├── __root.tsx
        ├── login.tsx
        ├── _authed.tsx
        ├── _authed/
        │   └── index.tsx
        └── router-guard.test.tsx
backend/
└── Dockerfile               (new: containerizes the existing Hono scaffold)
compose.yaml                 (modified: adds `api` and `web` services)
```

---

### Task 1: Project scaffold — Vite, React, TypeScript, Biome, Vitest

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/biome.json`
- Create: `frontend/.gitignore`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/App.test.tsx`
- Create: `frontend/src/vite-env.d.ts`
- Create: `frontend/src/vitest.setup.ts`
- Delete: `frontend/.gitkeep`

**Interfaces:**
- Produces: an `npm run dev`, `npm run build`, `npm run test`, `npm run lint` set of
  scripts that every later task extends. `frontend/vite.config.ts` exports a
  `defineConfig` result that later tasks add a `server.proxy` entry and (Task 7) the
  TanStack Router plugin to.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "ilham-frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "biome check .",
    "format": "biome format --write .",
    "check:tokens": "node scripts/check-token-literals.mjs"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.2",
    "jsdom": "^25.0.1",
    "typescript": "^5.6.3",
    "vite": "^5.4.9",
    "vitest": "^2.1.3"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: Write `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Write `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Write `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": { "quoteStyle": "single", "semicolons": "always" }
  },
  "files": {
    "ignore": ["dist", "node_modules", "src/routeTree.gen.ts"]
  }
}
```

- [ ] **Step 6: Write `.gitignore`**

```
node_modules
dist
.env
*.local
```

`src/routeTree.gen.ts` is deliberately **not** ignored — see Task 7 for why it is
committed.

- [ ] **Step 7: Write `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="light dark" />
    <title>Ilham</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: Write `src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 9: Write `src/vitest.setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 10: Write the failing test — `src/App.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('renders the product name', () => {
    render(<App />);
    expect(screen.getByText('Ilham')).toBeInTheDocument();
  });
});
```

- [ ] **Step 11: Run the test to verify it fails**

Run (from `frontend/`, after `npm install`):

```bash
npm install
npm run test
```

Expected: FAIL — `./App` has no exported member, or the module does not exist.

- [ ] **Step 12: Write the minimal implementation — `src/App.tsx`**

```tsx
export function App() {
  return <p>Ilham</p>;
}
```

- [ ] **Step 13: Write `src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 14: Run the test to verify it passes**

```bash
npm run test
```

Expected: PASS.

- [ ] **Step 15: Verify the dev server and the build**

```bash
npm run dev
```

Open the printed local URL and confirm the page shows "Ilham". Stop the dev server,
then:

```bash
npm run build
npm run lint
```

Expected: the build produces `dist/`, and `biome check .` reports no errors (Biome
will reformat files it just wrote if their style differs — rerun `npm run format`
once if `lint` complains, then `npm run lint` again).

- [ ] **Step 16: Remove the scaffold placeholder and commit**

```bash
git rm frontend/.gitkeep
git add frontend/
git commit -m "feat(frontend): scaffold Vite, React, TypeScript, Biome, and Vitest"
```

---

### Task 2: Layer 0 — tokens, reset, and base styles

**Files:**
- Create: `frontend/src/styles/tokens.css`
- Create: `frontend/src/styles/reset.css`
- Create: `frontend/src/styles/base.css`
- Modify: `frontend/index.html` (add the Google Fonts links)
- Modify: `frontend/src/main.tsx` (import the three stylesheets)
- Modify: `frontend/src/App.tsx` (render a small on-page proof the tokens loaded)

**Interfaces:**
- Consumes: nothing (Layer 0 has no dependencies).
- Produces: every CSS custom property listed in `docs/design/DESIGN.md` §1, available
  to every later Layer 1/2/3 file via `var(--token-name)`.

This task copies real values from `docs/design/specimen.html` lines 29–219 — the
file's own comment names this exact copy as the intended path
(`docs/design/specimen.html:24-26`). There is no unit test for a CSS token file;
verification here is a manual visual check, which is the correct tool for this kind
of change (see `docs/frontend-prd.md` §13: "write the right ones").

- [ ] **Step 1: Write `frontend/src/styles/tokens.css`**

```css
/* Layer 0. The only file a new design system replaces.
   Source of truth: docs/design/specimen.html's :root block.
   If this file and that block disagree, the block wins and this file is stale. */

:root {
  /* Colour — seven roles, light ground (1c), the default */
  --ground: #fcfcfa;
  --rail: #f1f0ec;
  --rule: #d8d7d1;
  --edge: #8b8b85;
  --ink: #111211;
  --ink-app: #5c5f5c;
  --index: #2437c4;
  --machine: #3b3e42;

  /* Type — three families, three jobs */
  --font-ar: 'Scheherazade New', 'Amiri', serif;
  --font-en: 'Instrument Sans', system-ui, -apple-system, sans-serif;
  --font-mono: 'DM Mono', ui-monospace, 'SFMono-Regular', monospace;

  /* Latin scale — ratio 4.0:1 (13 -> 52) */
  --fs-count: 4.5rem; /* 72 / 0.95  corpus counts only */
  --fs-title: 3.25rem; /* 52 / 1.0   screen title */
  --fs-name: 2.375rem; /* 38 / 1.1   narrator name */
  --fs-sect: 1.75rem; /* 28 / 1.25  section heading */
  --fs-lead: 1.3125rem; /* 21 / 1.45  lead and pull translation */
  --fs-body: 1rem; /* 16 / 1.55  translation body, cells */
  --fs-rail: 0.9375rem; /* 15 / 1.55  rail body, glosses, grades */
  --fs-label: 0.8125rem; /* 13 / 1.4   every label, sentence case */

  /* Arabic scale — its own ladder */
  --fs-ar-chapter: 4rem; /* 64 / 1.75 */
  --fs-ar-matn: 2.75rem; /* 44 / 1.9, 1.95 on dark */
  --fs-ar-name: 1.75rem; /* 28 / 1.9 */
  --fs-ar-chain: 1.375rem; /* 22 / 1.25 */
  --fs-ar-grade: 1.375rem; /* 22 / 2.1 */

  --lh-ar-matn: 1.9;
  --lh-en-body: 1.55;
  --track-en: 0;
  --track-label: 0.005em;

  /* Space — a doubling scale on a 6px base, five steps only */
  --sp-1: 6px;
  --sp-2: 12px;
  --sp-3: 24px;
  --sp-4: 48px;
  --sp-5: 96px;

  /* The signature element */
  --rail-w: 210px;
  --chain-row: 63px;

  /* Border and radius */
  --bw: 1px;
  --r-chip: 999px;
  --focus-w: 2px;
  --focus-off: 2px;

  /* Motion — named for the job, not the length */
  --dur-micro: 120ms;
  --dur-move: 180ms;
  --dur-enter: 240ms;
  --ease-out: cubic-bezier(0.2, 0.7, 0.3, 1);
}

/* Dark ground (2a). Written twice on purpose: CSS cannot alias a set of
   declarations, so the system preference and the explicit choice each get
   their own block. Never define a colour inside a media query only. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    --ground: #16181a;
    --rail: #1e2124;
    --rule: #2e3236;
    --edge: #656b72;
    --ink: #e4e2dc;
    --ink-app: #b4b8b3;
    --index: #93a8f5;
    --machine: #a9aeb4;
    --fs-body: 1.0625rem;
    --lh-ar-matn: 1.95;
    --track-en: 0.01em;
  }
}
:root[data-theme='dark'] {
  --ground: #16181a;
  --rail: #1e2124;
  --rule: #2e3236;
  --edge: #656b72;
  --ink: #e4e2dc;
  --ink-app: #b4b8b3;
  --index: #93a8f5;
  --machine: #a9aeb4;
  --fs-body: 1.0625rem;
  --lh-ar-matn: 1.95;
  --track-en: 0.01em;
}
```

Prefer `prefers-reduced-motion` overrides live in `base.css`, not here — this file is
tokens only, per §4.1 ("no selectors, no components" beyond the two theme blocks
above, which are token re-declarations, not components).

- [ ] **Step 2: Write `frontend/src/styles/reset.css`**

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
}

body {
  background: var(--ground);
  color: var(--ink);
  font-family: var(--font-en);
  font-size: var(--fs-body);
  line-height: var(--lh-en-body);
  letter-spacing: var(--track-en);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

/* Focus is an outline, never a box-shadow: a shadow disappears in Windows
   High Contrast Mode. */
*:focus-visible {
  outline: var(--focus-w) solid var(--index);
  outline-offset: var(--focus-off);
}
@media (forced-colors: active) {
  *:focus-visible {
    outline: var(--focus-w) solid CanvasText;
  }
}

a {
  color: var(--index);
  text-decoration: underline;
  text-underline-offset: 2px;
}
a:hover {
  text-decoration-thickness: 2px;
}

/* Arabic never takes letter-spacing at any size — it is a joined script and
   tracking pulls the joins apart. */
[dir='rtl'] {
  letter-spacing: 0 !important;
}

.ar {
  font-family: var(--font-ar);
  font-weight: 400;
  font-style: normal;
  text-align: right;
  letter-spacing: 0;
}

/* Every database value is bracketed as well as monospaced, so the
   distinction survives a screenshot and a screen reader. */
.m {
  font-family: var(--font-mono);
  font-weight: 400;
  font-size: 0.9em;
  color: var(--machine);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
}
.m::before {
  content: '[';
}
.m::after {
  content: ']';
}
.m--bare::before,
.m--bare::after {
  content: none;
}

.label {
  font-family: var(--font-en);
  font-size: var(--fs-label);
  font-weight: 600;
  line-height: 1.4;
  letter-spacing: var(--track-label);
  color: var(--ink-app);
  margin: 0;
}

.vh {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 3: Write `frontend/src/styles/base.css`**

```css
html {
  color-scheme: light dark;
}

#root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
```

- [ ] **Step 4: Add the Google Fonts links to `frontend/index.html`**

Add these lines inside `<head>`, after `<title>Ilham</title>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400&family=Instrument+Sans:wght@400;600&family=Scheherazade+New:wght@400;700&display=swap"
  rel="stylesheet"
/>
```

- [ ] **Step 5: Import the stylesheets in `frontend/src/main.tsx`**

Add these three lines at the top of the file, before the `App` import:

```ts
import './styles/tokens.css';
import './styles/reset.css';
import './styles/base.css';
```

- [ ] **Step 6: Render a visual proof in `frontend/src/App.tsx`**

Replace the file with:

```tsx
export function App() {
  return (
    <div style={{ padding: 'var(--sp-4)' }}>
      <p style={{ fontSize: 'var(--fs-label)', color: 'var(--ink-app)' }} className="label">
        Ilham
      </p>
      <p className="ar" dir="rtl" style={{ fontSize: 'var(--fs-ar-matn)' }}>
        الحمد لله
      </p>
      <p>
        A database value looks like this: <span className="m">1234</span>
      </p>
    </div>
  );
}
```

(Inline styles here are a one-off proof for this task only — Task 6 onward uses CSS
Modules, per `docs/frontend-prd.md` §4.3. This file is replaced again in Task 7.)

- [ ] **Step 7: Verify visually**

```bash
npm run dev
```

Confirm in the browser:
- The Latin label text is small and grey (`--ink-app`), not black.
- The Arabic line renders in the Naskh typeface (Scheherazade New) at 44px, right
  aligned.
- `1234` shows as `[1234]` in a monospace font.
- Toggle your OS to dark mode (or use your browser devtools' "Emulate CSS
  prefers-color-scheme: dark") and confirm the background turns to the dark charcoal
  `#16181A`, not pure black, with no page reload needed.

- [ ] **Step 8: Run the existing test suite and the build**

```bash
npm run test
npm run build
npm run lint
```

Expected: the Task 1 test still passes (the text "Ilham" is still on the page); the
build succeeds.

- [ ] **Step 9: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): add the Apparatus design tokens (Layer 0)"
```

---

### Task 3: The API client

**Files:**
- Create: `frontend/src/lib/apiClient.ts`
- Create: `frontend/src/lib/apiClient.test.ts`
- Modify: `frontend/package.json` (add `zod`)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces (consumed by Task 4 and every later phase):
  - `export class ApiError extends Error { status: number; code: string; }`
  - `export function setAccessToken(token: string | null): void`
  - `export function getAccessToken(): string | null`
  - `export function refreshAccessToken(): Promise<string>` — single-flight; throws
    `ApiError` on failure and clears the token.
  - `export async function apiFetch<T>(path: string, schema: ZodSchema<T>, options?: ApiFetchOptions): Promise<T>`
  - `export interface ApiFetchOptions { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; credentials?: 'include'; }`

This is the one wrapper `docs/frontend-prd.md` §5.2 calls for: it adds the
`Authorization` header, sets JSON headers, converts a non-2xx response into a typed
error, and owns the refresh-and-retry rule in §5.3. It is pure client logic, so every
test here mocks `global.fetch` — no server needed, and no mock **layer** for UI
development is created (that stays forbidden per D8; this is a unit test of the
client's own logic, which §13 asks for by name: "the error handling in the API
client").

- [ ] **Step 1: Install zod**

```bash
cd frontend && npm install zod@^3.23.8
```

- [ ] **Step 2: Write the failing tests — `frontend/src/lib/apiClient.test.ts`**

```ts
import { z } from 'zod';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch, getAccessToken, setAccessToken } from './apiClient';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const collectionSchema = z.object({ collection_id: z.number(), slug: z.string() });

describe('apiFetch', () => {
  beforeEach(() => {
    setAccessToken(null);
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses the data envelope through the given schema', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(200, { data: { collection_id: 1, slug: 'sahih-al-bukhari' } }),
    );
    const result = await apiFetch('/collections/1', collectionSchema);
    expect(result).toEqual({ collection_id: 1, slug: 'sahih-al-bukhari' });
  });

  it('sends the Authorization header when an access token is set', async () => {
    setAccessToken('abc123');
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, { data: { collection_id: 1, slug: 'x' } }));
    await apiFetch('/collections/1', collectionSchema);
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer abc123');
  });

  it('throws ApiError with the server code and message on a non-2xx response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(404, { error: { code: 'not_found', message: 'hadith not found' } }),
    );
    await expect(apiFetch('/hadiths/999999', collectionSchema)).rejects.toMatchObject({
      status: 404,
      code: 'not_found',
      message: 'hadith not found',
    });
  });

  it('throws a contract_error ApiError when the payload does not match the schema', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(200, { data: { wrong: 'shape' } }));
    await expect(apiFetch('/collections/1', collectionSchema)).rejects.toMatchObject({
      code: 'contract_error',
    });
  });

  it('refreshes once and retries the original request on a 401', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(401, { error: { code: 'unauthenticated', message: 'expired' } }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { accessToken: 'new-token' } }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { collection_id: 1, slug: 'x' } }));

    const result = await apiFetch('/collections/1', collectionSchema);

    expect(result).toEqual({ collection_id: 1, slug: 'x' });
    expect(getAccessToken()).toBe('new-token');
    expect(fetch).toHaveBeenCalledTimes(3);
    const refreshCall = vi.mocked(fetch).mock.calls[1];
    expect(refreshCall[0]).toContain('/auth/refresh');
    expect(refreshCall[1]).toMatchObject({ credentials: 'include' });
  });

  it('never retries a 401 from /auth/refresh or /auth/login itself', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(401, { error: { code: 'unauthenticated', message: 'bad credentials' } }),
    );
    await expect(
      apiFetch('/auth/login', z.object({ accessToken: z.string() }), {
        method: 'POST',
        body: { email: 'a@example.com', password: 'wrong' },
      }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('runs exactly one refresh for two concurrent 401s (single-flight)', async () => {
    let refreshCalls = 0;
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        refreshCalls += 1;
        return jsonResponse(200, { data: { accessToken: 'new-token' } });
      }
      if (url.includes('/one') || url.includes('/two')) {
        // Every call to these two paths 401s until the token is refreshed.
        return getAccessToken() === 'new-token'
          ? jsonResponse(200, { data: { collection_id: 1, slug: url } })
          : jsonResponse(401, { error: { code: 'unauthenticated', message: 'expired' } });
      }
      throw new Error(`unexpected fetch to ${url}`);
    });

    const [a, b] = await Promise.all([
      apiFetch('/one', collectionSchema),
      apiFetch('/two', collectionSchema),
    ]);

    expect(a.slug).toContain('/one');
    expect(b.slug).toContain('/two');
    expect(refreshCalls).toBe(1);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
npm run test
```

Expected: FAIL — `./apiClient` does not exist.

- [ ] **Step 4: Write the implementation — `frontend/src/lib/apiClient.ts`**

```ts
import type { ZodSchema } from 'zod';

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

let refreshPromise: Promise<string> | null = null;

/**
 * Single-flight: many callers can await the same in-flight refresh instead of
 * each starting their own. docs/frontend-prd.md §5.3.
 */
export async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      setAccessToken(null);
      throw new ApiError(res.status, 'unauthenticated', 'session expired');
    }
    const json = (await res.json()) as { data?: { accessToken?: string } };
    const token = json.data?.accessToken;
    if (!token) {
      throw new ApiError(res.status, 'contract_error', 'refresh response carried no access token');
    }
    setAccessToken(token);
    return token;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  credentials?: 'include';
}

// Only these two routes read the refresh cookie; retrying them on a 401
// would either loop forever or paper over a genuine login failure.
const NO_RETRY_PATHS = new Set(['/auth/refresh', '/auth/login']);

export async function apiFetch<T>(
  path: string,
  schema: ZodSchema<T>,
  options: ApiFetchOptions = {},
): Promise<T> {
  const send = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      credentials: options.credentials,
    });
  };

  let res = await send();

  if (res.status === 401 && !NO_RETRY_PATHS.has(path)) {
    await refreshAccessToken();
    res = await send();
  }

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const code = (json as { error?: { code?: string } } | null)?.error?.code ?? 'internal_error';
    const message =
      (json as { error?: { message?: string } } | null)?.error?.message ?? 'request failed';
    throw new ApiError(res.status, code, message);
  }

  const payload = (json as { data?: unknown } | null)?.data;
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(res.status, 'contract_error', 'response did not match the expected shape');
  }
  return parsed.data;
}
```

- [ ] **Step 5: Add the `VITE_API_BASE` type to `frontend/src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
npm run test
```

Expected: PASS, all 7 cases in `apiClient.test.ts`.

- [ ] **Step 7: Lint and commit**

```bash
npm run lint
git add frontend/
git commit -m "feat(frontend): add the API client with single-flight refresh"
```

---

### Task 4: Route guards and the auth context

**Files:**
- Create: `frontend/src/auth/guards.ts`
- Create: `frontend/src/auth/guards.test.ts`
- Create: `frontend/src/auth/AuthContext.tsx`
- Create: `frontend/src/auth/AuthContext.test.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `refreshAccessToken`, `setAccessToken`, `ApiError` from
  `../lib/apiClient` (Task 3).
- Produces (consumed by Task 7's router and every later phase that needs a role
  check):
  - `export type Role = 'student' | 'teacher' | 'admin'`
  - `export interface AuthUser { userId: number; role: Role; name: string; email: string; isVerified?: boolean }`
  - `export type AuthState = { status: 'loading' } | { status: 'signed-out' } | { status: 'signed-in'; user: AuthUser }`
  - `export type GuardRequirement = 'public' | 'signedIn' | 'teacher' | 'verifiedTeacher' | 'admin'`
  - `export type GuardResult = 'ok' | 'redirect-login' | 'redirect-forbidden'`
  - `export function evaluateGuard(state: AuthState, requirement: GuardRequirement): GuardResult`
  - `export interface AuthContextValue { state: AuthState; ready: Promise<AuthState>; signIn: (accessToken: string) => Promise<void>; signOut: () => Promise<void>; }`
  - `export function AuthProvider({ children }: { children: ReactNode }): JSX.Element`
  - `export function useAuth(): AuthContextValue`

`evaluateGuard` implements the guard table in `docs/frontend-prd.md` §5.4. `ready` is
a promise that resolves with the *final* `AuthState` once the startup check (§5.3
step 1) finishes — Task 7's router guard awaits it to avoid redirecting a signed-in
user to `/login` during the brief window before the silent refresh completes.

- [ ] **Step 1: Write the failing tests — `frontend/src/auth/guards.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { evaluateGuard, type AuthState } from './guards';

const signedOut: AuthState = { status: 'signed-out' };
const loading: AuthState = { status: 'loading' };
const student: AuthState = {
  status: 'signed-in',
  user: { userId: 1, role: 'student', name: 'Amina', email: 'amina@example.com' },
};
const unverifiedTeacher: AuthState = {
  status: 'signed-in',
  user: { userId: 2, role: 'teacher', name: 'Ustadh Kamrul', email: 'k@example.com', isVerified: false },
};
const verifiedTeacher: AuthState = {
  status: 'signed-in',
  user: { userId: 3, role: 'teacher', name: 'Ustadha Fatima', email: 'f@example.com', isVerified: true },
};
const admin: AuthState = {
  status: 'signed-in',
  user: { userId: 4, role: 'admin', name: 'Admin', email: 'admin@example.com' },
};

describe('evaluateGuard', () => {
  it('lets anybody through a public route, signed in or not', () => {
    expect(evaluateGuard(signedOut, 'public')).toBe('ok');
    expect(evaluateGuard(student, 'public')).toBe('ok');
  });

  it('sends a signed-out or still-loading visitor to /login for signedIn', () => {
    expect(evaluateGuard(signedOut, 'signedIn')).toBe('redirect-login');
    expect(evaluateGuard(loading, 'signedIn')).toBe('redirect-login');
    expect(evaluateGuard(student, 'signedIn')).toBe('ok');
  });

  it('lets a teacher or an admin through the teacher guard, refuses a student', () => {
    expect(evaluateGuard(unverifiedTeacher, 'teacher')).toBe('ok');
    expect(evaluateGuard(verifiedTeacher, 'teacher')).toBe('ok');
    expect(evaluateGuard(admin, 'teacher')).toBe('ok');
    expect(evaluateGuard(student, 'teacher')).toBe('redirect-forbidden');
    expect(evaluateGuard(signedOut, 'teacher')).toBe('redirect-login');
  });

  it('requires verification for verifiedTeacher, but waives it for admin', () => {
    expect(evaluateGuard(verifiedTeacher, 'verifiedTeacher')).toBe('ok');
    expect(evaluateGuard(unverifiedTeacher, 'verifiedTeacher')).toBe('redirect-forbidden');
    expect(evaluateGuard(admin, 'verifiedTeacher')).toBe('ok');
    expect(evaluateGuard(student, 'verifiedTeacher')).toBe('redirect-forbidden');
  });

  it('lets only an admin through the admin guard', () => {
    expect(evaluateGuard(admin, 'admin')).toBe('ok');
    expect(evaluateGuard(verifiedTeacher, 'admin')).toBe('redirect-forbidden');
    expect(evaluateGuard(student, 'admin')).toBe('redirect-forbidden');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm run test
```

Expected: FAIL — `./guards` does not exist.

- [ ] **Step 3: Write the implementation — `frontend/src/auth/guards.ts`**

```ts
export type Role = 'student' | 'teacher' | 'admin';

export interface AuthUser {
  userId: number;
  role: Role;
  name: string;
  email: string;
  isVerified?: boolean;
}

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; user: AuthUser };

export type GuardRequirement = 'public' | 'signedIn' | 'teacher' | 'verifiedTeacher' | 'admin';
export type GuardResult = 'ok' | 'redirect-login' | 'redirect-forbidden';

/**
 * docs/frontend-prd.md §5.4. `public` never checks auth state. Every other
 * requirement sends a signed-out (or still-loading) visitor to /login first,
 * then applies the role rule to a signed-in user.
 */
export function evaluateGuard(state: AuthState, requirement: GuardRequirement): GuardResult {
  if (requirement === 'public') return 'ok';
  if (state.status !== 'signed-in') return 'redirect-login';

  const { role, isVerified } = state.user;
  switch (requirement) {
    case 'signedIn':
      return 'ok';
    case 'teacher':
      return role === 'teacher' || role === 'admin' ? 'ok' : 'redirect-forbidden';
    case 'verifiedTeacher':
      return role === 'admin' || (role === 'teacher' && isVerified === true)
        ? 'ok'
        : 'redirect-forbidden';
    case 'admin':
      return role === 'admin' ? 'ok' : 'redirect-forbidden';
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run test
```

Expected: PASS, all 5 cases.

- [ ] **Step 5: Write the failing tests — `frontend/src/auth/AuthContext.test.tsx`**

```tsx
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

vi.mock('../lib/apiClient', async () => {
  const actual = await vi.importActual<typeof import('../lib/apiClient')>('../lib/apiClient');
  return {
    ...actual,
    refreshAccessToken: vi.fn(),
    apiFetch: vi.fn(),
  };
});

import { apiFetch, refreshAccessToken } from '../lib/apiClient';

function Probe() {
  const auth = useAuth();
  if (auth.state.status === 'loading') return <p>loading</p>;
  if (auth.state.status === 'signed-out') return <p>signed out</p>;
  return <p>signed in as {auth.state.user.name}</p>;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.mocked(refreshAccessToken).mockReset();
    vi.mocked(apiFetch).mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it('becomes signed-in when the startup refresh and /auth/me both succeed', async () => {
    vi.mocked(refreshAccessToken).mockResolvedValue('token-1');
    vi.mocked(apiFetch).mockResolvedValue({
      userId: 1,
      role: 'student',
      name: 'Amina',
      email: 'amina@example.com',
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByText('loading')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('signed in as Amina')).toBeInTheDocument());
  });

  it('becomes signed-out when the startup refresh fails', async () => {
    vi.mocked(refreshAccessToken).mockRejectedValue(new Error('no session'));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByText('signed out')).toBeInTheDocument());
  });

  it('resolves `ready` with the final state exactly once', async () => {
    vi.mocked(refreshAccessToken).mockRejectedValue(new Error('no session'));
    let capturedReady: Promise<unknown> | undefined;

    function CaptureReady() {
      const auth = useAuth();
      capturedReady = auth.ready;
      return null;
    }

    render(
      <AuthProvider>
        <CaptureReady />
      </AuthProvider>,
    );

    await waitFor(() => expect(capturedReady).toBeDefined());
    await expect(capturedReady).resolves.toEqual({ status: 'signed-out' });
  });

  it('signOut clears the session even if the logout call fails', async () => {
    vi.mocked(refreshAccessToken).mockResolvedValue('token-1');
    vi.mocked(apiFetch).mockImplementation(async (path: string) => {
      if (path === '/auth/me') {
        return { userId: 1, role: 'student', name: 'Amina', email: 'amina@example.com' };
      }
      throw new Error('logout endpoint unreachable');
    });

    let auth!: ReturnType<typeof useAuth>;
    function Capture() {
      auth = useAuth();
      return <Probe />;
    }

    render(
      <AuthProvider>
        <Capture />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByText('signed in as Amina')).toBeInTheDocument());

    await act(async () => {
      await auth.signOut();
    });

    expect(screen.getByText('signed out')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run the tests to verify they fail**

```bash
npm run test
```

Expected: FAIL — `./AuthContext` does not exist.

- [ ] **Step 7: Write the implementation — `frontend/src/auth/AuthContext.tsx`**

```tsx
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { z } from 'zod';
import { apiFetch, refreshAccessToken, setAccessToken } from '../lib/apiClient';
import type { AuthState } from './guards';

export type { AuthState, AuthUser, Role, GuardRequirement, GuardResult } from './guards';
export { evaluateGuard } from './guards';

const meSchema = z.object({
  userId: z.number(),
  role: z.enum(['student', 'teacher', 'admin']),
  name: z.string(),
  email: z.string(),
  isVerified: z.boolean().optional(),
});

export interface AuthContextValue {
  state: AuthState;
  /** Resolves with the final AuthState once the startup check (§5.3 step 1) finishes. */
  ready: Promise<AuthState>;
  signIn: (accessToken: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  const readyRef = useRef<{ promise: Promise<AuthState>; resolve: (s: AuthState) => void }>();
  if (!readyRef.current) {
    let resolve!: (s: AuthState) => void;
    const promise = new Promise<AuthState>((r) => {
      resolve = r;
    });
    readyRef.current = { promise, resolve };
  }

  async function establishSession(accessToken: string): Promise<void> {
    setAccessToken(accessToken);
    const user = await apiFetch('/auth/me', meSchema);
    setState({ status: 'signed-in', user });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let finalState: AuthState;
      try {
        const accessToken = await refreshAccessToken();
        await establishSession(accessToken);
        finalState = { status: 'signed-in', user: await apiFetch('/auth/me', meSchema) };
      } catch {
        finalState = { status: 'signed-out' };
      }
      if (!cancelled) setState(finalState);
      readyRef.current!.resolve(finalState);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      ready: readyRef.current!.promise,
      signIn: establishSession,
      signOut: async () => {
        try {
          await apiFetch('/auth/logout', z.unknown(), { method: 'POST', credentials: 'include' });
        } catch {
          // Best-effort: the user is signed out locally even if the network call fails.
        } finally {
          setAccessToken(null);
          setState({ status: 'signed-out' });
        }
      },
    }),
    [state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
```

Note the startup effect calls `apiFetch('/auth/me', ...)` twice in a row (once inside
`establishSession`, once to build `finalState`) — fix this before moving on: change
the effect body so it reuses `establishSession`'s result instead of re-fetching.
Rewrite the `try` block as:

```ts
try {
  const accessToken = await refreshAccessToken();
  setAccessToken(accessToken);
  const user = await apiFetch('/auth/me', meSchema);
  finalState = { status: 'signed-in', user };
  setState(finalState);
} catch {
  finalState = { status: 'signed-out' };
}
```

and delete the separate call to `establishSession` from inside the effect (keep
`establishSession` itself — `signIn` still uses it). This avoids the duplicate
network call and keeps one code path responsible for turning an access token into a
signed-in state.

- [ ] **Step 8: Run the tests to verify they pass**

```bash
npm run test
```

Expected: PASS, all 4 cases in `AuthContext.test.tsx`, and all 5 in `guards.test.ts`.

- [ ] **Step 9: Lint and commit**

```bash
npm run lint
git add frontend/
git commit -m "feat(frontend): add route guards and the auth context"
```

---

### Task 5: The theme switch

**Files:**
- Create: `frontend/src/app/theme.ts`
- Create: `frontend/src/app/theme.test.ts`
- Create: `frontend/src/app/ThemeSwitch.tsx`
- Create: `frontend/src/app/ThemeSwitch.module.css`
- Create: `frontend/src/app/ThemeSwitch.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces (consumed by Task 6's `Shell`):
  - `export type Theme = 'light' | 'dark'`
  - `export function getStoredTheme(): Theme | null`
  - `export function setStoredTheme(theme: Theme): void`
  - `export function applyTheme(theme: Theme): void` — sets `data-theme` on
    `document.documentElement`.
  - `export function ThemeSwitch(): JSX.Element`

Light (`1c`) is the default; dark (`2a`) is a reader's explicit choice the app
remembers, never an auto-switch by time of day (`docs/design/DESIGN.md` §0). If
nothing is stored, the switch's initial pressed state follows the OS preference via
`prefers-color-scheme` (already handled by `tokens.css`'s media query) without
writing anything to storage — storage only happens once the reader clicks a button.

- [ ] **Step 1: Write the failing tests — `frontend/src/app/theme.test.ts`**

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyTheme, getStoredTheme, setStoredTheme } from './theme';

describe('theme storage', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('returns null when nothing is stored', () => {
    expect(getStoredTheme()).toBeNull();
  });

  it('round-trips a stored theme', () => {
    setStoredTheme('dark');
    expect(getStoredTheme()).toBe('dark');
  });

  it('ignores a corrupted stored value', () => {
    window.localStorage.setItem('ilham-theme', 'sepia');
    expect(getStoredTheme()).toBeNull();
  });

  it('applyTheme sets data-theme on the document element', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm run test
```

Expected: FAIL — `./theme` does not exist.

- [ ] **Step 3: Write the implementation — `frontend/src/app/theme.ts`**

```ts
export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'ilham-theme';

export function getStoredTheme(): Theme | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === 'light' || raw === 'dark' ? raw : null;
}

export function setStoredTheme(theme: Theme): void {
  window.localStorage.setItem(STORAGE_KEY, theme);
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

export function detectSystemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run test
```

Expected: PASS, all 4 cases.

- [ ] **Step 5: Write the failing test — `frontend/src/app/ThemeSwitch.test.tsx`**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThemeSwitch } from './ThemeSwitch';

describe('ThemeSwitch', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('marks 1c pressed by default and persists a click on 2a', () => {
    render(<ThemeSwitch />);
    const light = screen.getByRole('button', { name: '1c' });
    const dark = screen.getByRole('button', { name: '2a' });
    expect(light).toHaveAttribute('aria-pressed', 'true');
    expect(dark).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(dark);

    expect(dark).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('ilham-theme')).toBe('dark');
  });

  it('is a labelled group of two buttons, not a checkbox', () => {
    render(<ThemeSwitch />);
    expect(screen.getByRole('group', { name: 'Ground' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

```bash
npm run test
```

Expected: FAIL — `./ThemeSwitch` does not exist.

- [ ] **Step 7: Write `frontend/src/app/ThemeSwitch.module.css`**

```css
.seg {
  display: inline-flex;
  border: var(--bw) solid var(--rule);
  border-radius: var(--r-chip);
  overflow: hidden;
}

.seg button {
  font-family: var(--font-en);
  font-size: var(--fs-label);
  font-weight: 600;
  letter-spacing: var(--track-label);
  padding: var(--sp-1) var(--sp-2);
  min-height: 32px;
  border: 0;
  cursor: pointer;
  background: var(--rail);
  color: var(--ink-app);
}

.seg button + button {
  border-inline-start: var(--bw) solid var(--rule);
}

.seg button[aria-pressed='true'] {
  background: var(--ink);
  color: var(--ground);
}
```

- [ ] **Step 8: Write the implementation — `frontend/src/app/ThemeSwitch.tsx`**

```tsx
import { useState } from 'react';
import styles from './ThemeSwitch.module.css';
import { applyTheme, detectSystemTheme, getStoredTheme, setStoredTheme, type Theme } from './theme';

export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme() ?? detectSystemTheme());

  function choose(next: Theme) {
    setTheme(next);
    setStoredTheme(next);
    applyTheme(next);
  }

  return (
    <div className={styles.seg} role="group" aria-label="Ground">
      <button type="button" aria-pressed={theme === 'light'} onClick={() => choose('light')}>
        1c
      </button>
      <button type="button" aria-pressed={theme === 'dark'} onClick={() => choose('dark')}>
        2a
      </button>
    </div>
  );
}
```

- [ ] **Step 9: Run the tests to verify they pass**

```bash
npm run test
```

Expected: PASS, both cases.

- [ ] **Step 10: Lint and commit**

```bash
npm run lint
git add frontend/
git commit -m "feat(frontend): add the light/dark theme switch"
```

---

### Task 6: The app shell

**Files:**
- Create: `frontend/src/app/Shell.tsx`
- Create: `frontend/src/app/Shell.module.css`
- Create: `frontend/src/app/Shell.test.tsx`

**Interfaces:**
- Consumes: `ThemeSwitch` from `./ThemeSwitch` (Task 5).
- Produces (consumed by Task 7's `__root.tsx`):
  - `export function Shell({ children }: { children: ReactNode }): JSX.Element`

This builds the sticky top bar and the `#main` landmark from
`docs/design/demo.html`'s `.shell`/`.topbar` (lines 85–149), translated into a CSS
Module. It deliberately ships **no destination links yet** — `docs/frontend-prd.md`
§6 lists routes (Collections, Search, Narrators, Analytics, Sets, Circles, Notes,
...) that do not exist in this repository until later phases, and TanStack Router's
typed `<Link>` fails to compile against a route that is not in the generated route
tree. Each later phase's plan appends its own `<nav>` group to this file as its
routes land — see the Roadmap at the end of this document. What ships now (skip
link, brand, theme switch, `#main` landmark with correct focus behaviour) is real
and complete, not a stub.

- [ ] **Step 1: Write the failing test — `frontend/src/app/Shell.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Shell } from './Shell';

describe('Shell', () => {
  it('renders a skip link that targets #main', () => {
    render(
      <Shell>
        <p>content</p>
      </Shell>,
    );
    const skip = screen.getByText('Skip to content');
    expect(skip).toHaveAttribute('href', '#main');
  });

  it('renders its children inside a focusable #main landmark', () => {
    render(
      <Shell>
        <p>page content</p>
      </Shell>,
    );
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main');
    expect(main).toHaveAttribute('tabIndex', '-1');
    expect(screen.getByText('page content')).toBeInTheDocument();
  });

  it('shows the brand in English and Arabic', () => {
    render(
      <Shell>
        <p>content</p>
      </Shell>,
    );
    expect(screen.getByText('Ilham')).toBeInTheDocument();
    expect(screen.getByText('إلهام')).toHaveAttribute('dir', 'rtl');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm run test
```

Expected: FAIL — `./Shell` does not exist.

- [ ] **Step 3: Write `frontend/src/app/Shell.module.css`**

```css
.skip {
  position: absolute;
  inset-inline-start: -9999px;
}
.skip:focus {
  inset-inline-start: var(--sp-2);
  top: var(--sp-2);
  z-index: 9;
  background: var(--ground);
  border: 2px solid var(--ink);
  padding: var(--sp-1) var(--sp-2);
}

.shell {
  position: sticky;
  top: 0;
  z-index: 5;
  background: var(--ground);
  border-bottom: var(--bw) solid var(--rule);
}

.topbar {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  padding: var(--sp-2) var(--sp-3);
}

.brand {
  font-size: var(--fs-rail);
  font-weight: 600;
  display: flex;
  align-items: baseline;
  gap: var(--sp-1);
}
.brand .ar {
  font-family: var(--font-ar);
  font-size: 1.25rem;
  font-weight: 400;
}

.spacer {
  margin-inline-start: auto;
}

.main {
  padding: var(--sp-4) var(--sp-3) var(--sp-5);
  max-width: 76rem;
  margin-inline: auto;
}
.main:focus {
  outline: none;
}
```

- [ ] **Step 4: Write the implementation — `frontend/src/app/Shell.tsx`**

```tsx
import type { ReactNode } from 'react';
import styles from './Shell.module.css';
import { ThemeSwitch } from './ThemeSwitch';

export function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <span className={styles.brand}>
            Ilham{' '}
            <span className="ar" dir="rtl">
              إلهام
            </span>
          </span>
          <span className={styles.spacer} />
          <ThemeSwitch />
        </header>
        {/* Destination nav groups (Corpus, Study, ...) are added here, one
            <nav aria-label="..."> per group, as each phase's routes land.
            See the Roadmap in docs/superpowers/plans/2026-09-05-frontend-foundation.md. */}
      </div>
      <main id="main" tabIndex={-1} className={styles.main}>
        {children}
      </main>
    </>
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npm run test
```

Expected: PASS, all 3 cases.

- [ ] **Step 6: Lint and commit**

```bash
npm run lint
git add frontend/
git commit -m "feat(frontend): add the app shell"
```

---

### Task 7: TanStack Router, TanStack Query, and wiring it all together

**Files:**
- Modify: `frontend/package.json` (add router, query, and their dev dependencies)
- Modify: `frontend/vite.config.ts` (add the TanStack Router plugin)
- Create: `frontend/src/router.tsx`
- Create: `frontend/src/routes/__root.tsx`
- Create: `frontend/src/routes/login.tsx`
- Create: `frontend/src/routes/_authed.tsx`
- Create: `frontend/src/routes/_authed/index.tsx`
- Create: `frontend/src/routes/router-guard.test.tsx`
- Create: `frontend/src/routeTree.gen.ts` (generated, then committed)
- Modify: `frontend/src/main.tsx` (replace the Task-1 placeholder render)
- Delete: `frontend/src/App.tsx`, `frontend/src/App.test.tsx` (superseded by routes)

**Interfaces:**
- Consumes: `Shell` (Task 6), `AuthProvider`/`useAuth`/`AuthContextValue` (Task 4),
  `evaluateGuard` (Task 4).
- Produces: the running application. Every later phase adds route files under
  `src/routes/` and, per Task 6's note, a `<nav>` group in `Shell.tsx`.

- [ ] **Step 1: Install the router and query packages**

```bash
cd frontend && npm install @tanstack/react-router@^1.79.0 @tanstack/react-query@^5.59.0
npm install -D @tanstack/router-plugin@^1.79.0 @tanstack/router-devtools@^1.79.0
```

- [ ] **Step 2: Add the router plugin to `frontend/vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/vite';

export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
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
```

- [ ] **Step 3: Write `frontend/src/routes/__root.tsx`**

```tsx
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { Shell } from '../app/Shell';
import type { AuthContextValue } from '../auth/AuthContext';

export interface RouterContext {
  auth: AuthContextValue;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: NotFound,
});

function RootComponent() {
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
}

function NotFound() {
  return (
    <div>
      <h1>That page does not exist</h1>
      <p>
        <a href="/">Return home.</a>
      </p>
    </div>
  );
}
```

(The Browse phase updates `NotFound`'s copy to point at `/collections`, per
`docs/frontend-prd.md` §7.25, once that route exists.)

- [ ] **Step 4: Write `frontend/src/router.tsx`**

```tsx
import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import type { AuthContextValue } from './auth/AuthContext';

export const router = createRouter({
  routeTree,
  context: { auth: undefined as unknown as AuthContextValue },
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
```

- [ ] **Step 5: Write `frontend/src/routes/login.tsx`**

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ redirect: z.string().optional() }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  return (
    <div>
      <h1>Sign in</h1>
      <p>The sign-in form lands in the Authentication phase.</p>
      {redirect ? <p>After you sign in, you return to {redirect}.</p> : null}
    </div>
  );
}
```

- [ ] **Step 6: Write `frontend/src/routes/_authed.tsx`**

```tsx
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { evaluateGuard } from '../auth/guards';

export const Route = createFileRoute('/_authed')({
  beforeLoad: async ({ context, location }) => {
    const resolvedState =
      context.auth.state.status === 'loading' ? await context.auth.ready : context.auth.state;
    if (evaluateGuard(resolvedState, 'signedIn') === 'redirect-login') {
      throw redirect({ to: '/login', search: { redirect: location.href } });
    }
  },
  component: () => <Outlet />,
});
```

- [ ] **Step 7: Write `frontend/src/routes/_authed/index.tsx`**

```tsx
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/')({
  component: HomeStub,
});

function HomeStub() {
  return <p>You are signed in. The collections index lands in the Browse phase.</p>;
}
```

(The Browse phase replaces `HomeStub` with `beforeLoad: () => { throw redirect({ to: '/collections' }) }`,
per `docs/frontend-prd.md` §6's `/ → redirect to /collections` row.)

- [ ] **Step 8: Generate the route tree**

```bash
npm run build
```

This runs the TanStack Router plugin, which writes `frontend/src/routeTree.gen.ts`
from the four route files above. Expected: the build succeeds and
`src/routeTree.gen.ts` now exists with a non-trivial `routeTree` export. Commit this
generated file — see the note below Step 12.

- [ ] **Step 9: Write the failing tests — `frontend/src/routes/router-guard.test.tsx`**

```tsx
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AuthContextValue } from '../auth/AuthContext';
import type { AuthState } from '../auth/guards';
import { routeTree } from '../routeTree.gen';

function fakeAuth(state: AuthState): AuthContextValue {
  return {
    state,
    ready: Promise.resolve(state),
    signIn: async () => {},
    signOut: async () => {},
  };
}

describe('the signedIn guard', () => {
  it('redirects an unauthenticated visitor from / to /login', async () => {
    const history = createMemoryHistory({ initialEntries: ['/'] });
    const router = createRouter({
      routeTree,
      history,
      context: { auth: fakeAuth({ status: 'signed-out' }) },
    });
    render(<RouterProvider router={router} />);

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('lets a signed-in visitor reach the authenticated home', async () => {
    const history = createMemoryHistory({ initialEntries: ['/'] });
    const router = createRouter({
      routeTree,
      history,
      context: {
        auth: fakeAuth({
          status: 'signed-in',
          user: { userId: 1, role: 'student', name: 'Amina', email: 'a@example.com' },
        }),
      },
    });
    render(<RouterProvider router={router} />);

    expect(await screen.findByText(/you are signed in/i)).toBeInTheDocument();
  });

  it('shows the not-found page for an unknown path', async () => {
    const history = createMemoryHistory({ initialEntries: ['/nowhere'] });
    const router = createRouter({
      routeTree,
      history,
      context: { auth: fakeAuth({ status: 'signed-out' }) },
    });
    render(<RouterProvider router={router} />);

    expect(await screen.findByText('That page does not exist')).toBeInTheDocument();
  });
});
```

- [ ] **Step 10: Run the tests**

```bash
npm run test
```

Expected: PASS, all 3 cases. (These exercise real route/guard wiring against the
generated `routeTree.gen.ts` from Step 8, with a fake `AuthContextValue` — no network
call happens in this test.)

- [ ] **Step 11: Wire `main.tsx`, remove the Task-1 placeholder**

Delete `frontend/src/App.tsx` and `frontend/src/App.test.tsx`. Replace
`frontend/src/main.tsx` with:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { router } from './router';
import './styles/tokens.css';
import './styles/reset.css';
import './styles/base.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000 },
  },
});

function InnerApp() {
  const auth = useAuth();
  return <RouterProvider router={router} context={{ auth }} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <InnerApp />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
```

- [ ] **Step 12: Run the full test suite and the build, then verify manually**

```bash
npm run test
npm run build
npm run lint
```

Expected: every test from Tasks 1–7 still passes (Task 1's `App.test.tsx` was
deleted in this step, so the total count drops by one; every other file's tests
still run). The build succeeds.

```bash
npm run dev
```

Open the app. Expected: it redirects to `/login` and shows "Sign in" (there is no
backend running yet, so the silent refresh in `AuthProvider` fails immediately and
`state` becomes `signed-out`, which the guard sends to `/login` — this is correct
behaviour, not a bug). Navigate to an unknown path like `/nowhere` and confirm the
not-found page renders.

Commit `frontend/src/routeTree.gen.ts` alongside the route files that produced it —
**do not** add it to `.gitignore`. This keeps `npm test` and `npm run build`
reproducible for the next person without requiring them to run `vite dev` first. The
router plugin regenerates and overwrites this file automatically whenever a route
file changes and either `npm run dev` or `npm run build` runs; treat it like a
lockfile and commit the updated version alongside route changes.

- [ ] **Step 13: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): wire TanStack Router, TanStack Query, and the guarded route tree"
```

---

### Task 8: Docker — three services, end to end

**Files:**
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`
- Create: `frontend/nginx.conf`
- Create: `frontend/.dockerignore`
- Modify: `compose.yaml` (add `api` and `web` services)

**Interfaces:**
- Consumes: nothing from earlier tasks except the built `frontend/dist` output.
- Produces: `docker compose up -d` (or `podman compose up -d`) brings up all three
  services frontend-prd D11 asks for.

`backend/Dockerfile` containers the **current** Hono scaffold exactly as it stands —
this is a mechanical packaging step, not a change to backend logic or scope, and it
is necessary because `frontend/compose.yaml`'s `web` service depends on an `api`
service that does not exist in `compose.yaml` yet. When the Express rewrite from
`docs/backend-prd.md` replaces `backend/src/`, this Dockerfile keeps working
unmodified: it only runs `npm ci`, `npm run build`, and `npm start`, whatever those
scripts happen to do.

- [ ] **Step 1: Write `backend/Dockerfile`**

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

- [ ] **Step 2: Write `frontend/.dockerignore`**

```
node_modules
dist
.env
```

- [ ] **Step 3: Write `frontend/Dockerfile`**

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- [ ] **Step 4: Write `frontend/nginx.conf`**

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://api:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 5: Add the `api` and `web` services to `compose.yaml`**

Add these two service blocks under `services:`, after the existing `etl` block and
before the top-level `volumes:` key:

```yaml
  api:
    build: ./backend
    container_name: ilham-api
    depends_on:
      db:
        condition: service_healthy
    environment:
      PGHOST: db
      PGPORT: "5432"
      PGDATABASE: ilham
      PGUSER: ilham_app
      PGPASSWORD: ilham
      PORT: "3000"
    ports:
      - "127.0.0.1:3000:3000"

  web:
    build: ./frontend
    container_name: ilham-web
    depends_on:
      - api
    ports:
      - "8080:80"
```

- [ ] **Step 6: Verify the images build**

```bash
docker compose build api web
```

Expected: both images build without error. (This does not require `db` to be
running — `build` only compiles the images.)

- [ ] **Step 7: Verify the full stack**

```bash
docker compose up -d db api web
```

Wait for `db` to report healthy (`docker compose ps`), then:

```bash
curl -s http://localhost:8080/api/collections | head -c 200
```

Expected: JSON output (the current Hono scaffold's bare array of collections),
proving nginx's `/api` proxy reaches the `api` container, which reaches `db`.

Open `http://localhost:8080` in a browser and confirm the app loads and redirects to
`/login` — the same behaviour as Task 7's dev-server check, now served entirely from
containers with no `npm run dev` involved.

```bash
docker compose down
```

- [ ] **Step 8: Commit**

```bash
git add backend/Dockerfile frontend/Dockerfile frontend/nginx.conf frontend/.dockerignore compose.yaml
git commit -m "feat: containerize the frontend and the api behind nginx"
```

---

### Task 9: The CI check for §4.2 (no raw literal outside Layer 0)

**Files:**
- Create: `frontend/scripts/check-token-literals.mjs`
- Create: `frontend/scripts/check-token-literals.test.ts`
- Modify: `frontend/vite.config.ts` (already includes `scripts/**/*.test.ts` from
  Task 1 — no change needed, this task just adds the file the glob picks up)

**Interfaces:**
- Consumes: nothing from earlier tasks (it reads files from disk at run time).
- Produces: `npm run check:tokens` (already declared in Task 1's `package.json`), an
  executable that exits non-zero on a raw colour or non-border-width `px` literal
  found under `src/ui`, `src/domain`, `src/routes`, or `src/app`.

This is `docs/frontend-prd.md` §13's "one CI check for §4.2: no colour or size
literal outside Layer 0." It scans `.css`/`.module.css` files, not `.tsx` inline
styles — Task 2's `App.tsx` inline-style proof was deleted in Task 7, so there is
nothing left in the tree for this check to (correctly) flag today.

- [ ] **Step 1: Write the failing tests — `frontend/scripts/check-token-literals.test.ts`**

```ts
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(new URL('./check-token-literals.mjs', import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

let tempDir: string | undefined;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

function runAgainst(srcDir: string) {
  return execFileSync('node', [SCRIPT], {
    env: { ...process.env, TOKEN_CHECK_SRC_DIR: srcDir },
    encoding: 'utf8',
  });
}

describe('check-token-literals', () => {
  it('passes over the real src tree today', () => {
    expect(() => execFileSync('node', [SCRIPT], { cwd: REPO_ROOT })).not.toThrow();
  });

  it('fails on a raw hex colour outside a border rule', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'token-check-'));
    const uiDir = join(tempDir, 'ui');
    mkdirSync(uiDir);
    writeFileSync(join(uiDir, 'Button.module.css'), '.button { color: #ff0000; }\n');

    expect(() => runAgainst(tempDir!)).toThrow();
  });

  it('fails on a raw px value outside a border rule', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'token-check-'));
    const domainDir = join(tempDir, 'domain');
    mkdirSync(domainDir);
    writeFileSync(join(domainDir, 'Chain.module.css'), '.row { padding: 12px; }\n');

    expect(() => runAgainst(tempDir!)).toThrow();
  });

  it('allows a literal border-width', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'token-check-'));
    const routesDir = join(tempDir, 'routes');
    mkdirSync(routesDir);
    writeFileSync(join(routesDir, 'page.module.css'), '.card { border: 1px solid var(--rule); }\n');

    expect(() => runAgainst(tempDir!)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm run test
```

Expected: FAIL — `check-token-literals.mjs` does not exist.

- [ ] **Step 3: Write the implementation — `frontend/scripts/check-token-literals.mjs`**

```js
#!/usr/bin/env node
// Enforces docs/frontend-prd.md §4.2: no raw colour, size, space, radius, or
// duration literal outside Layer 0 (frontend/src/styles/tokens.css). A
// literal border-width (e.g. "1px solid") is the one allowed exception.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = fileURLToPath(new URL('../src', import.meta.url));
const ROOT = process.env.TOKEN_CHECK_SRC_DIR ?? DEFAULT_ROOT;
const SCAN_DIRS = ['ui', 'domain', 'routes', 'app'];

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/;
const RGB_RE = /\brgba?\(/i;
const PX_RE = /(?<![\w-])\d+(?:\.\d+)?px\b/;
const BORDER_LINE_RE = /border(-width)?\s*:/i;

function walk(dir, files = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, files);
    else if (extname(entry) === '.css') files.push(full);
  }
  return files;
}

function checkFile(path) {
  const lines = readFileSync(path, 'utf8').split('\n');
  const violations = [];
  lines.forEach((line, i) => {
    if (HEX_RE.test(line) || RGB_RE.test(line)) {
      violations.push({ line: i + 1, text: line.trim(), reason: 'raw colour literal' });
      return;
    }
    if (PX_RE.test(line) && !BORDER_LINE_RE.test(line)) {
      violations.push({ line: i + 1, text: line.trim(), reason: 'raw px literal outside a border width' });
    }
  });
  return violations;
}

function main() {
  const files = SCAN_DIRS.flatMap((dir) => walk(join(ROOT, dir)));

  let failed = false;
  for (const file of files) {
    for (const v of checkFile(file)) {
      failed = true;
      console.error(`${file}:${v.line}: ${v.reason} — ${v.text}`);
    }
  }

  if (failed) {
    console.error('\nToken check failed: use var(--token) from src/styles/tokens.css instead.');
    process.exit(1);
  }
  console.log(`Token check passed (${files.length} CSS files scanned under ${ROOT}).`);
}

main();
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run test
```

Expected: PASS, all 4 cases.

- [ ] **Step 5: Run the check against the real tree directly**

```bash
npm run check:tokens
```

Expected: `Token check passed (N CSS files scanned under .../frontend/src)`, where N
is however many `.css`/`.module.css` files exist under `src/ui`, `src/domain`,
`src/routes`, and `src/app` today (only `ThemeSwitch.module.css` and
`Shell.module.css` from Tasks 5–6, since `src/ui`, `src/domain`, and `src/routes`
hold no CSS files yet).

- [ ] **Step 6: Lint and commit**

```bash
npm run lint
git add frontend/
git commit -m "feat(frontend): add the token-literal CI check for §4.2"
```

---

## Self-review

**Spec coverage against `docs/frontend-prd.md` §14 item 1** ("Vite, TypeScript,
Biome, TanStack Router, `tokens.css`, the shell, the API client, and the guards"):

- Vite + TypeScript + Biome → Task 1.
- `tokens.css` (+ reset/base) → Task 2.
- The API client → Task 3.
- The guards → Task 4 (`evaluateGuard`), wired into the router in Task 7.
- The shell → Task 6 (plus the theme switch it composes, Task 5).
- TanStack Router → Task 7.
- Additionally covered, because the spec requires them project-wide from day one:
  D11's three Docker services (Task 8) and §13's CI literal check (Task 9).

**Placeholder scan:** no `TBD`, no "add appropriate error handling," no
"similar to Task N" cross-references without inline code. The one deliberately
incomplete surface — `Shell`'s empty nav and `_authed/index.tsx`'s stub body — is
called out explicitly as scoped to later phases, with the exact code each later
phase substitutes, not left as an unspecified TODO.

**Type consistency:** `AuthState`/`AuthUser`/`Role`/`GuardRequirement`/`GuardResult`
are defined once in `src/auth/guards.ts` and re-exported (not redefined) from
`src/auth/AuthContext.tsx`; `AuthContextValue` is defined once in `AuthContext.tsx`
and imported everywhere else (`router.tsx`, `__root.tsx`'s `RouterContext`,
`_authed.tsx`, the test files) rather than redeclared. `apiFetch`'s signature
(`path`, `schema`, `options`) is identical across Task 3's implementation and every
call site added in Task 4.

---

## Roadmap — phases 2 through 8 (not built by this plan)

Each of these becomes its own plan document, written when its turn comes, per
`docs/frontend-prd.md` §14:

2. **Layer 1 primitives** — Button, Input, Field, Chip, Tag, Table, Dialog, Toast,
   Pager, Slider, in `src/ui/`. No Card. The Pager's copy needs a decision this plan
   deliberately did not make: `docs/backend-prd.md` §2.5 has every list response
   carry `page.total`, while `docs/frontend-prd.md` §7.24 and `docs/design/DESIGN.md`
   §6 both say "no list endpoint returns a total count... never 'page 3 of 47'."
   Resolve this with whoever owns the backend split before building `Pager`.
3. **Authentication** — the real `/login` and `/register` forms (replacing Task 7's
   stubs), the unverified-teacher waiting banner (§7.3), and connecting `AuthContext`
   to a real `POST /auth/login`. This is the first phase that needs the real Express
   backend from `docs/backend-prd.md` (week 3 gate) to test end to end — until then,
   this phase's own plan should scope what it can build and unit-test against mocks
   versus what waits on the backend.
4. **Hadith detail** — the signature page (`docs/design/demo.html` implements it).
   The only page with a complete read endpoint today, once `GET /hadiths/:id` is
   extended per `docs/backend-prd.md` §5.3's response shape (grouped chains,
   `chain_strength_basis`) — the current `backend/` scaffold returns a flat
   `isnadChain` array, not the grouped-by-`sanad_no` shape that page needs.
5. **Browse** — Collections, chapters, and the hadith list. This is where
   `_authed/index.tsx`'s stub becomes a real redirect to `/collections`, and where
   `Shell.tsx` gets its first `<nav aria-label="Corpus">` group.
6. **The study loop** — Sets, circles, assignments, the review runner. Needs
   `POST /assignments` (calls `app.assign_study_set`) and the review-session
   transaction from `docs/backend-prd.md` §5.8–§5.9.
7. **Analytics** — Q1, Q2, Q3, Q5, Q6. Needs `db/06_queries.sql` (the six analytics
   views/function) — per `docs/backend-prd.md` §5.5, this "does not exist yet" as of
   this plan.
8. **Narrators and search** — last, deliberately, per `docs/frontend-prd.md` §14: it
   needs both a new `GET /narrators?q=` endpoint and `db/06_search.sql`'s trigram
   index (`docs/frontend-prd.md` §8.3). This is explicitly "the safest work to leave
   unfinished" if the schedule runs out.

## Execution options

Plan complete and saved to `docs/superpowers/plans/2026-09-05-frontend-foundation.md`.
Two ways to execute it:

1. **Subagent-driven (recommended)** — a fresh subagent per task, with a review
   checkpoint between tasks, fast iteration.
2. **Inline execution** — run through the tasks in this session, batched with
   checkpoints for you to review.

Which approach do you want?
