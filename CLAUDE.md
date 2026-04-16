@AGENTS.md
# Morning Pages — Writing App Spec
#morningPages
A desktop writing app that simulates the physical experience of handwriting on paper. Inspired by Julia Cameron's Morning Pages practice from *The Artist's Way*. The user types on their keyboard, but the interface presents a zoomed-in view of a pen on paper with their text rendered in a handwriting font, complete with a jittering hand, page turns, and a persistent journal for past entries.

---

## Tech Stack

- **Framework**: Next.js (React)
- **Styling**: Tailwind CSS
- **Animation**: Framer Motion
- **Storage**: IndexedDB via `idb-keyval`
- **Assets**: SVG for pen and hand (user will provide Figma exports)
- **Font**: Handwriting web font (Caveat, Kalam, or similar — pick one with good character coverage and natural feel)
- **Export**: Plain text `.txt` download + styled PDF via `html2canvas` + `jsPDF`

---

## App States (State Machine)

Manage via `useReducer`. Each state determines what's rendered and what interactions are active.

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

## Component Architecture

```
App
├── Desk                          // Root viewport, fixed canvas (1920×1200)
│   ├── GrainOverlay              // CSS pseudo-element or SVG feTurbulence, pointer-events: none
│   ├── Journal                   // Top-left corner, clickable
│   │   ├── JournalClosed         // Book cover visual
│   │   └── JournalOpen           // When JOURNAL_OPEN state
│   │       ├── IndexPage         // Left page: list of entries by date
│   │       └── EntryView         // Right page: selected entry rendered with jitter
│   ├── PageStack                 // Centered, bottom-aligned on desk
│   │   ├── PageBack2             // Decorative, offset behind
│   │   ├── PageBack1             // Decorative, offset behind
│   │   └── PageActive            // Top page, interactive
│   ├── WritingViewport           // Visible only in WRITING state
│   │   ├── CameraContainer       // motion.div with scale(~3.5) + translate, spring transitions
│   │   │   ├── PageSurface       // The "paper" at full size
│   │   │   │   └── TextLines     // Rendered character spans with jitter transforms
│   │   │   ├── PenHand           // SVG, absolutely positioned, tracks cursor
│   │   │   └── WritingCursor     // Blinking line at insertion point
│   │   └── HiddenTextarea        // Offscreen textarea capturing keystrokes
│   ├── AddToJournalButton        // Visible in ZOOM_OUT state after writing
│   └── PageCountIndicator        // Subtle current page / 3 indicator
└── Toast                         // "3 pages complete!" notification
```

---

## Camera System

The entire desk scene is a large fixed-size container. A wrapper `motion.div` applies `transform: scale(s) translate(x, y)` driven by Framer Motion.

| State | Transform |
|-------|-----------|
| DESK_IDLE | `scale(1) translate(0, 0)` |
| WRITING | `scale(~3.5) translate(-penX, -penY)` — recalculated as pen moves |
| ZOOM_IN | Animated spring from DESK_IDLE → WRITING transform |
| ZOOM_OUT | Animated spring from WRITING → DESK_IDLE transform |

### Gravity Tether (Camera Anchoring)

- Default: camera is anchored to pen tip position
- On mouse move away from pen (to re-read earlier text): camera follows mouse, but accumulates a "pull" vector back toward the pen
- The further from the pen, the stronger the rubber-band pull (spring physics)
- On any keystroke: camera snaps back to pen immediately (spring transition)
- Esc: fully unlocks camera for free scroll; typing re-engages the lock

---

## Writing System

### Text Input
- A hidden `<textarea>` captures all keyboard input
- Each keystroke pushes a character to the data model
- Rendered output: each character is a `<span>` with individual CSS transforms

### Per-Character Jitter
- On each character insertion, generate deterministic random values seeded by character index:
  - `rotation`: ±1.5°
  - `offsetY`: ±1px
  - `offsetX`: ±0.5px
  - Optional slight `letter-spacing` variance
- Store these values in the data model so re-renders are stable
- Use a seeded PRNG (e.g., simple mulberry32 with character index as seed)

### Line Break Logic
- Use a hidden offscreen measuring element: render the current line's text, measure `offsetWidth`
- When width exceeds the page's writable area (page width minus margins), soft-wrap to next line
- On wrap: animate pen sliding left + down to new line start position
- Support Enter key for manual line breaks

### Page Break Logic
- Track number of lines per page (based on double-spacing and page height)
- ~250 words per page at double-spacing on 8.5×11 equivalent
- When lines exceed page capacity → trigger PAGE_TURN sub-state
- Pen lifts (slight upward translate + rotation)
- Current page animates sliding down/scaling to join the "done" stack
- New blank page slides up from behind the stack
- Pen lowers to top-left of new page

### Visible Area While Writing
- Viewport shows ~55-60% of page width, ~15-20% of page height
- Pen/hand sits at roughly 60-70% from the left edge of the visible area
- ~8-10 words visible to the left of the pen
- ~4-5 double-spaced lines visible vertically
- Hand covers content to the right (by design — simulates writing posture)

---

## Pen & Hand

- **Assets**: SVG (user provides Figma exports, placeholder shapes initially)
- **Positioning**: Absolutely positioned, `transform: translate(x, y) rotate(r)` tracks the current character insertion point
- **Idle state**: Subtle idle sway animation (very gentle, like a hand at rest)
- **Typing state**: On each keystroke, trigger a jitter animation — small rotation wobble (±2°) + tiny x/y shake, easing back to resting position over ~150ms
- **Line break**: Animate sliding left to new line start, slight pen lift during travel
- **Page turn**: Pen lifts up and out, then re-enters at top-left of new page

---

## Desk & Background

- Solid muted color (warm gray, soft brown, or muted sage — pick something that recedes)
- Film grain overlay: SVG `<filter>` with `<feTurbulence>` at low opacity, or a small tiling noise PNG
  - `pointer-events: none`, fixed position, covers full viewport
  - Static grain is fine for v1 (no animated seed)
- Minimal — no other objects for v1

---

## Pages Visual

- Emulate 8.5×11 paper proportions
- White fill, very subtle drop shadow
- Stack effect: 2 pages offset slightly behind the active page (1-2px offset each, slightly different rotation for organic feel)
- Optional: one corner of the top page has a slight curl or chip (SVG path detail) for character
- Pages have a very faint lined or unlined texture (user preference, start unlined)

---

## Journal

### Closed State
- Positioned in top-left area of the desk
- Looks like a small closed book/notebook
- Visual indicator of how many entries are inside (thickness? page edges visible?)
- Clickable → opens to JOURNAL_OPEN state

### Open State (v1 — simplified)
- Left page: index listing entries by date (scrollable list if many)
- Right page: selected entry's text rendered with the same handwriting font + jitter transforms
- Navigation: click a date on the index → renders on the right page
- Slide/fade transitions between entries (book-flip animation is v2)
- Close button or Esc → DESK_IDLE

---

## Data Model

```typescript
interface CharData {
  char: string;
  rotation: number;    // ±1.5°
  offsetX: number;     // ±0.5px
  offsetY: number;     // ±1px
}

interface Line {
  chars: CharData[];
}

interface Page {
  lines: Line[];
}

interface Entry {
  id: string;
  date: string;         // "2026-04-13"
  status: "draft" | "journaled";
  pages: Page[];
  plainText: string;    // Derived, for easy export
  createdAt: number;    // timestamp
  updatedAt: number;    // timestamp
}
```

### Storage: IndexedDB via `idb-keyval`

- Key: entry ID
- Also maintain an index key listing all entry IDs + dates for the journal index

### Autosave
- Debounced save: 2-3 seconds after last keystroke
- Also save on every page turn
- Save on ZOOM_OUT

---

## Day Rollover Logic

On app load:
1. Check for a `draft` entry for today → show on desk, resume writing on click
2. Check for `draft` entries from previous days → auto-promote to `journaled` (they wrote but didn't explicitly save — preserve the work)
3. If no draft for today → show fresh blank page stack

---

## "Add to Journal" Flow

1. User hits Esc during WRITING → ZOOM_OUT
2. Camera pulls back to desk view, pages visible on desk
3. "Add to Journal" button appears (subtle, positioned near the pages)
4. Click → pages animate sliding across the desk into the journal
5. Entry status changes from `draft` to `journaled`
6. Journal visual updates (gets slightly thicker?)
7. Fresh page stack appears for potential new writing → DESK_IDLE

If the user leaves without adding to journal:
- Entry stays as `draft`
- On next visit same day: draft pages are on the desk
- On next visit new day: draft auto-promotes to `journaled`, fresh pages appear

---

## Toast / Notifications

- At 3-page completion: subtle toast "3 pages done ✓" — non-intrusive, auto-dismiss after 3 seconds
- Positioned top-center or bottom-center, above the writing area
- Does NOT interrupt writing flow

---

## Export

Two formats:
1. **Plain text** (`.txt`): just the raw text content, pages separated by `---` or page break markers
2. **Styled PDF**: render each page's DOM element (with handwriting font + jitter) via `html2canvas` → assemble pages into PDF with `jsPDF`

Accessible from the Journal view per-entry, or as a bulk export.

---

## Build Order (Suggested Phases)

### Phase 1 — Core Writing Experience
1. Desk component with grain background
2. Page stack (static visual, 3 pages with offsets/shadows)
3. Click-to-zoom animation (DESK_IDLE → ZOOM_IN → WRITING)
4. Hidden textarea + rendered text with handwriting font
5. Per-character jitter transforms
6. Pen/hand SVG tracking the cursor
7. Pen jitter animation on keystrokes
8. Camera following pen position

### Phase 2 — Page Management
9. Line measurement + soft wrapping
10. Line break pen animation
11. Page break detection
12. Page turn animation
13. Dynamic page creation beyond 3 pages

### Phase 3 — Persistence & Journal
14. IndexedDB storage + autosave
15. Day rollover logic
16. Zoom out + "Add to Journal" button + slide animation
17. Journal closed state visual
18. Journal open state with index + entry view

### Phase 4 — Polish
19. Gravity tether camera behavior
20. Toast notification at 3-page mark
21. Export (txt + PDF)
22. Page curl/chip detail on paper corners
23. Transition and animation refinement

---

## Aesthetic Direction

- **Tone**: Warm, intimate, analog. Like sitting at a wooden desk in soft light.
- **Palette**: Warm grays, cream paper, dark ink. Muted and receding — the writing is the focus.
- **Motion**: Smooth springs (Framer Motion), nothing snappy or digital-feeling. Easing should feel physical — like paper sliding, a hand settling.
- **Typography**: Handwriting font for all written text. UI elements (toast, buttons) in a clean, quiet sans-serif that doesn't compete.
- **Overall feel**: The app should disappear. The user should feel like they're writing on paper, not using software.

