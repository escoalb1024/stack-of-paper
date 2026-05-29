# Morning Pages — Product Vision

A desktop writing app that simulates the physical experience of handwriting on paper. Inspired by Julia Cameron's Morning Pages practice from *The Artist's Way*. The user types on their keyboard, but the interface presents a zoomed-in view of a pen on paper with their text rendered in a handwriting font, complete with a jittering hand, page turns, and a persistent journal for past entries.

This document is the **frozen product intent** — update it only when product direction changes. For how the code is organized, see `ARCHITECTURE.md`. For how to work in the repo, see `CONVENTIONS.md`.

---

## App States (the experience)

```
DESK_IDLE
  → click PageStack     → ZOOM_IN
  → click Journal        → JOURNAL_OPEN

ZOOM_IN (animated transition)
  → on animation complete → WRITING

WRITING
  → user types           → pen tracks, camera follows
  → page fills           → PAGE_TURN (sub-state) → WRITING
  → 3-page milestone     → show toast, keep writing
  → Esc                  → ZOOM_OUT

PAGE_TURN (sub-state of WRITING)
  → pen lifts, page slides to back of stack, new page slides up
  → pen lowers to top-left of new page
  → → WRITING

ZOOM_OUT
  → sees desk with written pages + "Add to Journal" button
  → click "Add to Journal" → JOURNAL_SLIDE → DESK_IDLE
  → click PageStack again  → ZOOM_IN (resume writing)

JOURNAL_OPEN
  → browse index, view past entries
  → Esc or close          → DESK_IDLE

JOURNAL_SLIDE (animated transition)
  → pages slide into journal
  → → DESK_IDLE
```

---

## Camera System

The desk is a fixed-size scene; a wrapper applies `transform: scale(s) translate(x, y)` for zoom.

| State | Transform |
|-------|-----------|
| DESK_IDLE | `scale(1) translate(0, 0)` |
| WRITING | `scale(~3.5) translate(-penX, -penY)` — recalculated as pen moves |
| ZOOM_IN | Animated spring from DESK_IDLE → WRITING transform |
| ZOOM_OUT | Animated spring from WRITING → DESK_IDLE transform |

### Gravity Tether (camera anchoring)

- Default: camera is anchored to pen tip position.
- On mouse move away from pen (to re-read earlier text): camera follows mouse, but accumulates a "pull" vector back toward the pen.
- The further from the pen, the stronger the rubber-band pull.
- On any keystroke: camera snaps back to pen immediately.
- Esc fully unlocks camera; typing re-engages the lock.

---

## Writing System

### Text input
- A hidden textarea captures all keyboard input.
- Each keystroke pushes a character into the data model.
- Each character renders as a span with individual transforms.

### Per-character jitter
- On each character insertion, generate deterministic random values from a seeded PRNG:
  - `rotation`: ±1.5°
  - `offsetY`: ±1px
  - `offsetX`: ±0.5px
- Values are stored on the character so re-renders stay stable.

### Line breaks
- Soft-wrap when the rendered line exceeds the writable area (page width minus margins).
- On wrap: pen slides left + down to the new line start.
- Enter inserts a manual break.

### Page breaks
- ~250 words per page at double-spacing on 8.5×11 equivalent.
- When lines exceed page capacity → PAGE_TURN.
- Pen lifts, current page slides down/scales to join the done stack, new blank page slides up, pen lowers to top-left.

### Visible area while writing
- ~55–60% of page width and ~15–20% of page height visible.
- Pen sits at ~60–70% from the left edge of the visible area.
- ~8–10 words visible to the left of the pen, ~4–5 lines vertically.
- Hand covers content to the right by design — simulates writing posture.

---

## Pen & Hand

- **Idle**: subtle sway, like a hand at rest.
- **Typing**: small rotation wobble (±2°) + tiny x/y shake on each keystroke, easing back over ~150ms.
- **Line break**: pen slides left to the new line start with a slight lift during travel.
- **Page turn**: pen lifts up and out, then re-enters at top-left of the new page.

---

## Desk & Background

- Solid muted color (warm gray, soft brown, muted sage — something that recedes).
- Film grain overlay, low opacity, `pointer-events: none`. Static is fine.
- Minimal — no other objects in v1.

---

## Pages Visual

- 8.5×11 paper proportions.
- White fill, very subtle drop shadow.
- Stack effect: 2 pages offset behind the active page (1–2px each, slight rotation variance).
- Page corners: optional curl/chip detail (deferred — see `ARCHITECTURE.md` divergences).
- Pages start unlined.

---

## Journal

### Closed
- Top-left of the desk. Looks like a small closed book.
- Visual indicator of contents (thickness/edges visible).

### Open
- Left page: index by date.
- Right page: selected entry rendered with the same handwriting font + jitter.
- Click a date → renders on the right page.
- Slide/fade between entries; book-flip animation is v2.
- Esc/close → DESK_IDLE.

---

## "Add to Journal" Flow

1. Esc during WRITING → ZOOM_OUT.
2. Camera pulls back, pages visible on the desk.
3. "Add to Journal" button appears.
4. Click → pages slide across the desk into the journal.
5. Entry status: `draft` → `journaled`.
6. Journal visual updates (slightly thicker).
7. Fresh page stack appears → DESK_IDLE.

If the user leaves without adding to journal:
- Entry stays `draft`.
- Same day: draft pages are still on the desk.
- New day: draft auto-promotes to `journaled`, fresh pages appear.

---

## Toast / Notifications

- 3-page completion: subtle "3 pages done ✓" toast, auto-dismiss after ~3 seconds. Non-intrusive, does not interrupt writing.

---

## Export

1. **Plain text** (`.txt`): raw text, pages separated by markers.
2. **Styled PDF**: each page's DOM rendered (handwriting font + jitter) into a PDF.

Available per-entry from the journal view.

---

## Aesthetic Direction

- **Tone**: warm, intimate, analog. A wooden desk in soft light.
- **Palette**: warm grays, cream paper, dark ink. Muted and receding.
- **Motion**: smooth springs, nothing snappy or digital. Easing should feel physical.
- **Typography**: handwriting font for written text; quiet sans-serif for UI.
- **Overall feel**: the app should disappear. The user should feel like they're writing on paper, not using software.
