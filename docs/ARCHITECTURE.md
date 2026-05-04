# Architecture

How the Morning Pages codebase is actually organized today. This is the agent-facing map of the running MVP — for product intent, see `PRODUCT.md`; for working conventions, see `CONVENTIONS.md`.

---

## Tech stack (actual)

- **Framework**: Next.js `16.2.3`, React `19.2.4` — App Router. Note: this Next.js has breaking changes from older versions; see `AGENTS.md` and `node_modules/next/dist/docs/` before writing Next.js-specific code.
- **Animation**: `motion` `^12.38` (the standalone `motion` package). **Not** Framer Motion — do not reintroduce `framer-motion`.
- **Styling**: Tailwind CSS v4 (`@tailwindcss/postcss`).
- **Storage**: `idb-keyval` `^6.2` over IndexedDB.
- **Export**: `html2canvas` + `jspdf`.
- **Tests**: Node built-in test runner. Script: `npm test` (`node --test 'lib/**/*.test.ts'`).
- **Lint/Types**: `eslint` (`eslint-config-next`), TypeScript 5.

---

## Top-level layout

```
app/             Next.js App Router entry — page.tsx, layout.tsx, globals.css
components/      All UI components (15 files, flat — no nesting)
lib/             State machines, reducers, persistence, utilities, and their unit tests
public/          Static assets (SVG hand, icons)
docs/            PRODUCT / ARCHITECTURE / CONVENTIONS (this folder)
CLAUDE.md        Router doc — orientation for agents
AGENTS.md        Next.js version warning (auto-included via @AGENTS.md)
```

---

## State management — dual reducer pattern

The app runs on two independent `useReducer`s:

### `lib/state.ts` — app-mode FSM

Tracks where the user is in the experience. States:

```
DESK_IDLE → ZOOM_IN → WRITING → PAGE_TURN → WRITING
                          ↓ Esc
                       ZOOM_OUT ⇄ PAGE_NAV
                          ↓ Add to Journal
                       JOURNAL_SLIDE → DESK_IDLE

JOURNAL_OPEN reachable from DESK_IDLE or ZOOM_OUT (returnTo preserves origin)
```

Notable beyond the original spec:
- **`PAGE_NAV`** (RES-34): arrow-key flip-through animation on the desk while in `ZOOM_OUT`.
- **`JOURNAL_SLIDE`** is its own state (animated transition into the journal).
- **`ZOOM_OUT` is a resting state** — it does not auto-return to `DESK_IDLE`. Only completing `JOURNAL_SLIDE` (Add to Journal) lands in `DESK_IDLE`.
- **`returnTo`** on `CLOSE_JOURNAL` lets a `ZOOM_OUT → JOURNAL_OPEN → close` round-trip return to `ZOOM_OUT` instead of `DESK_IDLE`, preserving the on-desk draft view.
- Helper `isCameraZoomed(state)` — true during `ZOOM_IN | WRITING | PAGE_TURN`.

### `lib/text.ts` — content reducer

Tracks the written content. Shape:

```ts
TextState { pages: Page[]; pageIndex: number }
Page      { lines: Line[] }
Line      { chars: CharData[] }
CharData  { char; rotation; offsetX; offsetY }
```

Actions: `APPEND_CHAR`, `NEWLINE`, `BACKSPACE`, `WRAP_LINE`, `ADD_PAGE`, `HYDRATE`, `RESET`.

Why split: mode transitions and text mutation are orthogonal. Keeping them separate makes each reducer unit-testable in isolation (`state.test.ts`, `text.test.ts`) and prevents either from accidentally driving the other.

---

## Key `lib/` modules

| Module | Purpose |
|---|---|
| `state.ts` | App-mode FSM (above). |
| `text.ts` | Content reducer + `CharData`/`Page`/`Line` types + `makeSeparatorPage` / `isSeparatorPage` (RES-36). |
| `jitter.ts` | Seeded `mulberry32` PRNG. `jitterFor(index)` returns deterministic rotation/offset for a character's absolute index on its page. |
| `measure.ts` | Offscreen DOM measurer. Drives soft-wrap by comparing rendered `offsetWidth` against `WRITING_WIDTH`. |
| `scene.ts` | Layout constants (desk + page geometry, `ZOOM_SCALE`). **Single source of truth — change here, not inline in components.** |
| `storage.ts` | IndexedDB persistence via `idb-keyval`. Entry shape, ISO-date keys (`entry:YYYY-MM-DD`), `loadEntry` / `saveEntry` / `deleteEntry`, `promoteStaleDrafts` (RES-22 day rollover), `listJournaledEntries`, `derivePlainText`. |
| `export.ts` | `.txt` and styled `.pdf` export via `html2canvas` + `jsPDF` (RES-29). |
| `debug.ts` | Dev helpers. |

Tests live alongside as `*.test.ts` and run under `node --test`.

---

## Component map (`components/`)

Flat folder, role-grouped:

- **Root scene**: `Desk.tsx`, `GrainOverlay.tsx`
- **Camera**: `CameraContainer.tsx` (applies scale/translate via `motion`)
- **Pages on the desk**: `PageStack.tsx`, `PageSurface.tsx`
- **Writing surface**: `PenHand.tsx`, `HiddenTextarea.tsx`
- **Animations** (`*Animation.tsx` suffix is the convention): `PageTurnAnimation.tsx`, `PageNavAnimation.tsx`, `JournalSlideAnimation.tsx`
- **Journal**: `JournalClosed.tsx`, `JournalOpen.tsx`
- **UI overlays**: `Toast.tsx`, `PageCountIndicator.tsx`, `AddToJournalButton.tsx`

`app/page.tsx` wires the two reducers, mounts the offscreen measurer, and dispatches `WRAP_LINE` / `ADD_PAGE` from layout-time measurements.

---

## Data model (persistence)

Defined in `lib/storage.ts`:

```ts
type EntryStatus = "draft" | "journaled";

interface Entry {
  id: string;          // same as date for now
  date: string;        // local ISO date, "YYYY-MM-DD"
  status: EntryStatus;
  pages: Page[];       // shape from lib/text.ts
  plainText: string;   // derived for export
  createdAt: number;
  updatedAt: number;
}
```

- One entry per local day, keyed `entry:YYYY-MM-DD` (local date, not UTC — "today" follows the user's clock).
- Autosave is caller-driven from `app/page.tsx` (debounced on textState change).
- Day rollover on mount: `promoteStaleDrafts(today)` flips any pre-today drafts to `journaled` so work is preserved.
- Same-day re-add (RES-36): `makeSeparatorPage` / `isSeparatorPage` insert a visible divider page when the user adds to the journal more than once in a day.

---

## Notable divergences from the original spec

These are intentional — don't "fix" them without checking the relevant ticket first.

- **`motion` package, not Framer Motion.** Original spec said Framer Motion; we ship the standalone `motion` package.
- **Per-character jitter seed is per-page absolute index**, not a global character index. Wrapping/page splits preserve the seed so visuals stay stable across mutations.
- **`ZOOM_OUT` is a resting state** (RES-34). Original spec implied auto-return to `DESK_IDLE`; current behavior keeps the user on the desk with pages visible until they explicitly Add to Journal.
- **Soft-wrap is layout-driven.** `app/page.tsx` mounts an offscreen measurer and dispatches `WRAP_LINE` / `ADD_PAGE` based on real `offsetWidth` — line capacity isn't pre-computed.
- **Page curl/chip detail** — not implemented.
- **Book-flip journal animation** — deferred to v2; current journal uses slide/fade transitions.
- **RES-N labeling** — not in the original spec; added during the build for traceability (see `CONVENTIONS.md`).
