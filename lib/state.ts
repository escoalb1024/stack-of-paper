// Morning Pages — app state machine (RES-8)
//
// Full FSM (from spec):
//   DESK_IDLE     → click PageStack      → ZOOM_IN
//   ZOOM_IN       → animation complete   → WRITING
//   WRITING       → Esc                  → ZOOM_OUT
//   WRITING       → page fills           → PAGE_TURN → WRITING
//   ZOOM_OUT      → click "Add to Journal" → JOURNAL_SLIDE
//   ZOOM_OUT      → click PageStack      → ZOOM_IN (resume)
//   JOURNAL_SLIDE → animation complete   → DESK_IDLE
//   DESK_IDLE     → click Journal        → JOURNAL_OPEN
//   JOURNAL_OPEN  → Esc/close            → DESK_IDLE
//
// Phase 1 RES-8 scope: DESK_IDLE ↔ ZOOM_IN ↔ WRITING ↔ ZOOM_OUT.
// Later phases fill in PAGE_TURN, JOURNAL_SLIDE, JOURNAL_OPEN.

export type AppState =
  | "DESK_IDLE"
  | "ZOOM_IN"
  | "WRITING"
  | "PAGE_TURN"
  | "ZOOM_OUT"
  | "JOURNAL_SLIDE"
  | "JOURNAL_OPEN";

export type Action =
  | { type: "CLICK_PAGE_STACK" }
  | { type: "ZOOM_IN_COMPLETE" }
  | { type: "ESC_PRESSED" }
  | { type: "ZOOM_OUT_COMPLETE" }
  | { type: "CLICK_ADD_TO_JOURNAL" }
  | { type: "JOURNAL_SLIDE_COMPLETE" }
  | { type: "CLICK_JOURNAL" }
  | { type: "CLOSE_JOURNAL" }
  | { type: "PAGE_FILLED" }
  | { type: "PAGE_TURN_COMPLETE" };

export const initialState: AppState = "DESK_IDLE";

export function reducer(state: AppState, action: Action): AppState {
  switch (state) {
    case "DESK_IDLE":
      if (action.type === "CLICK_PAGE_STACK") return "ZOOM_IN";
      if (action.type === "CLICK_JOURNAL") return "JOURNAL_OPEN";
      return state;

    case "ZOOM_IN":
      if (action.type === "ZOOM_IN_COMPLETE") return "WRITING";
      return state;

    case "WRITING":
      if (action.type === "ESC_PRESSED") return "ZOOM_OUT";
      if (action.type === "PAGE_FILLED") return "PAGE_TURN";
      return state;

    case "PAGE_TURN":
      if (action.type === "PAGE_TURN_COMPLETE") return "WRITING";
      return state;

    case "ZOOM_OUT":
      // ZOOM_OUT is the resting state after zooming out — user can resume or journal.
      // For RES-8 we auto-return to DESK_IDLE when the animation completes so Esc
      // from WRITING lands cleanly back at the desk view.
      if (action.type === "ZOOM_OUT_COMPLETE") return "DESK_IDLE";
      if (action.type === "CLICK_PAGE_STACK") return "ZOOM_IN";
      if (action.type === "CLICK_ADD_TO_JOURNAL") return "JOURNAL_SLIDE";
      return state;

    case "JOURNAL_SLIDE":
      if (action.type === "JOURNAL_SLIDE_COMPLETE") return "DESK_IDLE";
      return state;

    case "JOURNAL_OPEN":
      if (action.type === "CLOSE_JOURNAL") return "DESK_IDLE";
      return state;
  }
}

// True while the camera should be zoomed onto the page (ZOOM_IN springs in,
// WRITING holds, PAGE_TURN stays zoomed). ZOOM_OUT springs back out.
export function isCameraZoomed(state: AppState): boolean {
  return state === "ZOOM_IN" || state === "WRITING" || state === "PAGE_TURN";
}
