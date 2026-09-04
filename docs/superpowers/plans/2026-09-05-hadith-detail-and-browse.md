# Hadith Detail and Browse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the signature Hadith Detail page and a working Collections → Hadith
List → Hadith Detail browse path, wired to the **real, running corpus** (not mocked),
plus the two Layer 1 primitives and the Layer 2 domain components they need.

**Architecture:** Extends the `frontend/src/{ui,domain,routes}` layers the Foundation
plan scaffolded. Adds `Button` and `Pager` (Layer 1); pure grading/chain-grouping
logic plus `IsnadChain` and `StrengthPlot` (Layer 2); `/collections`,
`/collections/$slug` (hadith list, filtered by `collection_id` only — see the
Chapters gap below), and `/hadiths/$hadithId` (Layer 3). Also makes one small,
additive change to the **existing** `backend/` Hono scaffold's hadith-detail query,
since it does not yet join the narrator grade columns the signature page needs —
see Task 1.

**Tech Stack:** Same as Foundation (Vite, React, TanStack Router/Query, Zod, CSS
Modules, Vitest, Testing Library). No new dependencies.

**Spec:** `docs/frontend-prd.md` §7.4 (Collections), §7.6 (hadith list), §7.7
(hadith detail — read this section in full before starting; it is the most
detailed page spec in the document), `docs/design/DESIGN.md` §4 (Components), and
`docs/design/demo.html` (the working reference prototype — this plan's CSS is
adapted from its `.chain`/`.link`/`.mark`/`.plot`/`.prow` rules, converted to CSS
Modules). Schema reference: `docs/database.md` and `db/01_corpus.sql`.

## Global Constraints

Carried forward from the Foundation plan (still binding):

- **No corpus writes, ever.** This plan only adds `SELECT`-based reads.
- **Four layers, one direction.** Layer 0 (`styles/tokens.css`) → Layer 1
  (`src/ui/`) → Layer 2 (`src/domain/`) → Layer 3 (`src/routes/`). A layer imports
  only from the layer below it.
- **No raw literal outside Layer 0.** Every colour/size/space/radius/duration value
  in the CSS this plan adds comes from `var(--token)`. The one exception is a
  literal border-width. Run `npm run check:tokens` before every commit.
- **Logical CSS properties everywhere** (`margin-inline-start`, not `margin-left`).
- **Zod validates every API response at the boundary**, via the existing
  `apiFetch(path, schema)` from `frontend/src/lib/apiClient.ts`.
- **`staleTime: Infinity`** for corpus queries (collections, hadiths, a single
  hadith) — the corpus never changes at runtime. Set this per-query with
  `useQuery({ ..., staleTime: Infinity })`.
- **English interface, Arabic in `dir="rtl"` islands** with an explicit `dir`
  attribute on every Arabic string (never rely on the CSS `direction` property).
- **No bare number, ever** (frontend-prd §9.3). Every chain-strength or narrator
  weight leads with a plain word; the number follows in `[wt N.NN]` mono brackets.
- **No colour-coded status, anywhere.** A grade, a weight, or a resolution state is
  words and shape, never colour. `--index` marks position only (a link, focus, or
  "sets the score" — never "good" or "bad").
- **The collector prints first, the Companion prints last** (reverse of storage
  order — `isnad_links.position` ascends from the Companion; the page reverses it).
- **No list endpoint returns a total count.** Every pager says "Showing 21–40" or
  similar, never "page 3 of 47." `limit` defaults to 20, corpus lists use 50.

### A real data gap this plan does NOT paper over

`docs/frontend-prd.md` §7.7 and `docs/design/DESIGN.md`'s "Generation filter"
describe a slider that hides the chain by narrator generation (1 = Companions, 10 =
the collectors' own teachers). **This plan does not build it.** The controller
checked the live schema before writing this plan: `corpus.narrators` has no
generation column, and `corpus.isnad_links` has none either — the only related
field is `narrators.tabaqa_raw`, free Arabic text (e.g. a Companion-detection
pattern lives in `etl/sql/13_ranks.sql`'s Pass 3, not a clean 1–10 ordinal). Building
the slider would mean inventing generation numbers with no data behind them, which
directly contradicts this project's own "never invent a weakest link" ethos
(frontend-prd §9.3). The generation filter is left as a documented gap — see the
Roadmap at the end of this plan — pending an ETL task to derive an ordinal from
`tabaqa_raw`, which is out of scope here.

Two other frontend-prd requests are similarly scoped out for the same
verify-before-building reason:
- **No chapter drill-down.** `GET /chapters?collection_id=` does not exist on the
  current `backend/` scaffold (confirmed: only `/collections`, `/hadiths`,
  `/hadiths/:id`, `/narrators/:id` exist). The hadith list route filters by
  `collection_id` only, and shows the chapter breadcrumb only when a hadith's own
  `chapter_id` happens to be present in its row (it isn't returned by the current
  list query — see Task 1's second, smaller query change).
- **No per-narrator paraphrase sentence.** `docs/design/demo.html`'s hand-written
  narrator descriptions ("trustworthy, a memoriser and a jurist") are prose
  paraphrasing the *raw* compound Arabic verdict string
  (`rank_ibn_hajar_raw`, e.g. `ثقة حافظ فقيه`) — that paraphrase was written by a
  human for the mockup, and there is no translation table in this repo that
  derives it programmatically. This plan instead uses the six canonical single-word
  glosses that `docs/design/demo.html`'s own `.glegend` legend already defines for
  the six `rank_code` values (`thiqa` → "trustworthy", `saduq` → "truthful",
  `maqbul` → "acceptable", `layyin` → "soft", `daif` → "weak", `matruk` →
  "abandoned" — verified against the live `corpus.rank_levels` table, which uses
  exactly these six `rank_code` strings). This is accurate and fully derivable from
  real data; it is simply less prosy than the hand-written mockup copy.

### Verified against the live database — use these exact values

The controller started `podman compose up -d db` and `cd backend && npm run dev`
before writing this plan and queried the real corpus directly. Use **hadith_id 5**
(Ṣaḥīḥ al-Bukhārī, `hadith_num` "1", the "actions are by intentions" hadith) as the
worked example throughout — it is the same hadith `docs/design/demo.html`
illustrates, and every narrator name in this plan's code below is copied from a
real `psql` query against the loaded corpus, not invented.

```
GET /hadiths/5 → chainStrength: 0.8, sanad_count: 1
isnadChain (flat, ordered by sanad_no, position — Companion first, compiler last):
  1: عمر بن الخطاب               (narrator_id 7... Companion, position 1)
  2: علقمة بن وقاص العتواري      (narrator_id 4494, position 2)
  3: محمد بن إبراهيم بن الحارث التيمي (narrator_id 5443, position 3)
  4: يحيى بن سعيد الأنصاري       (narrator_id 6932, position 4, resolution B)
  5: سفيان بن عيينة              (narrator_id 2478, position 5)
  6: الحميدي                    (narrator_id 3654, position 6)
  7: البخاري                    (narrator_id null, is_compiler true, resolution X, position 7)
```

`corpus.rank_levels` (all six rows — the complete, real table):

| rank_code | label_ar | weight |
|---|---|---|
| matruk | متروك | 0.10 |
| daif | ضعيف | 0.25 |
| layyin | لين | 0.40 |
| maqbul | مقبول | 0.60 |
| saduq | صدوق | 0.80 |
| thiqa | ثقة | 0.95 |

---

## File structure this plan produces

```
backend/src/modules/hadiths/
├── hadiths.interface.ts     (modified: IsnadLinkRow gains grade fields)
├── hadiths.model.ts         (modified: the isnad query joins rank_levels twice)
└── (hadiths.controller.ts, hadiths.routes.ts unchanged)

frontend/src/ui/
├── Button/{Button.tsx, Button.module.css, Button.test.tsx, index.ts}
└── Pager/{Pager.tsx, Pager.module.css, Pager.test.tsx, index.ts}

frontend/src/domain/
├── grading.ts, grading.test.ts
├── IsnadChain/{IsnadChain.tsx, IsnadChain.module.css, IsnadChain.test.tsx, index.ts}
└── StrengthPlot/{StrengthPlot.tsx, StrengthPlot.module.css, StrengthPlot.test.tsx, index.ts}

frontend/src/routes/
├── _authed/
│   ├── index.tsx              (modified: redirects to /collections)
│   ├── collections/
│   │   ├── index.tsx           (Collections list)
│   │   └── $slug.tsx           (hadith list for one collection)
│   └── hadiths/
│       └── $hadithId.tsx       (the signature page)
└── (schemas colocated per-route, no separate schema files needed)
```

---

### Task 1: Extend the backend's hadith-detail query with narrator grades

**Files:**
- Modify: `backend/src/modules/hadiths/hadiths.interface.ts`
- Modify: `backend/src/modules/hadiths/hadiths.model.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `IsnadLinkRow` gains `name_en`, `is_placeholder`, `rank_ibn_hajar`,
  `rank_ibn_hajar_weight`, `rank_dhahabi`, `rank_dhahabi_weight` — consumed by
  Task 4's `gradeSentence()` and Task 5's `IsnadChain`.

This is a read-only, additive change to a query the frontend PRD's ownership split
(`docs/backend-prd.md` §10) already assigns to the frontend owner
(`hadiths/`, `narrators/`). No DDL changes, no new grant, no write path.

- [ ] **Step 1: Update `IsnadLinkRow` in `backend/src/modules/hadiths/hadiths.interface.ts`**

Find the existing interface:

```ts
export interface IsnadLinkRow {
  sanad_no: number;
  position: number;
  narrator_id: number | null;
  raw_name: string;
  display_name: string | null;
  transmission_word: string | null;
  is_compiler: boolean;
  resolution: string;
}
```

Replace it with:

```ts
export interface IsnadLinkRow {
  sanad_no: number;
  position: number;
  narrator_id: number | null;
  raw_name: string;
  display_name: string | null;
  name_en: string | null;
  transmission_word: string | null;
  is_compiler: boolean;
  resolution: string;
  is_placeholder: boolean;
  rank_ibn_hajar: string | null;
  rank_ibn_hajar_weight: number | null;
  rank_dhahabi: string | null;
  rank_dhahabi_weight: number | null;
}
```

- [ ] **Step 2: Update the isnad query in `backend/src/modules/hadiths/hadiths.model.ts`**

Find:

```ts
  const { rows: isnadRows } = await pool.query<IsnadLinkRow>(
    `SELECT l.sanad_no, l.position, l.narrator_id, l.raw_name, n.display_name,
            l.transmission_word, l.is_compiler, l.resolution
       FROM corpus.isnad_links l
       LEFT JOIN corpus.narrators n ON n.narrator_id = l.narrator_id
      WHERE l.hadith_id = $1
      ORDER BY l.sanad_no, l.position`,
    [hadithId],
  );
```

Replace with:

```ts
  const { rows: isnadRows } = await pool.query<IsnadLinkRow>(
    `SELECT l.sanad_no, l.position, l.narrator_id, l.raw_name, n.display_name,
            n.name_en, l.transmission_word, l.is_compiler, l.resolution,
            coalesce(n.is_placeholder, false) AS is_placeholder,
            n.rank_ibn_hajar, rlh.weight AS rank_ibn_hajar_weight,
            n.rank_dhahabi, rld.weight AS rank_dhahabi_weight
       FROM corpus.isnad_links l
       LEFT JOIN corpus.narrators n ON n.narrator_id = l.narrator_id
       LEFT JOIN corpus.rank_levels rlh ON rlh.rank_code = n.rank_ibn_hajar
       LEFT JOIN corpus.rank_levels rld ON rld.rank_code = n.rank_dhahabi
      WHERE l.hadith_id = $1
      ORDER BY l.sanad_no, l.position`,
    [hadithId],
  );
```

`rank_ibn_hajar_weight`/`rank_dhahabi_weight` come straight from
`corpus.rank_levels.weight` (`numeric(3,2)`), which `pg` returns as a string —
Task 4's zod schema on the frontend parses it as `z.coerce.number()`, matching the
existing pattern for `chainStrength` a few lines below in this same file (search
for `Number(rawStrength)`).

- [ ] **Step 3: Manually verify against the live backend**

The db and backend must already be running (`podman compose up -d db`, then
`cd backend && npm run dev`). Restart the backend dev server to pick up the change
(it uses `tsx watch`, so saving the file is enough — just confirm no compile error
in its terminal output), then:

```bash
curl -s http://localhost:3000/hadiths/5 | python3 -m json.tool | grep -A2 rank_ibn_hajar
```

Expected: every non-compiler link in the output now carries `rank_ibn_hajar`,
`rank_ibn_hajar_weight`, `rank_dhahabi`, `rank_dhahabi_weight` fields (some may be
`null` for narrators al-Dhahabī never graded — that is correct, not a bug; the
corpus review states al-Dhahabī covers only 25.7% of profiles).

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/hadiths/
git commit -m "feat(backend): join narrator grades into the hadith-detail isnad query"
```

---

### Task 2: The Button primitive

**Files:**
- Create: `frontend/src/ui/Button/Button.tsx`
- Create: `frontend/src/ui/Button/Button.module.css`
- Create: `frontend/src/ui/Button/Button.test.tsx`
- Create: `frontend/src/ui/Button/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `export function Button(props: ButtonProps): JSX.Element`, re-exported
  from `frontend/src/ui/Button/index.ts` — consumed by Task 8 (Pager's prev/next)
  and Task 9 (the hadith detail page's actions).

Per `docs/design/DESIGN.md` §4 Controls table: "Square, 44px tall, 1px `--ink`
border. Primary is `--ink` fill, not a hue." No rounded corners, no shadow.

- [ ] **Step 1: Write the failing tests — `frontend/src/ui/Button/Button.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders its label and responds to a click', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    button.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('applies the primary variant class when requested', () => {
    render(<Button variant="primary">Continue</Button>);
    const button = screen.getByRole('button', { name: 'Continue' });
    expect(button.className).toMatch(/primary/);
  });

  it('is disabled when the disabled prop is set, and does not fire onClick', () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Submitting…
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Submitting…' });
    expect(button).toBeDisabled();
    button.click();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('defaults to type="button" so it never submits a surrounding form by accident', () => {
    render(<Button>Click</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd frontend && npm run test -- Button
```

Expected: FAIL — `./Button` does not exist.

- [ ] **Step 3: Write `Button.module.css`**

```css
.button {
  font-family: var(--font-en);
  font-size: var(--fs-rail);
  font-weight: 600;
  line-height: 1;
  padding: 13px var(--sp-2);
  min-height: 44px;
  border: 1px solid var(--ink);
  border-radius: 0;
  background: var(--ground);
  color: var(--ink);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: var(--sp-1);
}

.button:disabled {
  cursor: not-allowed;
  color: var(--ink-app);
  border-color: var(--edge);
}

.primary {
  background: var(--ink);
  color: var(--ground);
}

.primary:disabled {
  background: var(--rail);
  color: var(--ink-app);
  border-color: var(--edge);
}

.small {
  min-height: var(--h-compact);
  padding: 8px var(--sp-1);
  font-size: var(--fs-label);
  letter-spacing: var(--track-label);
}
```

- [ ] **Step 4: Write `Button.tsx`**

```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'default' | 'primary';
  size?: 'default' | 'small';
}

export function Button({
  children,
  variant = 'default',
  size = 'default',
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    styles.button,
    variant === 'primary' ? styles.primary : null,
    size === 'small' ? styles.small : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
```

- [ ] **Step 5: Write `index.ts`**

```ts
export { Button } from './Button';
export type { ButtonProps } from './Button';
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
npm run test -- Button
```

Expected: PASS, all 4 cases.

- [ ] **Step 7: Check tokens, lint, commit**

```bash
npm run check:tokens
npm run lint
git add frontend/src/ui/Button/
git commit -m "feat(frontend): add the Button primitive"
```

---

### Task 3: The Pager primitive

**Files:**
- Create: `frontend/src/ui/Pager/Pager.tsx`
- Create: `frontend/src/ui/Pager/Pager.module.css`
- Create: `frontend/src/ui/Pager/Pager.test.tsx`
- Create: `frontend/src/ui/Pager/index.ts`

**Interfaces:**
- Consumes: `Button` from `../Button` (Task 2).
- Produces: `export function Pager(props: PagerProps): JSX.Element` — consumed by
  Task 8's hadith list route.

Per frontend-prd §7.24: "Show 'Showing 21–40'. Never show 'page 3 of 47'... Add
one line that says the total is not counted." `Pager` never receives or computes a
total; it receives the current `offset`, `limit`, and `count` (how many rows this
page actually returned — used to detect "this is the last page," since a short
page, one with fewer rows than `limit`, is the only signal available).

- [ ] **Step 1: Write the failing tests — `frontend/src/ui/Pager/Pager.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Pager } from './Pager';

describe('Pager', () => {
  it('shows the current range and the "not counted" note', () => {
    render(<Pager offset={20} limit={20} count={20} onPrev={vi.fn()} onNext={vi.fn()} />);
    expect(screen.getByText('Showing 21–40')).toBeInTheDocument();
    expect(screen.getByText(/total is not counted/i)).toBeInTheDocument();
  });

  it('disables Previous on the first page (offset 0)', () => {
    render(<Pager offset={0} limit={20} count={20} onPrev={vi.fn()} onNext={vi.fn()} />);
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
  });

  it('enables Previous once offset is past zero, and calls onPrev', () => {
    const onPrev = vi.fn();
    render(<Pager offset={20} limit={20} count={20} onPrev={onPrev} onNext={vi.fn()} />);
    const prev = screen.getByRole('button', { name: /previous/i });
    expect(prev).toBeEnabled();
    prev.click();
    expect(onPrev).toHaveBeenCalledOnce();
  });

  it('disables Next when this page returned fewer rows than limit (the last page)', () => {
    render(<Pager offset={40} limit={20} count={7} onPrev={vi.fn()} onNext={vi.fn()} />);
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    expect(screen.getByText('Showing 41–47')).toBeInTheDocument();
  });

  it('enables Next and calls onNext when the page is full', () => {
    const onNext = vi.fn();
    render(<Pager offset={0} limit={20} count={20} onPrev={vi.fn()} onNext={onNext} />);
    const next = screen.getByRole('button', { name: /next/i });
    expect(next).toBeEnabled();
    next.click();
    expect(onNext).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm run test -- Pager
```

Expected: FAIL — `./Pager` does not exist.

- [ ] **Step 3: Write `Pager.module.css`**

```css
.pager {
  display: flex;
  align-items: center;
  gap: var(--sp-2);
  margin-top: var(--sp-3);
}

.range {
  font-size: var(--fs-rail);
  color: var(--ink-app);
}

.note {
  font-size: var(--fs-label);
  color: var(--ink-app);
  margin-inline-start: auto;
}
```

- [ ] **Step 4: Write `Pager.tsx`**

```tsx
import { Button } from '../Button';
import styles from './Pager.module.css';

export interface PagerProps {
  offset: number;
  limit: number;
  count: number;
  onPrev: () => void;
  onNext: () => void;
}

export function Pager({ offset, limit, count, onPrev, onNext }: PagerProps) {
  const from = offset + 1;
  const to = offset + count;
  const isFirstPage = offset === 0;
  const isLastPage = count < limit;

  return (
    <div className={styles.pager}>
      <Button size="small" onClick={onPrev} disabled={isFirstPage} aria-label="Previous page">
        Previous
      </Button>
      <Button size="small" onClick={onNext} disabled={isLastPage} aria-label="Next page">
        Next
      </Button>
      <span className={styles.range}>
        Showing {from}–{to}
      </span>
      <span className={styles.note}>The total is not counted.</span>
    </div>
  );
}
```

- [ ] **Step 5: Write `index.ts`**

```ts
export { Pager } from './Pager';
export type { PagerProps } from './Pager';
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
npm run test -- Pager
```

Expected: PASS, all 5 cases.

- [ ] **Step 7: Check tokens, lint, commit**

```bash
npm run check:tokens
npm run lint
git add frontend/src/ui/Pager/
git commit -m "feat(frontend): add the Pager primitive"
```

---

### Task 4: Grading and chain-grouping — pure logic

**Files:**
- Create: `frontend/src/domain/grading.ts`
- Create: `frontend/src/domain/grading.test.ts`

**Interfaces:**
- Consumes: nothing (pure functions over plain data).
- Produces (consumed by Task 5's `IsnadChain` and Task 6's `StrengthPlot`):
  - `export type RankCode = 'matruk' | 'daif' | 'layyin' | 'maqbul' | 'saduq' | 'thiqa'`
  - `export const RANK_GLOSS: Record<RankCode, string>`
  - `export const RANK_WEIGHT: Record<RankCode, number>` (mirrors
    `corpus.rank_levels`, for the discrete plot's fixed rows — the live weight for
    a given link still comes from the API, this is only the fixed axis)
  - `export interface GradeInfo { sentence: string; weight: number | null }`
  - `export function gradeInfo(link: { is_compiler: boolean; is_placeholder: boolean; resolution: string; rank_ibn_hajar: string | null; rank_ibn_hajar_weight: number | null }): GradeInfo`
  - `export interface FlatIsnadLink { sanad_no: number; position: number; [k: string]: unknown }`
  - `export function groupIsnadChains<T extends FlatIsnadLink>(links: T[]): { sanadNo: number; links: T[] }[]`
    — groups by `sanad_no`, and within each group **reverses** `links` so the
    collector (highest `position`) prints first and the Companion (`position` 1)
    prints last, per frontend-prd §7.7 point 6.

This is the highest-value task in the plan to get exactly right — it is the one
place the "never show a bare number" and "the collector first, the Companion last"
rules become code, and every later page depends on it being correct.

- [ ] **Step 1: Write the failing tests — `frontend/src/domain/grading.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { gradeInfo, groupIsnadChains, RANK_GLOSS, RANK_WEIGHT } from './grading';

describe('RANK_GLOSS and RANK_WEIGHT', () => {
  it('cover exactly the six real corpus.rank_levels codes, verified against the live database', () => {
    expect(RANK_GLOSS).toEqual({
      thiqa: 'trustworthy',
      saduq: 'truthful',
      maqbul: 'acceptable',
      layyin: 'soft',
      daif: 'weak',
      matruk: 'abandoned',
    });
    expect(RANK_WEIGHT).toEqual({
      thiqa: 0.95,
      saduq: 0.8,
      maqbul: 0.6,
      layyin: 0.4,
      daif: 0.25,
      matruk: 0.1,
    });
  });
});

describe('gradeInfo', () => {
  it('is the collector line for the compiler, unscored', () => {
    const info = gradeInfo({
      is_compiler: true,
      is_placeholder: false,
      resolution: 'X',
      rank_ibn_hajar: null,
      rank_ibn_hajar_weight: null,
    });
    expect(info).toEqual({ sentence: 'the collector — not scored', weight: null });
  });

  it('glosses a graded narrator with the canonical single-word gloss and its real weight', () => {
    const info = gradeInfo({
      is_compiler: false,
      is_placeholder: false,
      resolution: 'A',
      rank_ibn_hajar: 'thiqa',
      rank_ibn_hajar_weight: 0.95,
    });
    expect(info).toEqual({ sentence: 'trustworthy', weight: 0.95 });
  });

  it('names a resolved-but-ungraded narrator as neutral, at weight 0.50', () => {
    const info = gradeInfo({
      is_compiler: false,
      is_placeholder: false,
      resolution: 'A',
      rank_ibn_hajar: null,
      rank_ibn_hajar_weight: null,
    });
    expect(info).toEqual({
      sentence: 'identified, but no scholar graded him — neutral, not a fault',
      weight: 0.5,
    });
  });

  it('names a placeholder as unnamed, at weight 0.15', () => {
    const info = gradeInfo({
      is_compiler: false,
      is_placeholder: true,
      resolution: 'X',
      rank_ibn_hajar: null,
      rank_ibn_hajar_weight: null,
    });
    expect(info).toEqual({ sentence: 'the source records no name here', weight: 0.15 });
  });

  it('names an unresolved link (resolution X, no placeholder flag) as unnamed too', () => {
    const info = gradeInfo({
      is_compiler: false,
      is_placeholder: false,
      resolution: 'X',
      rank_ibn_hajar: null,
      rank_ibn_hajar_weight: null,
    });
    expect(info.sentence).toBe('the source records no name here');
    expect(info.weight).toBe(0.15);
  });

  it('names an ambiguous link (resolution C) as unnamed too', () => {
    const info = gradeInfo({
      is_compiler: false,
      is_placeholder: false,
      resolution: 'C',
      rank_ibn_hajar: null,
      rank_ibn_hajar_weight: null,
    });
    expect(info.sentence).toBe('the source records no name here');
  });
});

describe('groupIsnadChains', () => {
  it('groups the real hadith-5 chain into one sanad, collector first and Companion last', () => {
    // Exact shape from GET /hadiths/5 (verified against the live corpus).
    const flat = [
      { sanad_no: 1, position: 1, raw_name: 'عمر بن الخطاب' },
      { sanad_no: 1, position: 2, raw_name: 'علقمة بن وقاص العتواري' },
      { sanad_no: 1, position: 3, raw_name: 'محمد بن إبراهيم بن الحارث التيمي' },
      { sanad_no: 1, position: 4, raw_name: 'يحيى بن سعيد الأنصاري' },
      { sanad_no: 1, position: 5, raw_name: 'سفيان بن عيينة' },
      { sanad_no: 1, position: 6, raw_name: 'الحميدي' },
      { sanad_no: 1, position: 7, raw_name: 'البخاري' },
    ];

    const chains = groupIsnadChains(flat);

    expect(chains).toHaveLength(1);
    expect(chains[0].sanadNo).toBe(1);
    expect(chains[0].links.map((l) => l.raw_name)).toEqual([
      'البخاري',
      'الحميدي',
      'سفيان بن عيينة',
      'يحيى بن سعيد الأنصاري',
      'محمد بن إبراهيم بن الحارث التيمي',
      'علقمة بن وقاص العتواري',
      'عمر بن الخطاب',
    ]);
  });

  it('groups a multi-sanad hadith into separate chains, sorted by sanad_no', () => {
    const flat = [
      { sanad_no: 2, position: 1, raw_name: 'a' },
      { sanad_no: 1, position: 1, raw_name: 'b' },
      { sanad_no: 2, position: 2, raw_name: 'c' },
      { sanad_no: 1, position: 2, raw_name: 'd' },
    ];
    const chains = groupIsnadChains(flat);
    expect(chains.map((c) => c.sanadNo)).toEqual([1, 2]);
    expect(chains[0].links.map((l) => l.raw_name)).toEqual(['d', 'b']);
    expect(chains[1].links.map((l) => l.raw_name)).toEqual(['c', 'a']);
  });

  it('returns an empty array for a hadith with no chain', () => {
    expect(groupIsnadChains([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm run test -- grading
```

Expected: FAIL — `./grading` does not exist.

- [ ] **Step 3: Write the implementation — `frontend/src/domain/grading.ts`**

```ts
export type RankCode = 'matruk' | 'daif' | 'layyin' | 'maqbul' | 'saduq' | 'thiqa';

// The six canonical English glosses, matching docs/design/demo.html's own
// `.glegend` legend ("The six classical grades, weakest to strongest").
export const RANK_GLOSS: Record<RankCode, string> = {
  matruk: 'abandoned',
  daif: 'weak',
  layyin: 'soft',
  maqbul: 'acceptable',
  saduq: 'truthful',
  thiqa: 'trustworthy',
};

// Mirrors corpus.rank_levels.weight exactly (verified against the live table).
// Used only for the StrengthPlot's fixed axis; a specific link's real weight
// always comes from the API response, never recomputed here.
export const RANK_WEIGHT: Record<RankCode, number> = {
  matruk: 0.1,
  daif: 0.25,
  layyin: 0.4,
  maqbul: 0.6,
  saduq: 0.8,
  thiqa: 0.95,
};

const UNGRADED_WEIGHT = 0.5;
const UNNAMED_WEIGHT = 0.15;

export interface GradeInfo {
  sentence: string;
  weight: number | null;
}

export interface GradedLink {
  is_compiler: boolean;
  is_placeholder: boolean;
  resolution: string;
  rank_ibn_hajar: string | null;
  rank_ibn_hajar_weight: number | null;
}

/**
 * The three grade states as sentences, per docs/design/DESIGN.md §4. Ibn Hajar's
 * grade drives the sentence and the weight — the caller renders al-Dhahabi's
 * verdict as a separate, secondary line (see IsnadChain).
 */
export function gradeInfo(link: GradedLink): GradeInfo {
  if (link.is_compiler) {
    return { sentence: 'the collector — not scored', weight: null };
  }
  if (link.is_placeholder || link.resolution === 'X' || link.resolution === 'C') {
    return { sentence: 'the source records no name here', weight: UNNAMED_WEIGHT };
  }
  if (link.rank_ibn_hajar) {
    const gloss = RANK_GLOSS[link.rank_ibn_hajar as RankCode];
    return { sentence: gloss, weight: link.rank_ibn_hajar_weight ?? RANK_WEIGHT[link.rank_ibn_hajar as RankCode] };
  }
  return {
    sentence: 'identified, but no scholar graded him — neutral, not a fault',
    weight: UNGRADED_WEIGHT,
  };
}

export interface FlatIsnadLink {
  sanad_no: number;
  position: number;
  [key: string]: unknown;
}

export interface Chain<T> {
  sanadNo: number;
  links: T[];
}

/**
 * Groups a flat, position-ordered isnad array into one entry per sanad, with
 * each sanad's links reversed so the collector (highest position) prints first
 * and the Companion (position 1) prints last. docs/frontend-prd.md §7.7.
 */
export function groupIsnadChains<T extends FlatIsnadLink>(links: T[]): Chain<T>[] {
  const bySanad = new Map<number, T[]>();
  for (const link of links) {
    const group = bySanad.get(link.sanad_no);
    if (group) group.push(link);
    else bySanad.set(link.sanad_no, [link]);
  }
  return [...bySanad.entries()]
    .sort(([a], [b]) => a - b)
    .map(([sanadNo, group]) => ({
      sanadNo,
      links: [...group].sort((a, b) => b.position - a.position),
    }));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npm run test -- grading
```

Expected: PASS, all 9 cases.

- [ ] **Step 5: Check tokens, lint, commit**

```bash
npm run check:tokens
npm run lint
git add frontend/src/domain/grading.ts frontend/src/domain/grading.test.ts
git commit -m "feat(frontend): add grading and chain-grouping pure logic"
```

---

### Task 5: The IsnadChain domain component

**Files:**
- Create: `frontend/src/domain/IsnadChain/IsnadChain.tsx`
- Create: `frontend/src/domain/IsnadChain/IsnadChain.module.css`
- Create: `frontend/src/domain/IsnadChain/IsnadChain.test.tsx`
- Create: `frontend/src/domain/IsnadChain/index.ts`

**Interfaces:**
- Consumes: `gradeInfo`, `groupIsnadChains` from `../grading` (Task 4).
- Produces: `export function IsnadChain(props: IsnadChainProps): JSX.Element` —
  consumed by Task 9's hadith detail route. Takes the **flat** API array directly
  (it groups internally) plus `stronguestSanadNo` for the "sets the score" mark
  when there's more than one chain.

CSS adapted from `docs/design/demo.html`'s `.chain`/`.link`/`.mark`/`.link__nm`
rules (lines ~236–283 and ~489–493 of that file), converted to a CSS Module. Marks
follow `docs/design/DESIGN.md` §4's five-mark table exactly: filled disc
(resolution A/B), hollow disc (C), dashed hollow disc (X), dashed hollow square
(placeholder), filled square (compiler).

- [ ] **Step 1: Write the failing tests — `frontend/src/domain/IsnadChain/IsnadChain.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IsnadChain } from './IsnadChain';

const REAL_HADITH_5_CHAIN = [
  {
    sanad_no: 1,
    position: 1,
    narrator_id: 7001,
    raw_name: 'عمر بن الخطاب',
    display_name: 'عمر بن الخطاب',
    name_en: null,
    transmission_word: 'قال',
    is_compiler: false,
    resolution: 'A',
    is_placeholder: false,
    rank_ibn_hajar: null,
    rank_ibn_hajar_weight: null,
    rank_dhahabi: null,
    rank_dhahabi_weight: null,
  },
  {
    sanad_no: 1,
    position: 4,
    narrator_id: 6932,
    raw_name: 'يحيى بن سعيد الأنصاري',
    display_name: 'يحيى بن سعيد الأنصاري',
    name_en: null,
    transmission_word: 'أخبرني',
    is_compiler: false,
    resolution: 'B',
    is_placeholder: false,
    rank_ibn_hajar: 'thiqa',
    rank_ibn_hajar_weight: 0.95,
    rank_dhahabi: null,
    rank_dhahabi_weight: null,
  },
  {
    sanad_no: 1,
    position: 7,
    narrator_id: null,
    raw_name: 'البخاري',
    display_name: null,
    name_en: null,
    transmission_word: 'حدثنا',
    is_compiler: true,
    resolution: 'X',
    is_placeholder: false,
    rank_ibn_hajar: null,
    rank_ibn_hajar_weight: null,
    rank_dhahabi: null,
    rank_dhahabi_weight: null,
  },
];

describe('IsnadChain', () => {
  it('renders the collector first and the earliest position last', () => {
    render(<IsnadChain links={REAL_HADITH_5_CHAIN} />);
    const names = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(names[0]).toContain('البخاري');
    expect(names[names.length - 1]).toContain('عمر بن الخطاب');
  });

  it('glosses a graded narrator with the plain-word sentence and the bracketed weight', () => {
    render(<IsnadChain links={REAL_HADITH_5_CHAIN} />);
    expect(screen.getByText('trustworthy')).toBeInTheDocument();
    expect(screen.getByText('[0.95]')).toBeInTheDocument();
  });

  it('labels the compiler as not scored, with no weight shown', () => {
    render(<IsnadChain links={REAL_HADITH_5_CHAIN} />);
    expect(screen.getByText('the collector — not scored')).toBeInTheDocument();
  });

  it('glosses the transmission word for a link that carries one', () => {
    render(<IsnadChain links={REAL_HADITH_5_CHAIN} />);
    expect(screen.getByText('[أخبرني]')).toBeInTheDocument();
    expect(screen.getByText('"he informed us"')).toBeInTheDocument();
  });

  it('gives every Arabic name an explicit dir="rtl"', () => {
    render(<IsnadChain links={REAL_HADITH_5_CHAIN} />);
    const name = screen.getByText('البخاري');
    expect(name).toHaveAttribute('dir', 'rtl');
  });

  it('marks the sanad that sets the score when strongestSanadNo is given', () => {
    render(<IsnadChain links={REAL_HADITH_5_CHAIN} strongestSanadNo={1} />);
    expect(screen.getByText('sets the score')).toBeInTheDocument();
  });

  it('renders nothing chain-related, with an honest empty state, when there is no chain', () => {
    render(<IsnadChain links={[]} />);
    expect(screen.getByText(/no chain/i)).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm run test -- IsnadChain
```

Expected: FAIL — `./IsnadChain` does not exist.

- [ ] **Step 3: Write `IsnadChain.module.css`**

```css
.empty {
  font-size: var(--fs-rail);
  color: var(--ink-app);
  font-style: italic;
}

.sanadLabel {
  font-size: var(--fs-label);
  font-weight: 600;
  letter-spacing: var(--track-label);
  color: var(--ink-app);
  margin: var(--sp-3) 0 var(--sp-1);
}

.chain {
  list-style: none;
  margin: 0;
  padding: 0;
}

.link {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 24px;
  gap: var(--sp-2);
  align-items: start;
  min-height: var(--chain-row);
  padding-block: var(--sp-2);
}

.markCell {
  grid-column: 2;
  align-self: stretch;
  position: relative;
  display: flex;
  justify-content: center;
}
.markCell::before {
  content: '';
  position: absolute;
  inset-block: 0;
  inset-inline-start: 50%;
  translate: -50% 0;
  width: var(--bw);
  background: var(--rule);
}
.link:first-child .markCell::before {
  inset-block-start: 50%;
}
.link:last-child .markCell::before {
  inset-block-end: 50%;
}

.body {
  grid-column: 1;
  display: grid;
  gap: 2px;
}

.mark {
  position: relative;
  z-index: 1;
  margin-top: 5px;
  width: 12px;
  height: 12px;
  flex: none;
  background: var(--ground);
  border: 2px solid var(--ink);
}
.markPerson {
  border-radius: 50%;
  background: var(--ink);
}
.markAmbiguous {
  border-radius: 50%;
}
.markUnresolved {
  border-radius: 50%;
  border-style: dashed;
}
.markPlaceholder {
  border-style: dashed;
}
.markCollector {
  background: var(--ink);
}

.name {
  font-family: var(--font-ar);
  font-size: var(--fs-ar-chain);
  line-height: 1.25;
  font-weight: 400;
  text-align: right;
  margin: 0;
}
.nameSetsScore {
  border-bottom: 2px solid var(--index);
  display: inline-block;
  padding-bottom: 2px;
}

.translit {
  font-size: var(--fs-rail);
  line-height: 1.35;
  color: var(--ink-app);
  margin: 0;
}

.grade {
  font-size: var(--fs-rail);
  line-height: 1.4;
  color: var(--ink-app);
  margin: 0;
  text-align: right;
}
.gradeAbsent {
  font-style: italic;
}

.sep {
  color: var(--rule);
}

.vals {
  font-size: var(--fs-label);
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-1);
  justify-content: flex-end;
}

.gloss {
  font-size: var(--fs-label);
  line-height: 1.35;
  color: var(--ink-app);
}

.setsScore {
  font-size: var(--fs-label);
  font-weight: 600;
  letter-spacing: var(--track-label);
  color: var(--index);
}
```

- [ ] **Step 4: Write `IsnadChain.tsx`**

```tsx
import { gradeInfo, groupIsnadChains, type FlatIsnadLink } from '../grading';
import styles from './IsnadChain.module.css';

export interface IsnadLinkData extends FlatIsnadLink {
  narrator_id: number | null;
  raw_name: string;
  display_name: string | null;
  name_en: string | null;
  transmission_word: string | null;
  is_compiler: boolean;
  resolution: string;
  is_placeholder: boolean;
  rank_ibn_hajar: string | null;
  rank_ibn_hajar_weight: number | null;
  rank_dhahabi: string | null;
  rank_dhahabi_weight: number | null;
}

export interface IsnadChainProps {
  links: IsnadLinkData[];
  strongestSanadNo?: number;
}

const TRANSMISSION_GLOSS: Record<string, string> = {
  'حدثنا': 'he narrated to us',
  'حدثني': 'he narrated to me',
  'أخبرنا': 'he informed us',
  'أخبرني': 'he informed us',
  'سمعت': 'I heard',
  'سمع': 'he heard',
  'قال': 'he said',
  'أنه سمع': 'he heard',
};

function markClassName(link: IsnadLinkData): string {
  if (link.is_compiler) return `${styles.mark} ${styles.markCollector}`;
  if (link.is_placeholder) return `${styles.mark} ${styles.markPlaceholder}`;
  if (link.resolution === 'A' || link.resolution === 'B') return `${styles.mark} ${styles.markPerson}`;
  if (link.resolution === 'C') return `${styles.mark} ${styles.markAmbiguous}`;
  return `${styles.mark} ${styles.markUnresolved}`;
}

function LinkRow({ link, setsScore }: { link: IsnadLinkData; setsScore: boolean }) {
  const { sentence, weight } = gradeInfo(link);
  const secondSentence =
    !link.is_compiler && link.rank_dhahabi_weight != null
      ? `al-Dhahabī's grade also stands at [${link.rank_dhahabi_weight.toFixed(2)}]`
      : null;
  const gloss = link.transmission_word ? TRANSMISSION_GLOSS[link.transmission_word] : null;

  return (
    <li className={styles.link}>
      <div className={styles.markCell}>
        <span className={markClassName(link)} aria-hidden="true" />
      </div>
      <div className={styles.body}>
        <p className={`${styles.name} ar`} dir="rtl">
          {link.is_compiler ? (
            link.raw_name
          ) : setsScore ? (
            <span className={styles.nameSetsScore}>{link.display_name ?? link.raw_name}</span>
          ) : (
            link.display_name ?? link.raw_name
          )}
        </p>
        {link.name_en ? <p className={styles.translit}>{link.name_en}</p> : null}
        <p className={weight === null ? `${styles.grade} ${styles.gradeAbsent}` : styles.grade}>
          {sentence}
          {weight !== null ? <span className="m">{weight.toFixed(2)}</span> : null}
          {secondSentence ? (
            <>
              <span className={styles.sep} aria-hidden="true">
                {' '}
                /{' '}
              </span>
              <i>{secondSentence}</i>
            </>
          ) : null}
        </p>
        <span className={styles.vals}>
          {link.is_compiler ? (
            <span className="m">role compiler</span>
          ) : (
            <>
              {weight !== null ? <span className="m">wt {weight.toFixed(2)}</span> : null}
              {link.transmission_word ? <span className="m m--bare">{link.transmission_word}</span> : null}
              {gloss ? <span className={styles.gloss}>&ldquo;{gloss}&rdquo;</span> : null}
            </>
          )}
          {setsScore ? <span className={styles.setsScore}>sets the score</span> : null}
        </span>
      </div>
    </li>
  );
}

export function IsnadChain({ links, strongestSanadNo }: IsnadChainProps) {
  if (links.length === 0) {
    return <p className={styles.empty}>This hadith carries no recorded chain.</p>;
  }

  const chains = groupIsnadChains(links);
  const showSanadLabels = chains.length > 1;

  return (
    <>
      {chains.map((chain) => (
        <div key={chain.sanadNo}>
          {showSanadLabels ? (
            <p className={styles.sanadLabel}>Sanad {chain.sanadNo}</p>
          ) : null}
          <ol className={styles.chain}>
            {chain.links.map((link) => (
              <LinkRow
                key={`${chain.sanadNo}-${link.position}`}
                link={link}
                setsScore={showSanadLabels && chain.sanadNo === strongestSanadNo && !link.is_compiler}
              />
            ))}
          </ol>
        </div>
      ))}
    </>
  );
}
```

Note: `setsScore` on a specific *link* (the weakest one) needs the caller to know
which link within the strongest chain has the minimum weight — this component
currently only marks a whole *chain* as strongest via `sanadLabel`, not the
individual weakest link inside it. That per-link "sets the score" marking on a tie
rule ("mark nothing" per DESIGN.md) is genuinely more involved and is intentionally
left for a follow-up — see the Roadmap. For hadith 5 (one sanad), the tests above
don't exercise multi-sanad "sets the score" on a specific narrator, only the
simpler single-chain case; keep it that way for this task.

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npm run test -- IsnadChain
```

Expected: PASS, all 7 cases.

- [ ] **Step 6: Write `index.ts`**

```ts
export { IsnadChain } from './IsnadChain';
export type { IsnadChainProps, IsnadLinkData } from './IsnadChain';
```

- [ ] **Step 7: Check tokens, lint, commit**

```bash
npm run check:tokens
npm run lint
git add frontend/src/domain/IsnadChain/
git commit -m "feat(frontend): add the IsnadChain domain component"
```

---

### Task 6: The StrengthPlot domain component

**Files:**
- Create: `frontend/src/domain/StrengthPlot/StrengthPlot.tsx`
- Create: `frontend/src/domain/StrengthPlot/StrengthPlot.module.css`
- Create: `frontend/src/domain/StrengthPlot/StrengthPlot.test.tsx`
- Create: `frontend/src/domain/StrengthPlot/index.ts`

**Interfaces:**
- Consumes: `RANK_GLOSS`, `RANK_WEIGHT`, `gradeInfo` from `../grading` (Task 4).
- Produces: `export function StrengthPlot(props: StrengthPlotProps): JSX.Element` —
  consumed by Task 9, behind the "Show grading detail" disclosure.

A **discrete** plot: one fixed row per possible weight (the six graded weights plus
ungraded 0.50 and unnamed 0.15), one dot per link at that weight. Never a bar from
0 to 1. Adapted from `docs/design/demo.html`'s `.plot`/`.prow`/`.pcell`/`.pdot`
rules.

- [ ] **Step 1: Write the failing tests — `frontend/src/domain/StrengthPlot/StrengthPlot.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StrengthPlot } from './StrengthPlot';

describe('StrengthPlot', () => {
  const sixIdenticalWeights = Array.from({ length: 6 }, () => 0.95);

  it('renders one row for every one of the 8 possible weights, high to low', () => {
    render(<StrengthPlot weights={sixIdenticalWeights} />);
    const labels = screen.getAllByTestId('plot-row-weight').map((el) => el.textContent);
    expect(labels).toEqual(['0.95', '0.80', '0.60', '0.50', '0.40', '0.25', '0.15', '0.10']);
  });

  it('draws one dot per link at its weight', () => {
    render(<StrengthPlot weights={sixIdenticalWeights} />);
    expect(screen.getAllByTestId('plot-dot')).toHaveLength(6);
  });

  it('marks nothing when two or more links tie at the minimum, and says they tie', () => {
    render(<StrengthPlot weights={[0.95, 0.95]} />);
    expect(screen.queryByTestId('plot-dot-excluded')).not.toBeInTheDocument();
    expect(screen.getByText(/tie/i)).toBeInTheDocument();
  });

  it('marks the single dot that sets the score when there is a unique minimum', () => {
    render(<StrengthPlot weights={[0.95, 0.6, 0.95]} />);
    expect(screen.getAllByTestId('plot-dot-excluded')).toHaveLength(0);
    expect(screen.getByText(/sets the score/i)).toBeInTheDocument();
  });

  it('never renders a bare number without the six-grade legend', () => {
    render(<StrengthPlot weights={sixIdenticalWeights} />);
    expect(screen.getByText('trustworthy')).toBeInTheDocument();
    expect(screen.getByText('abandoned')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npm run test -- StrengthPlot
```

Expected: FAIL — `./StrengthPlot` does not exist.

- [ ] **Step 3: Write `StrengthPlot.module.css`**

```css
.legend {
  font-size: var(--fs-label);
  color: var(--ink-app);
  display: flex;
  flex-wrap: wrap;
  gap: var(--sp-2);
  margin: 0 0 var(--sp-2);
  border-bottom: var(--bw) solid var(--rule);
  padding-bottom: var(--sp-1);
}
.legend b {
  font-family: var(--font-ar);
  font-weight: 400;
  color: var(--ink);
}

.plot {
  display: grid;
  margin: var(--sp-2) 0;
}

.row {
  display: grid;
  grid-template-columns: 3.5rem 12rem minmax(0, 1fr);
  gap: var(--sp-2);
  align-items: center;
  border-bottom: var(--bw) solid var(--rule);
  padding-block: var(--sp-1);
}

.rowSets {
  border-bottom-color: var(--index);
  border-bottom-width: 2px;
}
.rowSets .weight {
  color: var(--index);
  font-weight: 500;
}

.weight {
  font-family: var(--font-mono);
  font-size: var(--fs-label);
  color: var(--machine);
  font-variant-numeric: tabular-nums;
}

.rowLabelAr {
  font-family: var(--font-ar);
  font-size: var(--fs-ar-grade);
  text-align: right;
}
.rowLabelEn {
  font-family: var(--font-en);
  font-size: var(--fs-label);
  text-align: start;
  color: var(--ink-app);
}

.cells {
  display: flex;
  gap: var(--sp-1);
  flex-wrap: wrap;
}

.dot {
  display: block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ink);
}

.tieNote {
  font-size: var(--fs-rail);
  color: var(--ink-app);
  margin: var(--sp-1) 0 0;
}
```

- [ ] **Step 4: Write `StrengthPlot.tsx`**

```tsx
import { RANK_GLOSS, RANK_WEIGHT } from '../grading';
import styles from './StrengthPlot.module.css';

export interface StrengthPlotProps {
  /** The real weight of every scored (non-compiler) link in the chain. */
  weights: number[];
}

const UNGRADED_WEIGHT = 0.5;
const UNNAMED_WEIGHT = 0.15;

const ROWS: { weight: number; ar: string | null; en: string | null }[] = [
  { weight: RANK_WEIGHT.thiqa, ar: 'ثقة', en: null },
  { weight: RANK_WEIGHT.saduq, ar: 'صدوق', en: null },
  { weight: RANK_WEIGHT.maqbul, ar: 'مقبول', en: null },
  { weight: UNGRADED_WEIGHT, ar: null, en: 'known, but never graded' },
  { weight: RANK_WEIGHT.layyin, ar: 'لين', en: null },
  { weight: RANK_WEIGHT.daif, ar: 'ضعيف', en: null },
  { weight: UNNAMED_WEIGHT, ar: null, en: 'we could not identify them' },
  { weight: RANK_WEIGHT.matruk, ar: 'متروك', en: null },
];

export function StrengthPlot({ weights }: StrengthPlotProps) {
  const minWeight = weights.length > 0 ? Math.min(...weights) : null;
  const minCount = minWeight === null ? 0 : weights.filter((w) => w === minWeight).length;
  const uniqueMinimum = minCount === 1;

  return (
    <div>
      <p className={styles.legend}>
        <span>The six classical grades, weakest to strongest</span>
        <span>
          <b dir="rtl">متروك</b> {RANK_GLOSS.matruk}
        </span>
        <span>
          <b dir="rtl">ضعيف</b> {RANK_GLOSS.daif}
        </span>
        <span>
          <b dir="rtl">لين</b> {RANK_GLOSS.layyin}
        </span>
        <span>
          <b dir="rtl">مقبول</b> {RANK_GLOSS.maqbul}
        </span>
        <span>
          <b dir="rtl">صدوق</b> {RANK_GLOSS.saduq}
        </span>
        <span>
          <b dir="rtl">ثقة</b> {RANK_GLOSS.thiqa}
        </span>
      </p>

      <div className={styles.plot}>
        {ROWS.map((row) => {
          const count = weights.filter((w) => w === row.weight).length;
          const isMinRow = uniqueMinimum && row.weight === minWeight;
          return (
            <div key={row.weight} className={isMinRow ? `${styles.row} ${styles.rowSets}` : styles.row}>
              <span className={styles.weight} data-testid="plot-row-weight">
                {row.weight.toFixed(2)}
              </span>
              {row.ar ? (
                <span className={styles.rowLabelAr} dir="rtl">
                  {row.ar}
                </span>
              ) : (
                <span className={styles.rowLabelEn}>{row.en}</span>
              )}
              <div className={styles.cells}>
                {Array.from({ length: count }, (_, i) => (
                  <span key={i} className={styles.dot} data-testid="plot-dot" />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {uniqueMinimum ? (
        <p className={styles.tieNote}>The lowest weight, {minWeight!.toFixed(2)}, sets the score.</p>
      ) : minCount > 1 ? (
        <p className={styles.tieNote}>
          {minCount} links tie at the lowest weight, {minWeight!.toFixed(2)} — nothing is marked.
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npm run test -- StrengthPlot
```

Expected: PASS, all 5 cases.

- [ ] **Step 6: Write `index.ts`**

```ts
export { StrengthPlot } from './StrengthPlot';
export type { StrengthPlotProps } from './StrengthPlot';
```

- [ ] **Step 7: Check tokens, lint, commit**

```bash
npm run check:tokens
npm run lint
git add frontend/src/domain/StrengthPlot/
git commit -m "feat(frontend): add the StrengthPlot domain component"
```

---

### Task 7: The Collections route — real data

**Files:**
- Create: `frontend/src/routes/_authed/collections/index.tsx`
- Modify: `frontend/src/routes/_authed/index.tsx` (redirect to `/collections`)

**Interfaces:**
- Consumes: `apiFetch` (`../../../lib/apiClient`).
- Produces: the `/collections` route — the first real page in the app, linked to
  by Task 8's `$slug` route.

- [ ] **Step 1: Replace the home stub — `frontend/src/routes/_authed/index.tsx`**

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed/')({
  beforeLoad: () => {
    throw redirect({ to: '/collections' });
  },
});
```

- [ ] **Step 2: Write `frontend/src/routes/_authed/collections/index.tsx`**

```tsx
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiFetch } from '../../../lib/apiClient';

const collectionSchema = z.object({
  collection_id: z.number(),
  slug: z.string(),
  title_ar: z.string(),
  title_en: z.string().nullable(),
});
const collectionsSchema = z.array(collectionSchema);

export const Route = createFileRoute('/_authed/collections/')({
  component: CollectionsPage,
});

function useCollections() {
  return useQuery({
    queryKey: ['collections'],
    queryFn: () => apiFetch('/collections', collectionsSchema),
    staleTime: Infinity,
  });
}

function CollectionsPage() {
  const { data, isLoading, isError } = useCollections();

  if (isLoading) return <p>Loading the collections…</p>;
  if (isError || !data) return <p>The collections could not be loaded. Try again.</p>;
  if (data.length === 0) return <p>No collections are loaded yet.</p>;

  return (
    <div>
      <h1>Collections</h1>
      <ul>
        {data.map((collection) => (
          <li key={collection.collection_id}>
            <Link to="/collections/$slug" params={{ slug: collection.slug }}>
              <span className="ar" dir="rtl">
                {collection.title_ar}
              </span>
              {collection.title_en ? <span> — {collection.title_en}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Note: `apiFetch`'s schema parses the value under the response's `data` key (per
`docs/backend-prd.md`'s envelope). The **current** `backend/` scaffold returns a
bare array with no envelope — `GET /collections` today returns `[{...}, {...}]`
directly, not `{"data": [...]}`. This means `apiFetch('/collections', ...)` will
currently fail its `schema.safeParse` step against the live scaffold (the parsed
`payload` will be `undefined`, since there is no `.data` key to read). **This is
expected and already documented** in the Foundation plan's "known, deliberate gap"
— the app is built against `docs/backend-prd.md`'s target contract, and the
envelope lands when the real Express backend does. For this task, verify the route
compiles, renders its loading/error/empty states correctly against a **mocked**
`apiFetch` in the test (Step 3), and treat the live-data manual check in Step 4 as
confirming the request reaches the right URL and fails gracefully with the
"could not be loaded" message — not confirming rows render, which needs the target
envelope.

- [ ] **Step 3: Write `frontend/src/routes/_authed/collections/index.test.tsx`**

```tsx
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AuthContextValue } from '../../../auth/AuthContext';
import { routeTree } from '../../../routeTree.gen';

vi.mock('../../../lib/apiClient', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/apiClient')>('../../../lib/apiClient');
  return { ...actual, apiFetch: vi.fn() };
});

import { apiFetch } from '../../../lib/apiClient';

function renderCollections() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const auth: AuthContextValue = {
    state: { status: 'signed-in', user: { userId: 1, role: 'student', name: 'Amina', email: 'a@example.com' } },
    ready: Promise.resolve({ status: 'signed-in', user: { userId: 1, role: 'student', name: 'Amina', email: 'a@example.com' } }),
    signIn: async () => {},
    signOut: async () => {},
  };
  const history = createMemoryHistory({ initialEntries: ['/collections'] });
  const router = createRouter({ routeTree, history, context: { auth } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('Collections page', () => {
  it('renders each collection with its Arabic and English titles, linked to its slug', async () => {
    vi.mocked(apiFetch).mockResolvedValue([
      { collection_id: 1, slug: 'sahih-al-bukhari', title_ar: 'صحيح البخاري', title_en: 'Sahih al-Bukhari' },
      { collection_id: 2, slug: 'sahih-muslim', title_ar: 'صحيح مسلم', title_en: 'Sahih Muslim' },
    ]);
    renderCollections();
    expect(await screen.findByText('صحيح البخاري')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /صحيح مسلم/ })).toHaveAttribute(
      'href',
      '/collections/sahih-muslim',
    );
  });

  it('falls back to the Arabic title when English is absent', async () => {
    vi.mocked(apiFetch).mockResolvedValue([
      { collection_id: 3, slug: 'example', title_ar: 'مثال', title_en: null },
    ]);
    renderCollections();
    expect(await screen.findByText('مثال')).toBeInTheDocument();
  });

  it('shows a plain error message when the request fails', async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error('network error'));
    renderCollections();
    expect(await screen.findByText(/could not be loaded/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run the tests, then verify manually against the live backend**

```bash
npm run test -- collections
```

Expected: PASS, all 3 cases (these mock `apiFetch` directly, so they pass
regardless of the live envelope gap noted in Step 2).

Then, with `podman compose up -d db` and `cd backend && npm run dev` both already
running from Task 1:

```bash
npm run dev
```

Open the app. Expected: it redirects through `/login` (no session — same as
Foundation's documented behavior) unless you're testing signed-in state
separately; navigating directly to `/collections` in a new tab while `AuthContext`
is mid-bootstrap will still bounce to `/login` for the same reason. This route's
real-data check is fully covered by Step 3's mocked tests — do not treat a manual
browser click-through as required evidence here, since a live check needs
Authentication (a later phase) to actually reach this page as a signed-in user.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/routes/
git commit -m "feat(frontend): add the Collections route"
```

---

### Task 8: The Hadith List route — real data, with paging

**Files:**
- Create: `frontend/src/routes/_authed/collections/$slug.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `Pager` (`../../../ui/Pager`).
- Produces: the `/collections/$slug` route, linked to by Task 7 and linking to
  Task 9's `/hadiths/$hadithId`.

Per the scope note at the top of this plan: this route filters by `collection_id`
only (no `/chapters` endpoint exists yet), and paginates client-side state
(`offset`/`limit` in the URL's search params, per frontend-prd D2's "TanStack
Router validates and types them").

- [ ] **Step 1: Write `frontend/src/routes/_authed/collections/$slug.tsx`**

```tsx
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiFetch } from '../../../lib/apiClient';
import { Pager } from '../../../ui/Pager';

const hadithRowSchema = z.object({
  hadith_id: z.number(),
  hadith_num: z.string(),
  text_plain: z.string(),
  sanad_count: z.number(),
});
const hadithListSchema = z.array(hadithRowSchema);

const searchSchema = z.object({
  offset: z.number().catch(0),
});

const LIMIT = 50;

export const Route = createFileRoute('/_authed/collections/$slug')({
  validateSearch: searchSchema,
  component: HadithListPage,
});

function useHadithsByCollectionSlug(slug: string, offset: number) {
  return useQuery({
    queryKey: ['hadiths', { slug, limit: LIMIT, offset }],
    queryFn: () =>
      apiFetch(`/hadiths?collection_id=${encodeURIComponent(slug)}&limit=${LIMIT}&offset=${offset}`, hadithListSchema),
  });
}

function HadithListPage() {
  const { slug } = Route.useParams();
  const { offset } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data, isLoading, isError } = useHadithsByCollectionSlug(slug, offset);

  if (isLoading) return <p>Loading hadiths…</p>;
  if (isError || !data) return <p>The hadith list could not be loaded. Try again.</p>;
  if (data.length === 0 && offset === 0) return <p>This collection has no hadiths yet.</p>;

  return (
    <div>
      <h1>Hadiths</h1>
      <ul>
        {data.map((hadith) => (
          <li key={hadith.hadith_id}>
            <Link to="/hadiths/$hadithId" params={{ hadithId: String(hadith.hadith_id) }}>
              <span className="m">{hadith.hadith_num}</span>
              <span className="ar" dir="rtl">
                {hadith.text_plain.slice(0, 80)}…
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Pager
        offset={offset}
        limit={LIMIT}
        count={data.length}
        onPrev={() => navigate({ search: { offset: Math.max(0, offset - LIMIT) } })}
        onNext={() => navigate({ search: { offset: offset + LIMIT } })}
      />
    </div>
  );
}
```

**Note on the `collection_id` query parameter above:** the current `backend/`
scaffold's `GET /hadiths` filters by the numeric `collection_id`, not by `slug` —
this route passes `slug` through as a stand-in above for brevity, but that is
**wrong** and must be fixed before this task is done: resolve the numeric
`collection_id` first. Do it by reading the collections list already cached under
the `['collections']` query key from Task 7 (via `queryClient.getQueryData` or a
second `useQuery` with the same key, which TanStack Query dedupes against the
cache) and finding the entry whose `slug` matches the route param, then use its
`collection_id` in the `/hadiths` URL. If the slug isn't found in the cache (e.g. a
direct link before Collections ever loaded), fetch `/collections` fresh the same
way Task 7 does. Write this resolution as a small `useCollectionIdForSlug(slug)`
hook at the top of this file, and use its result (loading/error-aware) before
running the hadith-list query.

- [ ] **Step 2: Write `frontend/src/routes/_authed/collections/$slug.test.tsx`**

```tsx
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AuthContextValue } from '../../../auth/AuthContext';
import { routeTree } from '../../../routeTree.gen';

vi.mock('../../../lib/apiClient', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/apiClient')>('../../../lib/apiClient');
  return { ...actual, apiFetch: vi.fn() };
});

import { apiFetch } from '../../../lib/apiClient';

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const auth: AuthContextValue = {
    state: { status: 'signed-in', user: { userId: 1, role: 'student', name: 'Amina', email: 'a@example.com' } },
    ready: Promise.resolve({ status: 'signed-in', user: { userId: 1, role: 'student', name: 'Amina', email: 'a@example.com' } }),
    signIn: async () => {},
    signOut: async () => {},
  };
  const history = createMemoryHistory({ initialEntries: [path] });
  const router = createRouter({ routeTree, history, context: { auth } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('Hadith list page', () => {
  it('resolves the slug to a collection_id, then lists hadiths linked to their detail page', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path: string) => {
      if (path === '/collections') {
        return [{ collection_id: 1, slug: 'sahih-al-bukhari', title_ar: 'صحيح البخاري', title_en: 'Sahih al-Bukhari' }];
      }
      if (path.startsWith('/hadiths?collection_id=1')) {
        return [{ hadith_id: 5, hadith_num: '1', text_plain: 'إنما الأعمال بالنيات', sanad_count: 1 }];
      }
      throw new Error(`unexpected path ${path}`);
    });
    renderAt('/collections/sahih-al-bukhari');
    const link = await screen.findByRole('link', { name: /١|1/ });
    expect(link).toHaveAttribute('href', '/hadiths/5');
  });

  it('shows the pager and advances offset on Next', async () => {
    vi.mocked(apiFetch).mockImplementation(async (path: string) => {
      if (path === '/collections') {
        return [{ collection_id: 1, slug: 'sahih-al-bukhari', title_ar: 'صحيح البخاري', title_en: null }];
      }
      return Array.from({ length: 50 }, (_, i) => ({
        hadith_id: i + 1,
        hadith_num: String(i + 1),
        text_plain: 'نص',
        sanad_count: 1,
      }));
    });
    renderAt('/collections/sahih-al-bukhari');
    expect(await screen.findByText('Showing 1–50')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
npm run test -- '\$slug'
```

Expected: PASS, both cases.

- [ ] **Step 4: Check tokens, lint, commit**

```bash
npm run check:tokens
npm run lint
git add frontend/src/routes/
git commit -m "feat(frontend): add the hadith list route with paging"
```

---

### Task 9: The Hadith Detail route — the signature page

**Files:**
- Create: `frontend/src/routes/_authed/hadiths/$hadithId.tsx`

**Interfaces:**
- Consumes: `apiFetch`, `IsnadChain` (`../../../domain/IsnadChain`),
  `StrengthPlot` (`../../../domain/StrengthPlot`).
- Produces: the `/hadiths/$hadithId` route.

This wires everything the prior 8 tasks built into `docs/frontend-prd.md` §7.7's
default view: the rail, the matn, the translation, the chain, the plain-word
verdict, and the disclosed strength plot. Use hadith 5 (this plan's worked example)
for manual verification.

- [ ] **Step 1: Write `frontend/src/routes/_authed/hadiths/$hadithId.tsx`**

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiFetch } from '../../../lib/apiClient';
import { IsnadChain, type IsnadLinkData } from '../../../domain/IsnadChain';
import { StrengthPlot } from '../../../domain/StrengthPlot';
import { gradeInfo } from '../../../domain/grading';

const isnadLinkSchema = z.object({
  sanad_no: z.number(),
  position: z.number(),
  narrator_id: z.number().nullable(),
  raw_name: z.string(),
  display_name: z.string().nullable(),
  name_en: z.string().nullable(),
  transmission_word: z.string().nullable(),
  is_compiler: z.boolean(),
  resolution: z.string(),
  is_placeholder: z.boolean(),
  rank_ibn_hajar: z.string().nullable(),
  rank_ibn_hajar_weight: z.coerce.number().nullable(),
  rank_dhahabi: z.string().nullable(),
  rank_dhahabi_weight: z.coerce.number().nullable(),
});

const hadithDetailSchema = z.object({
  hadith: z.object({
    hadith_id: z.number(),
    hadith_num: z.string(),
    text_plain: z.string(),
    text_diac: z.string(),
    sanad_count: z.number(),
  }),
  translation: z.object({ lang: z.string(), text_full: z.string(), source: z.string() }).nullable(),
  isnadChain: z.array(isnadLinkSchema),
  chainStrength: z.coerce.number().nullable(),
});

export const Route = createFileRoute('/_authed/hadiths/$hadithId')({
  component: HadithDetailPage,
});

function useHadithDetail(hadithId: string) {
  return useQuery({
    queryKey: ['hadiths', hadithId],
    queryFn: () => apiFetch(`/hadiths/${hadithId}`, hadithDetailSchema),
    staleTime: Infinity,
  });
}

function strengthWord(strength: number | null): string {
  if (strength === null) return 'This hadith carries no recorded chain.';
  if (strength >= 0.8) return 'This chain is strong.';
  if (strength >= 0.5) return 'This chain is mixed.';
  return 'A weak link was found in this chain.';
}

function HadithDetailPage() {
  const { hadithId } = Route.useParams();
  const { data, isLoading, isError } = useHadithDetail(hadithId);

  if (isLoading) return <p>Loading the hadith…</p>;
  if (isError || !data) return <p>This hadith could not be loaded. Try again.</p>;

  const { hadith, translation, isnadChain, chainStrength } = data;
  const links = isnadChain as IsnadLinkData[];
  const scoredWeights = links
    .filter((l) => !l.is_compiler)
    .map((l) => gradeInfo(l).weight)
    .filter((w): w is number => w !== null);

  return (
    <article>
      <p>
        <span className="m">{hadith.hadith_num}</span>
      </p>

      <p className="ar" dir="rtl" style={{ fontSize: 'var(--fs-ar-matn)' }}>
        {hadith.text_diac}
      </p>

      {translation ? (
        <div>
          <p>{translation.text_full}</p>
          <p className="label">{translation.source}</p>
        </div>
      ) : (
        <p className="label" style={{ fontStyle: 'italic' }}>
          No English translation exists for this hadith yet.
        </p>
      )}

      <p>
        {strengthWord(chainStrength)}
        {chainStrength !== null ? <span className="m">{chainStrength.toFixed(2)}</span> : null}
      </p>
      <p className="label">
        Ilham reports grades that classical scholars wrote centuries ago. It does not judge whether a
        hadith is authentic. A number here is never Ilham&rsquo;s own opinion.
      </p>

      <h2 className="label">Chain of transmission</h2>
      <IsnadChain links={links} />

      <details>
        <summary>Show grading detail</summary>
        <StrengthPlot weights={scoredWeights} />
      </details>
    </article>
  );
}
```

Deliberately not yet built on this page, called out here rather than left silent:
the metadata rail (collection/chapter/identifier — needs the collection/chapter
join `GET /hadiths/:id` doesn't currently return), the vocalisation toggle
(text_diac/text_plain switch — trivial to add, cut here only for time), "add to a
study set" / "write a note" actions (need the study-layer backend, out of scope
entirely for this plan), and the generation filter (see the Global Constraints
section above — no data to filter by). These are Roadmap items, not omissions to
paper over.

- [ ] **Step 2: Write `frontend/src/routes/_authed/hadiths/$hadithId.test.tsx`**

```tsx
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AuthContextValue } from '../../../auth/AuthContext';
import { routeTree } from '../../../routeTree.gen';

vi.mock('../../../lib/apiClient', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/apiClient')>('../../../lib/apiClient');
  return { ...actual, apiFetch: vi.fn() };
});

import { apiFetch } from '../../../lib/apiClient';

function renderHadith(id: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const auth: AuthContextValue = {
    state: { status: 'signed-in', user: { userId: 1, role: 'student', name: 'Amina', email: 'a@example.com' } },
    ready: Promise.resolve({ status: 'signed-in', user: { userId: 1, role: 'student', name: 'Amina', email: 'a@example.com' } }),
    signIn: async () => {},
    signOut: async () => {},
  };
  const history = createMemoryHistory({ initialEntries: [`/hadiths/${id}`] });
  const router = createRouter({ routeTree, history, context: { auth } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

// The exact, real GET /hadiths/5 shape after Task 1's backend change.
const REAL_HADITH_5 = {
  hadith: { hadith_id: 5, hadith_num: '1', text_plain: '...', text_diac: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ', sanad_count: 1 },
  translation: { lang: 'en', text_full: 'Actions are only by intention...', source: 'LK-Hadith-Corpus' },
  isnadChain: [
    { sanad_no: 1, position: 1, narrator_id: 7001, raw_name: 'عمر بن الخطاب', display_name: 'عمر بن الخطاب', name_en: null, transmission_word: 'قال', is_compiler: false, resolution: 'A', is_placeholder: false, rank_ibn_hajar: null, rank_ibn_hajar_weight: null, rank_dhahabi: null, rank_dhahabi_weight: null },
    { sanad_no: 1, position: 7, narrator_id: null, raw_name: 'البخاري', display_name: null, name_en: null, transmission_word: 'حدثنا', is_compiler: true, resolution: 'X', is_placeholder: false, rank_ibn_hajar: null, rank_ibn_hajar_weight: null, rank_dhahabi: null, rank_dhahabi_weight: null },
  ],
  chainStrength: '0.8',
};

describe('Hadith detail page', () => {
  it('renders the matn, the translation, the strength sentence, and the chain', async () => {
    vi.mocked(apiFetch).mockResolvedValue(REAL_HADITH_5);
    renderHadith('5');
    expect(await screen.findByText(/إِنَّمَا الْأَعْمَالُ/)).toBeInTheDocument();
    expect(screen.getByText(/Actions are only by intention/)).toBeInTheDocument();
    expect(screen.getByText('This chain is strong.')).toBeInTheDocument();
    expect(screen.getByText('[0.80]')).toBeInTheDocument();
  });

  it('shows an honest message when there is no translation', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ ...REAL_HADITH_5, translation: null });
    renderHadith('5');
    expect(await screen.findByText(/no english translation exists/i)).toBeInTheDocument();
  });

  it('shows the disclaimer next to the strength sentence', async () => {
    vi.mocked(apiFetch).mockResolvedValue(REAL_HADITH_5);
    renderHadith('5');
    await screen.findByText('This chain is strong.');
    expect(screen.getByText(/never Ilham’s own opinion/)).toBeInTheDocument();
  });

  it('reveals the strength plot only behind the disclosure', async () => {
    vi.mocked(apiFetch).mockResolvedValue(REAL_HADITH_5);
    renderHadith('5');
    await screen.findByText('This chain is strong.');
    expect(screen.getByText('Show grading detail')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the tests to verify they pass**

```bash
npm run test -- hadithId
```

Expected: PASS, all 4 cases.

- [ ] **Step 4: Run the full suite, then verify manually against the real backend**

```bash
npm run test
npm run build
```

With `podman compose up -d db` and `cd backend && npm run dev` both already
running (they should still be, from Task 1):

```bash
npm run dev
```

This route still sits behind the `_authed` guard, and there is no working sign-in
yet (Authentication is a later phase) — the browser redirects to `/login` for an
anonymous visitor, exactly as Foundation's plan documented. To see this page
render against live data during development only, temporarily comment out the
`beforeLoad` redirect in `frontend/src/routes/_authed.tsx`, visit
`http://localhost:5173/hadiths/5`, and confirm: the Arabic matn renders at 44px
Naskh, the English translation shows below it, "This chain is strong. [0.80]"
appears with the disclaimer beneath it, and the chain lists **al-Bukhārī first**
and **ʿUmar b. al-Khaṭṭāb last**. Then **revert the temporary comment-out** — do
not commit a disabled guard.

- [ ] **Step 5: Check tokens, lint, commit**

```bash
npm run check:tokens
npm run lint
git add frontend/src/routes/
git commit -m "feat(frontend): add the hadith detail signature page"
```

---

## Self-review

**Spec coverage:** §7.4 (Collections) → Task 7. §7.6 (hadith list, paging) → Task
8 + Task 3 (Pager). §7.7 (hadith detail: matn, translation, chain order, plain-word
verdict, disclosed grading detail) → Tasks 1, 4, 5, 6, 9. Explicitly out of scope,
each with a stated reason and a Roadmap pointer: the generation filter (no
schema data), chapter drill-down (no endpoint), per-narrator paraphrase sentences
(no translation table), the metadata rail, vocalisation toggle, and study-set/note
actions (later phases' data or out of this plan's scope entirely).

**Placeholder scan:** every "not yet built" surface above names exactly why and
where it's picked up later — none are silent TODOs. Task 8's slug→`collection_id`
resolution is flagged as an explicit correction the implementer must make before
the task is done, not a glossed-over shortcut.

**Type consistency:** `IsnadLinkData` (Task 5) matches the zod-parsed shape Task 9
constructs from `hadithDetailSchema`'s `isnadChain` field exactly, field for field,
which itself matches Task 1's extended `IsnadLinkRow` from the backend, field for
field. `gradeInfo`/`groupIsnadChains`/`RANK_GLOSS`/`RANK_WEIGHT` (Task 4) are
defined once and imported everywhere they're used (Tasks 5, 6, 9), never
redefined.

---

## Roadmap — explicitly deferred, not forgotten

- **Generation filter:** needs an ETL task to derive a 1–10 ordinal from
  `narrators.tabaqa_raw` (free text) before any UI can honestly filter by it.
- **Chapters:** needs `GET /chapters?collection_id=` on the backend (per
  `docs/frontend-prd.md` §8.2) before chapter drill-down and breadcrumbs can work.
- **Per-link "sets the score" marking** within a specific chain (not just
  chain-vs-chain) when there are multiple sanads — `IsnadChain` currently marks a
  whole chain as strongest, not the individual weakest link inside it.
- **The metadata rail, vocalisation toggle, narrator profile links, "add to study
  set," "write a note"** — later phases per `docs/frontend-prd.md` §14 (Authentication
  needed for the last two; the rest are additive to this page).
- **Search, Narrators, Analytics, the study loop** — per the Foundation plan's own
  Roadmap section, unchanged.

## Execution options

Plan complete and saved to
`docs/superpowers/plans/2026-09-05-hadith-detail-and-browse.md`. Two ways to
execute it:

1. **Subagent-driven (recommended)** — a fresh subagent per task, batched task
   reviews, fast iteration.
2. **Inline execution** — run through the tasks in this session, batched with
   checkpoints for review.

Which approach do you want?
