# Conventions

How to work in this repo. For what the app *is*, see `PRODUCT.md`. For how the code is laid out, see `ARCHITECTURE.md`.

---

## Ticket workflow (RES-N)

Commits and code comments reference ticket IDs like `RES-34`. The tickets
themselves live in a private tracker outside this repo; the IDs are here so the
history stays traceable.

- **Reference RES-N in commit messages and code comments** when the *why* is
  non-obvious. Example commit subject: `RES-28: fix toast getting stuck when
  mode flips during dismiss window`. Example inline comment:
  `// RES-34 makes ZOOM_OUT a proper resting state…`

---

## Testing

- **Runner**: Node built-in test runner. `npm test` runs `node --test 'lib/**/*.test.ts'`.
- **Location**: unit tests live next to the module — `lib/state.test.ts` covers `lib/state.ts`, etc.
- **Scope**: tests cover pure logic in `lib/` (reducers, jitter determinism, storage helpers). Components are not unit-tested.
- **UI verification**: type checks and unit tests do **not** prove the writing experience works. For animation/camera/UI changes, run `npm run dev` and exercise the feature in a browser (zoom in, type, fill a page, add to journal) before reporting done.

---

## Naming & organization

- **Components** are flat under `components/` — no nested folders. Animation components use the `*Animation.tsx` suffix (`PageTurnAnimation`, `JournalSlideAnimation`).
- **Lib modules** are lowercase, single-purpose (`jitter.ts`, `measure.ts`, `scene.ts`).
- **Scene constants** (page/desk geometry, zoom scale) live in `lib/scene.ts`. Don't inline magic numbers in components — add or reuse a constant.
- **State logic** stays in reducers (`lib/state.ts`, `lib/text.ts`). Don't drive transitions or text mutation from inside components.

---

## Branching

- Feature work happens on `feature/phaseN` branches (current: `feature/phase5`).
- PRs merge into `main`.
- Commit subjects start with the RES-N where applicable.

---

## Don'ts

- **Don't reintroduce `framer-motion`.** We use the standalone `motion` package — see `ARCHITECTURE.md`.
- **Don't inline layout magic numbers.** Add to `lib/scene.ts`.
- **Don't generate jitter with `Math.random()`.** Use `jitterFor(index)` from `lib/jitter.ts` so renders are stable across re-mounts.
- **Don't auto-return `ZOOM_OUT` to `DESK_IDLE`.** It's a resting state by design (RES-34).
- **Don't write character jitter values outside `makeChar`.** The seed is the absolute character index on the page.
- **Don't add doc/`*.md` files unless asked** (this convention applies to ad-hoc notes, not the docs in this folder).
