# Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the `q=undefined` search bug, apply the existing design system (tokens, `Card`/`PageHeader`/`Menu` primitives) to every bare-list page, fetch and show English hadith text ahead of Arabic, replace the flat topbar with dropdown menus (adding a real `/settings` route), and replace the raw-ID note field and bare circle list with usable, styled UI.

**Architecture:** Two new generic `ui/` primitives (`Card`, `PageHeader`) absorb every "bare `<ul><li>`" page. One new `ui/Menu` primitive (trigger button + `role="menu"` popover, keyboard-navigable) replaces the flat topbar links in `Shell.tsx` with three dropdowns. One backend query change (`LEFT JOIN corpus.hadith_translations`) and one `HadithList` change carry English text through the hadith list and search. Everything else is presentation wired to data the API already returns.

**Tech Stack:** React 18, TanStack Router (file-based routes, codegen'd `routeTree.gen.ts`), TanStack Query, Zod, CSS Modules on hand-rolled design tokens (`frontend/src/styles/tokens.css`), Vitest + Testing Library (frontend), Express + `node:test` + `supertest` + `pg` against a real seeded Postgres corpus (backend).

**Spec:** `docs/superpowers/specs/2026-09-24-frontend-redesign-design.md`

## Global Constraints

- English leads, Arabic follows, everywhere both exist — except chapter titles, which stay Arabic-only (no `title_en` column exists on `corpus.chapters`; out of scope, confirmed against `db/01_corpus.sql`).
- No new npm dependencies. Every fix in this plan is buildable with what `frontend/package.json` and `backend/package.json` already list.
- Extend `frontend/src/styles/tokens.css`'s existing tokens; never hardcode a color, size, or font that has a token.
- Follow the CSS Modules convention already used throughout `frontend/src/ui/*` and `frontend/src/domain/*`: one `.tsx`, one `.module.css`, one `index.ts` re-export, per component.
- Backend list/search queries stay parameterized (`$1`, `$2`, …) — never string-interpolate a value into SQL.
- `corpus` schema is read-only at runtime (per `CLAUDE.md`); every backend change in this plan is a `SELECT`-only query change, never a write path.

---

## File Structure

New files:
- `frontend/src/ui/Card/{Card.tsx,Card.module.css,index.ts}` — bordered block, replaces bare `<li>`.
- `frontend/src/ui/PageHeader/{PageHeader.tsx,PageHeader.module.css,index.ts}` — page title + optional trailing content, replaces bare `<h1>`.
- `frontend/src/ui/Menu/{Menu.tsx,Menu.module.css,index.ts}` — dropdown trigger + popover, `MenuButton`/`MenuText` helpers.
- `frontend/src/routes/_authed/settings.tsx` (+ `.test.tsx`) — new route, holds the theme switch.
- `frontend/src/domain/HadithPicker/{HadithPicker.tsx,HadithPicker.module.css,index.ts}` — type-ahead hadith search used by the notes form.

Modified files (existing responsibility unchanged, markup/query updated):
- `backend/src/modules/hadiths/hadiths.model.ts`, `hadiths.interface.ts` — add the translation join.
- `backend/src/corpus.test.ts` — new assertions for the joined field.
- `frontend/src/routes/_authed/search.tsx`, `frontend/src/routes/_authed/narrators/index.tsx` — fix the `q` schema.
- `frontend/src/domain/HadithList/{HadithList.tsx,HadithList.module.css}` (+ new test) — English-first row.
- `frontend/src/routes/_authed/collections/{index.tsx,$slug.tsx}` (+ new CSS modules) — `Card`/`PageHeader`.
- `frontend/src/app/{Shell.tsx,Shell.module.css,Shell.test.tsx,Shell.role.test.tsx}` — dropdown nav.
- `frontend/src/routes/_authed/circles/index.tsx` (+ new CSS module) — `Card` list.
- `frontend/src/routes/_authed/notes/index.tsx` (+ new CSS module) — `HadithPicker` instead of a raw ID field.

---

### Task 1: Fix the `q=undefined` search bug

**Files:**
- Modify: `frontend/src/routes/_authed/search.tsx:21`
- Modify: `frontend/src/routes/_authed/narrators/index.tsx:21`
- Test: `frontend/src/routes/_authed/search.test.tsx` (new)
- Test: `frontend/src/routes/_authed/narrators/index.test.tsx` (new)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — both routes' `q` search param is now `''` (never the string `"undefined"`) when the URL carries no `q`.

**Root cause:** `z.coerce.string()` calls `String(value)` before validating. `String(undefined)` is the valid string `"undefined"`, so `.catch('')` never fires — the schema does not fail, it just produces the wrong string.

- [ ] **Step 1: Write the failing test for `/search`**

```tsx
// frontend/src/routes/_authed/search.test.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AuthContextValue } from '../../auth/AuthContext';
import { AuthContext } from '../../auth/AuthContext';
import { routeTree } from '../../routeTree.gen';

vi.mock('../../lib/apiClient', async () => {
  const actual = await vi.importActual<typeof import('../../lib/apiClient')>('../../lib/apiClient');
  return { ...actual, apiFetch: vi.fn() };
});

import { apiFetch } from '../../lib/apiClient';

function renderSearch(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const auth: AuthContextValue = {
    state: {
      status: 'signed-in',
      user: { user_id: 1, role: 'student', full_name: 'Amina', email: 'a@example.com' },
    },
    ready: Promise.resolve({
      status: 'signed-in',
      user: { user_id: 1, role: 'student', full_name: 'Amina', email: 'a@example.com' },
    }),
    signIn: async () => {},
    signOut: async () => {},
  };
  const history = createMemoryHistory({ initialEntries: [path] });
  const router = createRouter({ routeTree, history, context: { auth } });
  return render(
    <AuthContext.Provider value={auth}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

describe('Search page', () => {
  it('renders an empty query box, not the literal string "undefined", when the URL carries no q', async () => {
    renderSearch('/search');
    const input = await screen.findByLabelText(/search the arabic text/i);
    expect(input).toHaveValue('');
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npx vitest run src/routes/_authed/search.test.tsx`
Expected: FAIL — `input` has value `"undefined"`, not `""`.

- [ ] **Step 3: Fix the schema**

In `frontend/src/routes/_authed/search.tsx:21`, change:

```ts
const searchParamsSchema = z.object({ q: z.coerce.string().catch(''), offset: z.number().catch(0) });
```

to:

```ts
const searchParamsSchema = z.object({ q: z.string().catch(''), offset: z.number().catch(0) });
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd frontend && npx vitest run src/routes/_authed/search.test.tsx`
Expected: PASS

- [ ] **Step 5: Write the failing test for `/narrators`**

```tsx
// frontend/src/routes/_authed/narrators/index.test.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AuthContextValue } from '../../../auth/AuthContext';
import { AuthContext } from '../../../auth/AuthContext';
import { routeTree } from '../../../routeTree.gen';

vi.mock('../../../lib/apiClient', async () => {
  const actual =
    await vi.importActual<typeof import('../../../lib/apiClient')>('../../../lib/apiClient');
  return { ...actual, apiFetch: vi.fn() };
});

import { apiFetch } from '../../../lib/apiClient';

function renderNarrators(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const auth: AuthContextValue = {
    state: {
      status: 'signed-in',
      user: { user_id: 1, role: 'student', full_name: 'Amina', email: 'a@example.com' },
    },
    ready: Promise.resolve({
      status: 'signed-in',
      user: { user_id: 1, role: 'student', full_name: 'Amina', email: 'a@example.com' },
    }),
    signIn: async () => {},
    signOut: async () => {},
  };
  const history = createMemoryHistory({ initialEntries: [path] });
  const router = createRouter({ routeTree, history, context: { auth } });
  return render(
    <AuthContext.Provider value={auth}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

describe('Narrator list page', () => {
  it('renders an empty query box, not the literal string "undefined", when the URL carries no q', async () => {
    renderNarrators('/narrators');
    const input = await screen.findByLabelText(/search narrator names/i);
    expect(input).toHaveValue('');
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cd frontend && npx vitest run src/routes/_authed/narrators/index.test.tsx`
Expected: FAIL

- [ ] **Step 7: Fix the schema**

In `frontend/src/routes/_authed/narrators/index.tsx:21`, apply the identical change:

```ts
const searchParamsSchema = z.object({ q: z.string().catch(''), offset: z.number().catch(0) });
```

- [ ] **Step 8: Run both tests to verify they pass**

Run: `cd frontend && npx vitest run src/routes/_authed/search.test.tsx src/routes/_authed/narrators/index.test.tsx`
Expected: PASS

- [ ] **Step 9: Run the full frontend suite to confirm no regression**

Run: `cd frontend && npm test`
Expected: PASS (same pass count as before, plus these 2 new tests)

- [ ] **Step 10: Commit**

```bash
git add frontend/src/routes/_authed/search.tsx frontend/src/routes/_authed/search.test.tsx \
        frontend/src/routes/_authed/narrators/index.tsx frontend/src/routes/_authed/narrators/index.test.tsx
git commit -m "fix: search and narrator query boxes no longer default to the string undefined"
```

---

### Task 2: Backend — join English hadith text into the list query

**Files:**
- Modify: `backend/src/modules/hadiths/hadiths.model.ts:12-20,47-55`
- Modify: `backend/src/modules/hadiths/hadiths.interface.ts` (no change needed — `HadithListRow` lives only in `hadiths.model.ts`)
- Test: `backend/src/corpus.test.ts` (extends the existing `describe('GET /hadiths', ...)` block)

**Interfaces:**
- Consumes: `corpus.hadith_translations(hadith_id, lang, text_full, source, match_via)` — already exists and is populated (~95.3% coverage per `docs/data-and-etl.md`), read-only.
- Produces: every row from `GET /hadiths` and `GET /hadiths?q=...` now carries `text_en: string | null` alongside the existing `text_plain`.

- [ ] **Step 1: Write the failing test**

Add to the existing `describe('GET /hadiths', ...)` block in `backend/src/corpus.test.ts` (after the `'filters by Arabic full-text q'` test, before the closing `});` at line 193):

```ts
  test('rows carry text_en when an English translation exists for that hadith', async () => {
    const token = await tokenFor('hadiths-text-en');
    const { rows } = await pool.query<{ hadith_id: number }>(
      `SELECT hadith_id FROM corpus.hadith_translations WHERE lang = 'en' ORDER BY hadith_id LIMIT 1`,
    );
    assert.ok(rows.length > 0, 'expected at least one English translation in the corpus');
    const translatedId = rows[0].hadith_id;

    // The list endpoint has no id filter, so page through until the known
    // translated hadith turns up, capped well under the corpus size.
    let found: { hadith_id: number; text_en: string | null } | undefined;
    for (let offset = 0; offset < 500 && !found; offset += 100) {
      const res = await authed(token, request(app).get(`/hadiths?limit=100&offset=${offset}`));
      assert.equal(res.status, 200);
      found = res.body.data.find((h: { hadith_id: number }) => h.hadith_id === translatedId);
    }
    assert.ok(found, 'expected the translated hadith to appear in the list within 500 rows');
    assert.equal(typeof found?.text_en, 'string');
  });

  test('rows carry text_en: null when no English translation exists for that hadith', async () => {
    const token = await tokenFor('hadiths-text-en-null');
    const { rows } = await pool.query<{ hadith_id: number }>(
      `SELECT h.hadith_id FROM corpus.hadiths h
        LEFT JOIN corpus.hadith_translations t ON t.hadith_id = h.hadith_id AND t.lang = 'en'
       WHERE t.hadith_id IS NULL LIMIT 1`,
    );
    assert.ok(rows.length > 0, 'expected at least one untranslated hadith in the corpus');
    const untranslatedId = rows[0].hadith_id;

    let found: { hadith_id: number; text_en: string | null; text_plain: string } | undefined;
    for (let offset = 0; offset < 500 && !found; offset += 100) {
      const res = await authed(token, request(app).get(`/hadiths?limit=100&offset=${offset}`));
      found = res.body.data.find((h: { hadith_id: number }) => h.hadith_id === untranslatedId);
    }
    assert.ok(found, 'expected the untranslated hadith to appear in the list within 500 rows');
    assert.equal(found?.text_en, null);
    assert.equal(typeof found?.text_plain, 'string');
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npm test -- --test-name-pattern="text_en"`
Expected: FAIL — `found?.text_en` is `undefined` (the field does not exist on the response yet).

- [ ] **Step 3: Add the join**

In `backend/src/modules/hadiths/hadiths.model.ts`, change the `HadithListRow` interface (lines 12-20):

```ts
interface HadithListRow {
  hadith_id: number;
  collection_id: number;
  chapter_id: number | null;
  hadith_num: string;
  text_plain: string;
  text_en: string | null;
  sanad_count: number;
  chain_strength: number | null;
}
```

And the query in `listHadiths` (lines 47-55):

```ts
  const { rows } = await pool.query<HadithListRow & { chain_strength: string | null }>(
    `SELECT h.hadith_id, h.collection_id, h.chapter_id, h.hadith_num, h.text_plain, h.sanad_count,
            t.text_full AS text_en,
            corpus.chain_strength(h.hadith_id) AS chain_strength
       FROM corpus.hadiths h
       LEFT JOIN corpus.hadith_translations t ON t.hadith_id = h.hadith_id AND t.lang = 'en'
       ${where}
      ORDER BY h.hadith_id
      LIMIT ${limitPh} OFFSET ${offsetPh}`,
    values,
  );
```

(`LEFT JOIN`, not `JOIN` — coverage is ~95.3%, not 100%, and a hadith with no translation must still return, with `text_en: null`, per the existing "falls back to Arabic when absent" rule.)

- [ ] **Step 4: Run it to verify it passes**

Run: `cd backend && npm test -- --test-name-pattern="text_en"`
Expected: PASS

- [ ] **Step 5: Run the full backend suite to confirm no regression**

Run: `cd backend && npm test`
Expected: PASS (same pass count as before, plus these 2 new tests)

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/hadiths/hadiths.model.ts backend/src/corpus.test.ts
git commit -m "feat: join English hadith translation text into the hadith list query"
```

---

### Task 3: Frontend — English-first hadith rows in `HadithList`

**Files:**
- Modify: `frontend/src/domain/HadithList/HadithList.tsx`
- Modify: `frontend/src/domain/HadithList/HadithList.module.css`
- Test: `frontend/src/domain/HadithList/HadithList.test.tsx` (new)
- Modify: `frontend/src/routes/_authed/search.tsx` (schema + item mapping)
- Modify: `frontend/src/routes/_authed/collections/$slug_.$seq.tsx` (schema + item mapping)

**Interfaces:**
- Consumes: `text_en: string | null` from Task 2's `GET /hadiths` response.
- Produces: `HadithListItem` now requires `text_en: string | null`; both call sites must supply it or every `<HadithList>` usage fails to typecheck.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/domain/HadithList/HadithList.test.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HadithList } from './HadithList';

function renderList(items: Parameters<typeof HadithList>[0]['items']) {
  const rootRoute = createRootRoute({ component: () => <HadithList items={items} /> });
  const router = createRouter({ routeTree: rootRoute });
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} history={createMemoryHistory()} />
    </QueryClientProvider>,
  );
}

describe('HadithList', () => {
  it('shows the English text ahead of the Arabic text when a translation exists', async () => {
    renderList([
      {
        hadith_id: 1,
        hadith_num: '1',
        text_plain: 'إنما الأعمال بالنيات',
        text_en: 'Actions are judged by intentions.',
        chain_strength: 0.9,
      },
    ]);
    const link = await screen.findByRole('link');
    const children = Array.from(link.children).map((el) => el.textContent);
    const enIndex = children.findIndex((t) => t?.includes('Actions are judged by intentions.'));
    const arIndex = children.findIndex((t) => t?.includes('إنما الأعمال بالنيات'));
    expect(enIndex).toBeGreaterThanOrEqual(0);
    expect(arIndex).toBeGreaterThan(enIndex);
  });

  it('shows only the Arabic text when no translation exists', async () => {
    renderList([
      {
        hadith_id: 2,
        hadith_num: '2',
        text_plain: 'إنما الأعمال بالنيات',
        text_en: null,
        chain_strength: null,
      },
    ]);
    expect(await screen.findByText('إنما الأعمال بالنيات')).toBeInTheDocument();
    expect(screen.getByText('no chain')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npx vitest run src/domain/HadithList/HadithList.test.tsx`
Expected: FAIL — TypeScript rejects the missing `text_en` on the item, or (if run without typecheck) the English text is never rendered.

- [ ] **Step 3: Update the component**

Replace `frontend/src/domain/HadithList/HadithList.tsx`:

```tsx
import { Link } from '@tanstack/react-router';
import styles from './HadithList.module.css';

export interface HadithListItem {
  hadith_id: number;
  hadith_num: string;
  text_plain: string;
  text_en: string | null;
  chain_strength: number | null;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** One row per hadith: the number in mono, the English translation first
    when one exists, the Arabic snippet second, and the chain strength as
    a short bar and a figure. A hadith with no chain shows "no chain" and
    no bar. A hadith with no translation shows Arabic only. */
export function HadithList({ items }: { items: HadithListItem[] }) {
  return (
    <ul className={styles.list}>
      {items.map((hadith) => (
        <li key={hadith.hadith_id} className={styles.row}>
          <span className={`m ${styles.num}`}>{hadith.hadith_num}</span>
          <Link
            to="/hadiths/$hadithId"
            params={{ hadithId: String(hadith.hadith_id) }}
            className={styles.snippet}
          >
            {hadith.text_en ? (
              <span className={styles.snippetEn}>{truncate(hadith.text_en, 120)}</span>
            ) : null}
            <span className="ar" dir="rtl">
              {truncate(hadith.text_plain, 120)}
            </span>
          </Link>
          <span className={styles.score}>
            {hadith.chain_strength === null ? (
              'no chain'
            ) : (
              <>
                <span className={styles.bar} aria-hidden="true">
                  <span
                    className={styles.fill}
                    style={{ inlineSize: `${Math.round(hadith.chain_strength * 100)}%` }}
                  />
                </span>{' '}
                <span className="m m--bare">{`[${hadith.chain_strength.toFixed(2)}]`}</span>
              </>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: Update the CSS**

Replace `.snippet` and add `.snippetEn` in `frontend/src/domain/HadithList/HadithList.module.css` (keep `.list`, `.row`, `.num`, `.score`, `.bar`, `.fill`, and the media query unchanged):

```css
.snippet {
  display: flex;
  flex-direction: column;
  gap: var(--gap-stack);
  color: var(--ink);
  text-decoration-color: var(--rule);
}

.snippet:hover {
  text-decoration-color: var(--index);
}

.snippetEn {
  font-family: var(--font-en);
  font-size: var(--fs-body);
}

.snippet :global(.ar) {
  font-family: var(--font-ar);
  font-size: var(--fs-ar-grade);
  line-height: 1.7;
  text-align: right;
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `cd frontend && npx vitest run src/domain/HadithList/HadithList.test.tsx`
Expected: PASS

- [ ] **Step 6: Update both call sites**

In `frontend/src/routes/_authed/search.tsx`, change the schema (line 12-19):

```ts
const hadithRowSchema = z.object({
  hadith_id: z.number(),
  hadith_num: z.string(),
  text_plain: z.string(),
  text_en: z.string().nullable(),
  sanad_count: z.number(),
  chain_strength: z.coerce.number().nullable(),
});
const hadithListSchema = z.array(hadithRowSchema);
```

and the `<HadithList>` call (lines 100-107):

```tsx
          <HadithList
            items={results.data.map((hadith) => ({
              hadith_id: hadith.hadith_id,
              hadith_num: hadith.hadith_num,
              text_plain: hadith.text_plain,
              text_en: hadith.text_en,
              chain_strength: hadith.chain_strength === null ? null : Number(hadith.chain_strength),
            }))}
          />
```

Apply the identical two edits to `frontend/src/routes/_authed/collections/$slug_.$seq.tsx` (schema at lines 26-32, call at lines 155-162).

- [ ] **Step 7: Typecheck and run the full frontend suite**

Run: `cd frontend && npx tsc -b --noEmit && npm test`
Expected: PASS, no type errors

- [ ] **Step 8: Commit**

```bash
git add frontend/src/domain/HadithList frontend/src/routes/_authed/search.tsx \
        frontend/src/routes/_authed/collections/\$slug_.\$seq.tsx
git commit -m "feat: show English hadith text ahead of Arabic in hadith list rows"
```

---

### Task 4: `ui/Card` primitive

**Files:**
- Create: `frontend/src/ui/Card/Card.tsx`
- Create: `frontend/src/ui/Card/Card.module.css`
- Create: `frontend/src/ui/Card/index.ts`
- Test: `frontend/src/ui/Card/Card.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `Card` — a styled `<div>` accepting all standard `HTMLAttributes<HTMLDivElement>` plus `children`, used by Tasks 6, 7, and 8.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/ui/Card/Card.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card } from './Card';

describe('Card', () => {
  it('renders its children inside a div', () => {
    render(<Card>hello</Card>);
    expect(screen.getByText('hello').tagName).toBe('DIV');
  });

  it('forwards extra props, like a custom className, onto the root element', () => {
    render(<Card className="extra">content</Card>);
    expect(screen.getByText('content')).toHaveClass('extra');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npx vitest run src/ui/Card/Card.test.tsx`
Expected: FAIL — `Card.tsx` does not exist yet.

- [ ] **Step 3: Write the component**

```tsx
// frontend/src/ui/Card/Card.tsx
import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Card.module.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** A bordered block for one item in a list: one collection, one chapter,
    one circle, one note group. Replaces a bare <li> wherever a list of
    cards reads better than a table. Adjacent cards share a border. */
export function Card({ children, className, ...rest }: CardProps) {
  return (
    <div className={[styles.card, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  );
}
```

```css
/* frontend/src/ui/Card/Card.module.css */
.card {
  border: var(--bw) solid var(--rule);
  padding: var(--sp-3);
}

.card + .card {
  border-top: none;
}
```

```ts
// frontend/src/ui/Card/index.ts
export { Card } from './Card';
export type { CardProps } from './Card';
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd frontend && npx vitest run src/ui/Card/Card.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/ui/Card
git commit -m "feat: add the Card primitive"
```

---

### Task 5: `ui/PageHeader` primitive

**Files:**
- Create: `frontend/src/ui/PageHeader/PageHeader.tsx`
- Create: `frontend/src/ui/PageHeader/PageHeader.module.css`
- Create: `frontend/src/ui/PageHeader/index.ts`
- Test: `frontend/src/ui/PageHeader/PageHeader.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `PageHeader({ title, trailing? })` — renders an `<h1>` plus optional trailing content, used by Tasks 6, 7, and 10.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/ui/PageHeader/PageHeader.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from './PageHeader';

describe('PageHeader', () => {
  it('renders the title as an h1', () => {
    render(<PageHeader title="Collections" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Collections' })).toBeInTheDocument();
  });

  it('renders trailing content beside the title when given', () => {
    render(<PageHeader title="Notes" trailing={<span>3 notes</span>} />);
    expect(screen.getByText('3 notes')).toBeInTheDocument();
  });

  it('renders nothing extra when trailing is omitted', () => {
    render(<PageHeader title="Circles" />);
    expect(screen.queryByText('3 notes')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npx vitest run src/ui/PageHeader/PageHeader.test.tsx`
Expected: FAIL — `PageHeader.tsx` does not exist yet.

- [ ] **Step 3: Write the component**

```tsx
// frontend/src/ui/PageHeader/PageHeader.tsx
import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

export interface PageHeaderProps {
  title: string;
  trailing?: ReactNode;
}

/** Every page's <h1>, with an optional trailing count or action so a page
    stops inventing its own header row. */
export function PageHeader({ title, trailing }: PageHeaderProps) {
  return (
    <div className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
      {trailing ? <div className={styles.trailing}>{trailing}</div> : null}
    </div>
  );
}
```

```css
/* frontend/src/ui/PageHeader/PageHeader.module.css */
.header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-3);
  margin-bottom: var(--sp-3);
}

.title {
  font-size: var(--fs-title);
  margin: 0;
}

.trailing {
  font-size: var(--fs-rail);
  color: var(--ink-app);
  white-space: nowrap;
}
```

```ts
// frontend/src/ui/PageHeader/index.ts
export { PageHeader } from './PageHeader';
export type { PageHeaderProps } from './PageHeader';
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd frontend && npx vitest run src/ui/PageHeader/PageHeader.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/ui/PageHeader
git commit -m "feat: add the PageHeader primitive"
```

---

### Task 6: Redesign the collections index page

**Files:**
- Modify: `frontend/src/routes/_authed/collections/index.tsx`
- Create: `frontend/src/routes/_authed/collections/index.module.css`

**Interfaces:**
- Consumes: `Card` (Task 4), `PageHeader` (Task 5).
- Produces: nothing new for later tasks — this is a leaf page.

- [ ] **Step 1: Confirm the existing test still describes the wanted behavior**

Read `frontend/src/routes/_authed/collections/index.test.tsx`. It asserts (a) both `title_ar` and `title_en` render, (b) the link's accessible name matches a regex containing the Arabic title, (c) the Arabic title alone renders when `title_en` is null, (d) an error state renders. None of these assert visual order, so the file needs no changes — English-first ordering is a `Card`-internal detail these assertions don't pin down. Confirm by running it before touching the component:

Run: `cd frontend && npx vitest run src/routes/_authed/collections/index.test.tsx`
Expected: PASS (current implementation)

- [ ] **Step 2: Replace the component**

```tsx
// frontend/src/routes/_authed/collections/index.tsx
import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { apiFetch } from '../../../lib/apiClient';
import { Card } from '../../../ui/Card';
import { PageHeader } from '../../../ui/PageHeader';
import styles from './index.module.css';

const collectionSchema = z.object({
  collection_id: z.number(),
  slug: z.string(),
  title_ar: z.string(),
  title_en: z.string().nullable(),
  hadith_count: z.coerce.number(),
});
const collectionsSchema = z.array(collectionSchema);

export const Route = createFileRoute('/_authed/collections/')({
  component: CollectionsPage,
});

function useCollections() {
  return useQuery({
    queryKey: ['collections'],
    queryFn: () => apiFetch('/collections', collectionsSchema),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

function CollectionsPage() {
  const { data, isLoading, isError } = useCollections();

  if (isLoading) return <p>Loading the collections…</p>;
  if (isError || !data) return <p>The collections could not be loaded. Try again.</p>;
  if (data.length === 0) return <p>No collections are loaded yet.</p>;

  return (
    <div>
      <PageHeader title="Collections" />
      <div>
        {data.map((collection) => (
          <Card key={collection.collection_id} className={styles.row}>
            <Link
              to="/collections/$slug"
              params={{ slug: collection.slug }}
              className={styles.link}
            >
              <span className={styles.titleEn}>{collection.title_en ?? collection.title_ar}</span>
              {collection.title_en ? (
                <span className={`ar ${styles.titleAr}`} dir="rtl">
                  {collection.title_ar}
                </span>
              ) : null}
            </Link>
            <span className={`m m--bare ${styles.count}`}>{`[${collection.hadith_count} hadiths]`}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

```css
/* frontend/src/routes/_authed/collections/index.module.css */
.row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--sp-3);
}

.link {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  color: var(--ink);
}

.titleEn {
  font-size: var(--fs-lead);
}

.titleAr {
  font-size: var(--fs-ar-name);
  color: var(--ink-app);
}

.count {
  font-size: var(--fs-label);
  color: var(--ink-app);
  white-space: nowrap;
}
```

- [ ] **Step 3: Run the existing test to verify it still passes unchanged**

Run: `cd frontend && npx vitest run src/routes/_authed/collections/index.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/_authed/collections/index.tsx frontend/src/routes/_authed/collections/index.module.css
git commit -m "feat: redesign the collections index page with Card and PageHeader"
```

---

### Task 7: Redesign the chapters page

**Files:**
- Modify: `frontend/src/routes/_authed/collections/$slug.tsx`
- Create: `frontend/src/routes/_authed/collections/\$slug.module.css`

**Interfaces:**
- Consumes: `Card` (Task 4), `PageHeader` (Task 5).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Confirm the existing tests still describe the wanted behavior**

Run: `cd frontend && npx vitest run "src/routes/_authed/collections/\$slug.test.tsx"`
Expected: PASS (current implementation). The assertions check for the bare seq text (`'1'`, `'2'`) and the bare Arabic title text — neither depends on the wrapping markup, so this file needs no changes.

- [ ] **Step 2: Replace the component's return block**

In `frontend/src/routes/_authed/collections/$slug.tsx`, add the imports (after the existing `import { State } from '../../../domain/State';`):

```ts
import { Card } from '../../../ui/Card';
import { PageHeader } from '../../../ui/PageHeader';
import styles from './$slug.module.css';
```

Replace the final `return` block (lines 101-124):

```tsx
  return (
    <div>
      <PageHeader title="Chapters" />
      <div>
        {data.map((chapter) => (
          <Card key={chapter.chapter_id} className={styles.row}>
            <Link
              to="/collections/$slug/$seq"
              params={{ slug, seq: String(chapter.seq) }}
              className={styles.link}
            >
              <span className={`m ${styles.seq}`}>{chapter.seq}</span>
              <span className="ar" dir="rtl">
                {chapter.title_ar}
              </span>
            </Link>
          </Card>
        ))}
      </div>
      <Pager
        offset={offset}
        limit={LIMIT}
        count={data.length}
        onPrev={() => navigate({ search: { offset: Math.max(0, offset - LIMIT) } })}
        onNext={() => navigate({ search: { offset: offset + LIMIT } })}
      />
    </div>
  );
```

```css
/* frontend/src/routes/_authed/collections/$slug.module.css */
.row {
  padding-block: var(--sp-2);
}

.link {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  color: var(--ink);
}

.seq {
  font-size: var(--fs-label);
  color: var(--ink-app);
  min-inline-size: 2ch;
}
```

- [ ] **Step 3: Run the existing tests to verify they still pass unchanged**

Run: `cd frontend && npx vitest run "src/routes/_authed/collections/\$slug.test.tsx"`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add "frontend/src/routes/_authed/collections/\$slug.tsx" "frontend/src/routes/_authed/collections/\$slug.module.css"
git commit -m "feat: redesign the chapters page with Card and PageHeader"
```

---

### Task 8: `ui/Menu` primitive

**Files:**
- Create: `frontend/src/ui/Menu/Menu.tsx`
- Create: `frontend/src/ui/Menu/Menu.module.css`
- Create: `frontend/src/ui/Menu/index.ts`
- Test: `frontend/src/ui/Menu/Menu.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: `Menu({ label, current?, children })`, `MenuButton`, `MenuText` — used by Task 9's `Shell.tsx`. Any `Link` placed inside `Menu`'s children must carry `role="menuitem"` itself (the caller's job — `Menu` does not wrap or clone children).

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/ui/Menu/Menu.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Menu, MenuButton } from './Menu';

describe('Menu', () => {
  it('is closed by default and opens on trigger click', () => {
    render(
      <Menu label="Account">
        <MenuButton>Sign out</MenuButton>
      </Menu>,
    );
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    render(
      <Menu label="Account">
        <MenuButton>Sign out</MenuButton>
      </Menu>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes on an outside click', () => {
    render(
      <div>
        <Menu label="Account">
          <MenuButton>Sign out</MenuButton>
        </Menu>
        <button type="button">Elsewhere</button>
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('closes when a menu item is clicked', () => {
    render(
      <Menu label="Account">
        <MenuButton>Sign out</MenuButton>
      </Menu>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npx vitest run src/ui/Menu/Menu.test.tsx`
Expected: FAIL — `Menu.tsx` does not exist yet.

- [ ] **Step 3: Write the component**

```tsx
// frontend/src/ui/Menu/Menu.tsx
import {
  type ButtonHTMLAttributes,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import styles from './Menu.module.css';

export interface MenuProps {
  label: string;
  current?: boolean;
  children: ReactNode;
}

/** A trigger button plus a role="menu" popover: the shell's Corpus, Study,
    and Account dropdowns all reuse this. A child that should act as a menu
    item carries role="menuitem" itself — Menu renders children as given,
    it never clones or wraps them, so a plain <Link> works unmodified. */
export function Menu({ label, current, children }: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  function onMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    if (items.length === 0) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    const nextIndex =
      event.key === 'ArrowDown'
        ? (currentIndex + 1) % items.length
        : (currentIndex - 1 + items.length) % items.length;
    items[nextIndex]?.focus();
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={current ? `${styles.trigger} ${styles.current}` : styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </button>
      {open ? (
        // biome-ignore lint/a11y/useSemanticElements: role="menu" on a div is the ARIA menu pattern; no native element provides it.
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className={styles.popover}
          onKeyDown={onMenuKeyDown}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function MenuButton({
  children,
  className,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      role="menuitem"
      className={[styles.item, className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </button>
  );
}

export function MenuText({ children }: { children: ReactNode }) {
  return <div className={styles.text}>{children}</div>;
}
```

```css
/* frontend/src/ui/Menu/Menu.module.css */
.root {
  position: relative;
}

.trigger {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
  padding: var(--p-nav-v) var(--sp-2);
  min-height: var(--h-button);
  font-family: var(--font-en);
  font-size: var(--fs-rail);
  color: var(--ink-app);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  white-space: nowrap;
}

.trigger:hover {
  color: var(--ink);
}

.trigger.current {
  font-weight: 600;
  color: var(--ink);
  border-bottom-color: var(--index);
}

.popover {
  position: absolute;
  top: 100%;
  inset-inline-start: 0;
  z-index: 10;
  min-inline-size: 12rem;
  background: var(--ground);
  border: var(--bw) solid var(--rule);
  padding: var(--sp-1) 0;
  display: flex;
  flex-direction: column;
}

.item {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
  padding: var(--sp-2);
  min-height: var(--h-button);
  font-family: var(--font-en);
  font-size: var(--fs-rail);
  color: var(--ink);
  text-decoration: none;
  background: none;
  border: none;
  text-align: start;
  cursor: pointer;
  white-space: nowrap;
}

.item:hover,
.item:focus-visible {
  background: var(--rail);
}

.item[data-status="active"] {
  font-weight: 600;
}

.text {
  padding: var(--sp-2);
  font-size: var(--fs-label);
  color: var(--ink-app);
}
```

```ts
// frontend/src/ui/Menu/index.ts
export { Menu, MenuButton, MenuText } from './Menu';
export type { MenuProps } from './Menu';
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd frontend && npx vitest run src/ui/Menu/Menu.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/ui/Menu
git commit -m "feat: add the Menu primitive"
```

---

### Task 9: New `/settings` route

**Files:**
- Create: `frontend/src/routes/_authed/settings.tsx`
- Create: `frontend/src/routes/_authed/settings.test.tsx`

**Interfaces:**
- Consumes: `PageHeader` (Task 5), `ThemeSwitch` (`frontend/src/app/ThemeSwitch.tsx`, unchanged).
- Produces: the `/settings` route, linked from Task 10's Account menu.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/routes/_authed/settings.test.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AuthContextValue } from '../../auth/AuthContext';
import { AuthContext } from '../../auth/AuthContext';
import { routeTree } from '../../routeTree.gen';

function renderSettings() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const auth: AuthContextValue = {
    state: {
      status: 'signed-in',
      user: { user_id: 1, role: 'student', full_name: 'Amina', email: 'a@example.com' },
    },
    ready: Promise.resolve({
      status: 'signed-in',
      user: { user_id: 1, role: 'student', full_name: 'Amina', email: 'a@example.com' },
    }),
    signIn: async () => {},
    signOut: async () => {},
  };
  const history = createMemoryHistory({ initialEntries: ['/settings'] });
  const router = createRouter({ routeTree, history, context: { auth } });
  return render(
    <AuthContext.Provider value={auth}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </AuthContext.Provider>,
  );
}

describe('Settings page', () => {
  it('renders the Settings title and the theme switch', async () => {
    renderSettings();
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Ground' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npx vitest run src/routes/_authed/settings.test.tsx`
Expected: FAIL — the route does not exist yet (also fails to resolve `/_authed/settings` in `routeTree.gen.ts`).

- [ ] **Step 3: Write the route**

```tsx
// frontend/src/routes/_authed/settings.tsx
import { createFileRoute } from '@tanstack/react-router';
import { ThemeSwitch } from '../../app/ThemeSwitch';
import { PageHeader } from '../../ui/PageHeader';

export const Route = createFileRoute('/_authed/settings')({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" />
      <section aria-label="Appearance">
        <h2 className="label">Appearance</h2>
        <ThemeSwitch />
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Regenerate the route tree**

Run: `cd frontend && npx vite build 2>&1 | head -50`

This triggers the TanStack Router Vite plugin's route generation before bundling, regardless of whether the full build later succeeds. Confirm the new route landed:

Run: `git diff --stat frontend/src/routeTree.gen.ts`
Expected: the file changed and now references `/_authed/settings`.

- [ ] **Step 5: Run it to verify it passes**

Run: `cd frontend && npx vitest run src/routes/_authed/settings.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/routes/_authed/settings.tsx frontend/src/routes/_authed/settings.test.tsx \
        frontend/src/routeTree.gen.ts
git commit -m "feat: add a Settings route holding the theme switch"
```

---

### Task 10: Shell nav overhaul — dropdown menus

**Files:**
- Modify: `frontend/src/app/Shell.tsx`
- Modify: `frontend/src/app/Shell.module.css`
- Modify: `frontend/src/app/Shell.test.tsx`
- Modify: `frontend/src/app/Shell.role.test.tsx`

**Interfaces:**
- Consumes: `Menu`, `MenuButton`, `MenuText` (Task 8), the `/settings` route (Task 9).
- Produces: nothing new for later tasks — this is the shell every route renders inside.

This task replaces the flat topbar links with three `Menu`s (Corpus, Study, Account) and removes the standalone `ThemeSwitch`/"Sign out" button, moving Settings and Sign out into the Account menu. Existing tests query flat `role="link"`/`role="navigation"` elements that will no longer exist at the top level — they must open the relevant menu first.

- [ ] **Step 1: Update `Shell.role.test.tsx` to open menus before querying their items**

Replace the six tests after `renderShellAt`'s definition:

```tsx
describe('role-aware shell', () => {
  it('shows the waiting banner to an unverified teacher', async () => {
    renderShellAt('/collections', {
      status: 'signed-in',
      user: {
        user_id: 2,
        role: 'teacher',
        full_name: 'Ustadh',
        email: 't@x.io',
        is_verified: false,
      },
    });
    expect(await screen.findByText(/waiting for review/i)).toBeInTheDocument();
  });

  it('shows no banner to a verified teacher', async () => {
    renderShellAt('/collections', {
      status: 'signed-in',
      user: {
        user_id: 2,
        role: 'teacher',
        full_name: 'Ustadh',
        email: 't@x.io',
        is_verified: true,
      },
    });
    await screen.findByRole('button', { name: 'Study' });
    expect(screen.queryByText(/waiting for review/i)).not.toBeInTheDocument();
  });

  it('shows the signed-in name and role, and the verify link to an admin only', async () => {
    renderShellAt('/collections', {
      status: 'signed-in',
      user: { user_id: 9, role: 'admin', full_name: 'Root', email: 'a@x.io' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Account' }));
    expect(screen.getByText(/root · admin/i)).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Verify teachers' })).toBeInTheDocument();
  });

  it('hides the verify link from a student', async () => {
    renderShellAt('/collections', {
      status: 'signed-in',
      user: { user_id: 1, role: 'student', full_name: 'Amina', email: 's@x.io' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Account' }));
    expect(screen.queryByRole('menuitem', { name: 'Verify teachers' })).not.toBeInTheDocument();
  });

  it('shows the students link to a teacher but not to a student', async () => {
    renderShellAt('/collections', {
      status: 'signed-in',
      user: {
        user_id: 2,
        role: 'teacher',
        full_name: 'Ustadh',
        email: 't@x.io',
        is_verified: true,
      },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Study' }));
    expect(screen.getByRole('menuitem', { name: 'Students' })).toBeInTheDocument();
  });

  it('hides the students link from a student', async () => {
    renderShellAt('/collections', {
      status: 'signed-in',
      user: { user_id: 1, role: 'student', full_name: 'Amina', email: 's@x.io' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Study' }));
    expect(screen.queryByRole('menuitem', { name: 'Students' })).not.toBeInTheDocument();
  });

  it('renders menu items as real router links: clicking one navigates client-side, not via a full reload', async () => {
    // A plain <a> would not update the router's own location in jsdom. Only
    // a TanStack Router <Link> intercepts the click, calls preventDefault,
    // and pushes the new location through the router itself — so asserting
    // the router's location changed is exactly the evidence that this is a
    // client-side SPA navigation, not a page reload.
    const router = renderShellAt('/collections', {
      status: 'signed-in',
      user: { user_id: 1, role: 'student', full_name: 'Amina', email: 's@x.io' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Study' }));
    const circlesLink = screen.getByRole('menuitem', { name: 'Circles' });
    fireEvent.click(circlesLink);
    await waitFor(() => expect(router.state.location.pathname).toBe('/circles'));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npx vitest run src/app/Shell.role.test.tsx`
Expected: FAIL — `Shell.tsx` still renders the flat nav.

- [ ] **Step 3: Update `Shell.test.tsx`**

The three existing tests (skip link, `#main` landmark, brand text) are unaffected by the nav change and need no edits. Run them to confirm:

Run: `cd frontend && npx vitest run src/app/Shell.test.tsx`
Expected: PASS (unchanged)

- [ ] **Step 4: Rewrite `Shell.tsx`**

Replace the whole file:

```tsx
// frontend/src/app/Shell.tsx
import { Link, useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Menu, MenuButton, MenuText } from '../ui/Menu';
import { ToastRegion } from '../ui/Toast';
import styles from './Shell.module.css';

const CORPUS_PATHS = ['/collections', '/search', '/narrators'];
const STUDY_PATHS = ['/circles', '/sets', '/notes', '/students'];
const ACCOUNT_PATHS = ['/analytics', '/me', '/settings', '/admin/verify'];

function startsWithAny(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function Shell({ children }: { children: ReactNode }) {
  const { state, signOut } = useAuth();
  const pathname = useRouterState({ select: (routerState) => routerState.location.pathname });

  const role = state.status === 'signed-in' ? state.user.role : null;
  const isTeacher = role === 'teacher' || role === 'admin';

  return (
    <>
      <a className={styles.skip} href="#main">
        Skip to content
      </a>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <span className={styles.brand}>
            Ilham{' '}
            <span className={`ar ${styles.brandAr}`} dir="rtl">
              إلهام
            </span>
          </span>
          <span className={styles.spacer} />
          {state.status === 'signed-in' && (
            <nav className={styles.navTier} aria-label="Primary">
              <Menu label="Corpus" current={startsWithAny(pathname, CORPUS_PATHS)}>
                <Link role="menuitem" className={styles.menuItem} to="/collections">
                  Collections
                </Link>
                <Link role="menuitem" className={styles.menuItem} to="/search" search={{ q: '' }}>
                  Search
                </Link>
                <Link role="menuitem" className={styles.menuItem} to="/narrators" search={{ q: '' }}>
                  Narrators
                </Link>
              </Menu>
              <Menu label="Study" current={startsWithAny(pathname, STUDY_PATHS)}>
                <Link role="menuitem" className={styles.menuItem} to="/circles">
                  Circles
                </Link>
                <Link role="menuitem" className={styles.menuItem} to="/sets">
                  Study sets
                </Link>
                <Link role="menuitem" className={styles.menuItem} to="/notes">
                  Notes
                </Link>
                {isTeacher ? (
                  <Link role="menuitem" className={styles.menuItem} to="/students">
                    Students
                  </Link>
                ) : null}
              </Menu>
              <Menu label="Account" current={startsWithAny(pathname, ACCOUNT_PATHS)}>
                {state.status === 'signed-in' ? (
                  <MenuText>
                    {state.user.full_name} · {state.user.role}
                  </MenuText>
                ) : null}
                <Link role="menuitem" className={styles.menuItem} to="/analytics">
                  Analytics
                </Link>
                <Link role="menuitem" className={styles.menuItem} to="/me">
                  Account
                </Link>
                <Link role="menuitem" className={styles.menuItem} to="/settings">
                  Settings
                </Link>
                {role === 'admin' ? (
                  <Link role="menuitem" className={styles.menuItem} to="/admin/verify">
                    Verify teachers
                  </Link>
                ) : null}
                <MenuButton onClick={() => void signOut()}>Sign out</MenuButton>
              </Menu>
            </nav>
          )}
        </header>
        {state.status === 'signed-in' && role === 'teacher' && state.user.is_verified !== true && (
          <p role="note" className={styles.banner}>
            Your teaching account is waiting for review. You can build study sets, write notes, and
            review students. You cannot open a circle yet.
          </p>
        )}
      </div>
      <div className={styles.body}>
        <main id="main" tabIndex={-1} className={styles.main}>
          {children}
        </main>
      </div>
      <ToastRegion />
    </>
  );
}
```

Notes on this rewrite:
- `signOut` no longer needs a local `isSigningOut`/`handleSignOut` wrapper with `router.navigate` — `AuthContext`'s existing `signOut` already clears state, and the router's own guards (already exercised elsewhere) redirect a signed-out user away from `_authed` routes. If a redirect regression shows up in Step 5, restore the original `handleSignOut` body inside a `MenuButton onClick`.
- The inline SVG `Icon` helper is dropped — a dropdown label is plain text, unlike the old always-visible icon+text link row. If the redesign later wants icons inside menu items, reintroduce `Icon` then; keep it out until something needs it (YAGNI).

- [ ] **Step 5: Update `Shell.module.css`**

Remove `.navGroup`, `.navGroup + .navGroup`, `.navLabel`, `.navLink`, `.navLink:hover`, `.navLink[data-status="active"]`, `.navLink:focus-visible`, `.icon`, and the `@media (max-width: 62rem) { .navLabel { display: none } .navTier { padding: 0 } }` block (all now owned by `ui/Menu`). Replace `.navTier` with:

```css
.navTier {
  display: flex;
  align-items: stretch;
  gap: var(--sp-2);
}
```

Add `.menuItem` (the Link style Task 8's `.item` class establishes for `MenuButton`, duplicated here because `Link`'s route-aware `data-status` styling belongs to the page that owns the routes, not the generic `Menu` primitive):

```css
.menuItem {
  display: flex;
  align-items: center;
  gap: var(--sp-1);
  padding: var(--sp-2);
  min-height: var(--h-button);
  font-family: var(--font-en);
  font-size: var(--fs-rail);
  color: var(--ink);
  text-decoration: none;
  white-space: nowrap;
}

.menuItem:hover,
.menuItem:focus-visible {
  background: var(--rail);
}

.menuItem[data-status="active"] {
  font-weight: 600;
}
```

Keep `.skip`, `.shell`, `.topbar`, `.brand`, `.brandAr`, `.spacer`, `.identity` (now unused — remove it too, since the signed-in name moved into the Account menu's `MenuText`), `.banner`, `.body`, `.main`, and `.main:focus` unchanged.

- [ ] **Step 6: Run the shell tests to verify they pass**

Run: `cd frontend && npx vitest run src/app/Shell.test.tsx src/app/Shell.role.test.tsx`
Expected: PASS

- [ ] **Step 7: Run the full frontend suite**

Run: `cd frontend && npm test`
Expected: PASS — check specifically for any other file that queried the old flat `role="link"` nav items (e.g. a test that clicks "Collections" from the shell rather than navigating directly via `initialEntries`). Fix any such call site the same way Step 1 did: open the owning `Menu` first.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/Shell.tsx frontend/src/app/Shell.module.css \
        frontend/src/app/Shell.test.tsx frontend/src/app/Shell.role.test.tsx
git commit -m "feat: replace the flat topbar nav with Corpus/Study/Account dropdown menus"
```

---

### Task 11: Circles page — `Card` list

**Files:**
- Modify: `frontend/src/routes/_authed/circles/index.tsx`
- Create: `frontend/src/routes/_authed/circles/index.module.css`

**Interfaces:**
- Consumes: `Card` (Task 4), `PageHeader` (Task 5).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Confirm the existing tests still describe the wanted behavior**

Run: `cd frontend && npx vitest run src/routes/_authed/circles/index.test.tsx`
Expected: PASS (current implementation). Every assertion targets text or a named button/role, none targets the wrapping list markup, so this file needs no changes.

- [ ] **Step 2: Update the component**

In `frontend/src/routes/_authed/circles/index.tsx`, add imports:

```ts
import { Card } from '../../../ui/Card';
import { PageHeader } from '../../../ui/PageHeader';
import styles from './index.module.css';
```

Replace `<h1>Circles</h1>` with `<PageHeader title="Circles" />`, and replace the list block near the end (the `{data && data.length > 0 ? (...) : null}` block):

```tsx
      {data && data.length > 0 ? (
        <div>
          {data.map((circle) => (
            <Card key={circle.circle_id} className={styles.row}>
              {role === 'teacher' || role === 'admin' ? (
                <Link to="/circles/$circleId" params={{ circleId: String(circle.circle_id) }}>
                  {circle.name}
                </Link>
              ) : (
                circle.name
              )}
            </Card>
          ))}
        </div>
      ) : null}
```

```css
/* frontend/src/routes/_authed/circles/index.module.css */
.row {
  font-size: var(--fs-lead);
}
```

- [ ] **Step 3: Run the existing test to verify it still passes unchanged**

Run: `cd frontend && npx vitest run src/routes/_authed/circles/index.test.tsx`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/routes/_authed/circles/index.tsx frontend/src/routes/_authed/circles/index.module.css
git commit -m "feat: render the circles list as Cards"
```

---

### Task 12: Notes page — hadith picker instead of a raw ID field

**Files:**
- Create: `frontend/src/domain/HadithPicker/HadithPicker.tsx`
- Create: `frontend/src/domain/HadithPicker/HadithPicker.module.css`
- Create: `frontend/src/domain/HadithPicker/index.ts`
- Test: `frontend/src/domain/HadithPicker/HadithPicker.test.tsx`
- Modify: `frontend/src/routes/_authed/notes/index.tsx`
- Modify: `frontend/src/routes/_authed/notes/index.test.tsx`
- Create: `frontend/src/routes/_authed/notes/index.module.css`

**Interfaces:**
- Consumes: `Card` (Task 4), `PageHeader` (Task 5), `GET /hadiths?q=...` (existing endpoint, same one `search.tsx` uses).
- Produces: `HadithPicker({ onSelect: (hadith: { hadith_id: number; hadith_num: string; text_plain: string; text_en: string | null }) => void })` — a type-ahead field. `notes/index.tsx` is the only consumer for now.

This is a deliberately minimal type-ahead, not a full ARIA combobox: a debounced text input queries `/hadiths?q=...` after 2+ characters and lists up to 10 matches as buttons; picking one calls `onSelect` and clears the query. `ponytail: no roving-tabindex/aria-activedescendant combobox semantics — upgrade to one if a screen-reader audit flags this control specifically.`

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/domain/HadithPicker/HadithPicker.test.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/apiClient', async () => {
  const actual = await vi.importActual<typeof import('../../lib/apiClient')>('../../lib/apiClient');
  return { ...actual, apiFetch: vi.fn() };
});

import { apiFetch } from '../../lib/apiClient';
import { HadithPicker } from './HadithPicker';

function renderPicker(onSelect: (hadith: { hadith_id: number }) => void) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <HadithPicker onSelect={onSelect} />
    </QueryClientProvider>,
  );
}

describe('HadithPicker', () => {
  it('does not search until at least 2 characters are typed', () => {
    renderPicker(() => {});
    fireEvent.change(screen.getByLabelText(/find a hadith/i), { target: { value: 'a' } });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('lists matches and calls onSelect with the chosen hadith', async () => {
    vi.mocked(apiFetch).mockResolvedValue([
      {
        hadith_id: 42,
        hadith_num: '42',
        text_plain: 'إنما الأعمال بالنيات',
        text_en: 'Actions are judged by intentions.',
        sanad_count: 1,
        chain_strength: 0.9,
      },
    ]);
    const onSelect = vi.fn();
    renderPicker(onSelect);
    fireEvent.change(screen.getByLabelText(/find a hadith/i), { target: { value: 'intentions' } });
    const match = await screen.findByRole('button', { name: /actions are judged by intentions/i });
    fireEvent.click(match);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ hadith_id: 42, hadith_num: '42' }),
    );
  });

  it('clears the query and results after a selection', async () => {
    vi.mocked(apiFetch).mockResolvedValue([
      {
        hadith_id: 42,
        hadith_num: '42',
        text_plain: 'إنما الأعمال بالنيات',
        text_en: 'Actions are judged by intentions.',
        sanad_count: 1,
        chain_strength: null,
      },
    ]);
    renderPicker(() => {});
    const input = screen.getByLabelText(/find a hadith/i);
    fireEvent.change(input, { target: { value: 'intentions' } });
    const match = await screen.findByRole('button', { name: /actions are judged by intentions/i });
    fireEvent.click(match);
    await waitFor(() => expect(input).toHaveValue(''));
    expect(screen.queryByRole('button', { name: /actions are judged by intentions/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npx vitest run src/domain/HadithPicker/HadithPicker.test.tsx`
Expected: FAIL — `HadithPicker.tsx` does not exist yet.

- [ ] **Step 3: Write the component**

```tsx
// frontend/src/domain/HadithPicker/HadithPicker.tsx
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { z } from 'zod';
import { apiFetch } from '../../lib/apiClient';
import { Field } from '../../ui/Field';
import { Input } from '../../ui/Input';
import styles from './HadithPicker.module.css';

const hadithMatchSchema = z.object({
  hadith_id: z.number(),
  hadith_num: z.string(),
  text_plain: z.string(),
  text_en: z.string().nullable(),
});
const hadithMatchesSchema = z.array(hadithMatchSchema);

export type HadithMatch = z.infer<typeof hadithMatchSchema>;

export interface HadithPickerProps {
  onSelect: (hadith: HadithMatch) => void;
}

const MIN_QUERY_LENGTH = 2;

/** A type-ahead over the hadith corpus, for picking a hadith to attach a
    note to instead of typing its raw database id. Not a full ARIA
    combobox — a plain labelled input plus a list of match buttons. */
export function HadithPicker({ onSelect }: HadithPickerProps) {
  const [query, setQuery] = useState('');

  const results = useQuery({
    queryKey: ['hadiths', 'picker', query],
    queryFn: () => apiFetch(`/hadiths?q=${encodeURIComponent(query)}&limit=10`, hadithMatchesSchema),
    enabled: query.trim().length >= MIN_QUERY_LENGTH,
    staleTime: 30_000,
  });

  function pick(hadith: HadithMatch) {
    onSelect(hadith);
    setQuery('');
  }

  return (
    <div className={styles.picker}>
      <Field label="Find a hadith" hint="Type at least two characters, in English or Arabic.">
        {({ controlId, describedBy }) => (
          <Input
            id={controlId}
            aria-describedby={describedBy}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        )}
      </Field>
      {query.trim().length >= MIN_QUERY_LENGTH && results.data && results.data.length > 0 ? (
        <ul className={styles.matches}>
          {results.data.map((hadith) => (
            <li key={hadith.hadith_id}>
              <button type="button" className={styles.match} onClick={() => pick(hadith)}>
                <span className={`m ${styles.num}`}>{hadith.hadith_num}</span>
                {hadith.text_en ? (
                  <span className={styles.matchEn}>{hadith.text_en.slice(0, 100)}</span>
                ) : (
                  <span className="ar" dir="rtl">
                    {hadith.text_plain.slice(0, 100)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {query.trim().length >= MIN_QUERY_LENGTH && results.data && results.data.length === 0 ? (
        <p className="label">No hadith matches “{query}”.</p>
      ) : null}
    </div>
  );
}
```

```css
/* frontend/src/domain/HadithPicker/HadithPicker.module.css */
.picker {
  margin-bottom: var(--sp-3);
}

.matches {
  list-style: none;
  margin: 0;
  padding: 0;
  border: var(--bw) solid var(--rule);
  border-top: none;
}

.match {
  display: flex;
  align-items: baseline;
  gap: var(--sp-2);
  width: 100%;
  padding: var(--sp-2);
  background: none;
  border: none;
  border-bottom: var(--bw) solid var(--rule);
  text-align: start;
  cursor: pointer;
}

.match:hover,
.match:focus-visible {
  background: var(--rail);
}

.num {
  font-size: var(--fs-label);
  color: var(--ink-app);
  white-space: nowrap;
}

.matchEn {
  font-family: var(--font-en);
  font-size: var(--fs-rail);
}
```

```ts
// frontend/src/domain/HadithPicker/index.ts
export { HadithPicker } from './HadithPicker';
export type { HadithMatch, HadithPickerProps } from './HadithPicker';
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd frontend && npx vitest run src/domain/HadithPicker/HadithPicker.test.tsx`
Expected: PASS

- [ ] **Step 5: Wire it into the notes page**

In `frontend/src/routes/_authed/notes/index.tsx`:

Replace the `hadithId` state and the "Hadith ID" field. Change:

```ts
const [hadithId, setHadithId] = useState('');
```

to:

```ts
const [selectedHadith, setSelectedHadith] = useState<HadithMatch | null>(null);
```

and add the import:

```ts
import { HadithPicker, type HadithMatch } from '../../../domain/HadithPicker';
import { Card } from '../../../ui/Card';
import { PageHeader } from '../../../ui/PageHeader';
import styles from './index.module.css';
```

Change `handleSubmit`'s body value and reset:

```ts
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedHadith) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/notes', noteSchema, {
        method: 'POST',
        body: { hadith_id: selectedHadith.hadith_id, body },
      });
      setSelectedHadith(null);
      setBody('');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }
```

Replace the form's "Hadith ID" `Field`/`Input` block:

```tsx
      <form onSubmit={handleSubmit}>
        <HadithPicker onSelect={setSelectedHadith} />
        {selectedHadith ? (
          <p className={styles.selected}>
            Attaching to hadith <span className="m">{selectedHadith.hadith_num}</span>:{' '}
            {selectedHadith.text_en ?? selectedHadith.text_plain}
          </p>
        ) : null}
        <Field label="Note">
          {({ controlId, describedBy }) => (
            <Input
              id={controlId}
              aria-describedby={describedBy}
              multiline
              rows={3}
              required
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          )}
        </Field>
        {error ? <p>{error}</p> : null}
        <Button type="submit" variant="primary" disabled={!selectedHadith || submitting}>
          Add note
        </Button>
      </form>
```

Replace `<h1>Notes</h1>` with `<PageHeader title="Notes" />`, and wrap each `<section>` group's contents in a `Card` (replace the `{[...grouped].map(...)}` block):

```tsx
      {[...grouped].map(([groupHadithId, notes]) => (
        <Card key={groupHadithId} className={styles.group}>
          <h2>
            <Link to="/hadiths/$hadithId" params={{ hadithId: String(groupHadithId) }}>
              Hadith <span className="m">[{groupHadithId}]</span>
            </Link>
          </h2>
          <ul>
            {notes.map((note) => (
              <li key={note.note_id}>
                {note.body}{' '}
                <Button
                  type="button"
                  variant="destructive"
                  size="small"
                  onClick={() => setDeleting(note.note_id)}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ))}
```

```css
/* frontend/src/routes/_authed/notes/index.module.css */
.selected {
  font-size: var(--fs-rail);
  color: var(--ink-app);
  margin-block: var(--sp-2);
}

.group {
  margin-bottom: var(--sp-2);
}
```

- [ ] **Step 6: Update the existing notes test**

`frontend/src/routes/_authed/notes/index.test.tsx` currently drives the form through a "Hadith ID" number field — read it first to find every such reference, then replace each with the `HadithPicker` flow: mock `apiFetch` to also answer the `/hadiths?q=...` call with a match, type into "Find a hadith", click the resulting match button, then fill in "Note" and submit. Follow the same `vi.mocked(apiFetch).mockImplementation((path) => ...)` branching pattern already used in `frontend/src/routes/_authed/collections/$slug.test.tsx`'s `mockApiFetch` helper (branch on `path.startsWith('/hadiths')` vs `/notes`).

- [ ] **Step 7: Run the notes tests to verify they pass**

Run: `cd frontend && npx vitest run src/routes/_authed/notes/index.test.tsx`
Expected: PASS

- [ ] **Step 8: Run the full frontend suite**

Run: `cd frontend && npx tsc -b --noEmit && npm test`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add frontend/src/domain/HadithPicker frontend/src/routes/_authed/notes
git commit -m "feat: replace the raw hadith-id note field with a hadith picker"
```

---

## Final verification

- [ ] Run the full backend suite: `cd backend && npm test` — expect PASS.
- [ ] Run the full frontend suite: `cd frontend && npm test` — expect PASS.
- [ ] Run the frontend typecheck: `cd frontend && npx tsc -b --noEmit` — expect no errors.
- [ ] Run the frontend build (includes the token-literal check): `cd frontend && npm run build` — expect success.
- [ ] Manual pass in a browser (`npm run dev` in `frontend/`, backend running per `README.md`): visit `/collections`, `/collections/:slug`, `/search`, `/narrators`, `/circles`, `/notes`, confirm no bare unstyled lists remain, confirm `/search` and `/narrators` load with an empty box (no `undefined`), confirm the Corpus/Study/Account menus open, close on outside click and Escape, and navigate correctly, confirm `/settings` holds the theme switch.
- [ ] Update `docs/frontend-gaps.md` with a dated "Closed" entry summarizing this work, matching its existing format.
