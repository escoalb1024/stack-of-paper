@AGENTS.md
@docs/ARCHITECTURE.md
@docs/CONVENTIONS.md

# Morning Pages

A desktop writing app that simulates handwriting on paper. Inspired by Julia Cameron's Morning Pages from *The Artist's Way*. The MVP is shipped (Phases 1–4); current work is bug-fix and refinement on `feature/phase5`.

## Read first

- `docs/PRODUCT.md` — frozen product vision (what the app *is* and how it should feel). Read on demand when product intent matters.
- `docs/ARCHITECTURE.md` — current code reality (auto-loaded above): tech stack, dual-reducer state, lib modules, components, data model, and divergences from the original spec.
- `docs/CONVENTIONS.md` — how to work here (auto-loaded above): RES-N ticket workflow, testing, naming, branching, do/don'ts.

## Ticket history (Obsidian vault)

Per-ticket worklogs and phase rollups live outside the repo at:

```
/Users/alberte/Documents/Obsidian Vault/Projects/writingApp/
├── Stack of Papers - Project Spec.md   Original product spec (longer than docs/PRODUCT.md)
└── Tickets/
    ├── phase-1..5-*.md                  Phase summaries
    └── RES-N-<slug>.md                  ~30 ticket files — canonical record of what shipped
```

The vault is registered as an additional working directory; read tickets directly before extending a feature. See `docs/CONVENTIONS.md` for the RES-N convention and the `close-obsidian-ticket` skill.

# userEmail
The user's email address is escoalb1024@gmail.com.

# currentDate
Today's date is 2026-05-04.
