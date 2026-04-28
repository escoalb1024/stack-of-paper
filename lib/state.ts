// Morning Pages — app state machine (RES-8, RES-34).
//
// Full FSM (from spec):
//   DESK_IDLE     → click PageStack      → ZOOM_IN
//   ZOOM_IN       → animation complete   → WRITING
//   WRITING       → Esc                  → ZOOM_OUT
//   WRITING       → page fills           → PAGE_TURN → WRITING
//   ZOOM_OUT      → click "Add to Journal" → JOURNAL_SLIDE
//   ZOOM_OUT      → click PageStack      → ZOOM_IN (resume)
//   ZOOM_OUT      → ← / →                → PAGE_NAV → ZOOM_OUT
//   ZOOM_OUT      → click Journal        → JOURNAL_OPEN
//   JOURNAL_SLIDE → animation complete   → DESK_IDLE
//   DESK_IDLE     → click Journal        → JOURNAL_OPEN
//   JOURNAL_OPEN  → Esc/close            → DESK_IDLE or ZOOM_OUT (returnTo)
//
// RES-34 makes ZOOM_OUT a proper resting state (no auto-return to DESK_IDLE)
// and adds PAGE_NAV for the arrow-key flip-through animation. DESK_IDLE is
// now only reached by completing the JOURNAL_SLIDE into the journal.

export type AppState =
  | "DESK_IDLE"
  | "ZOOM_IN"
  | "WRITING"
  | "PAGE_TURN"
  | "ZOOM_OUT"
  | "PAGE_NAV"
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
  // returnTo lets a ZOOM_OUT → JOURNAL_OPEN → close round-trip return to
  // ZOOM_OUT instead of DESK_IDLE, preserving the on-desk draft view. Defaults
  // to DESK_IDLE when omitted (the original click-from-desk path).
  | { type: "CLOSE_JOURNAL"; returnTo?: "DESK_IDLE" | "ZOOM_OUT" }
  | { type: "PAGE_FILLED" }
  | { type: "PAGE_TURN_COMPLETE" }
  | { type: "NAV_START" }
  | { type: "NAV_COMPLETE" };

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
      if (action.type === "CLICK_PAGE_STACK") return "ZOOM_IN";
      if (action.type === "CLICK_ADD_TO_JOURNAL") return "JOURNAL_SLIDE";
      if (action.type === "NAV_START") return "PAGE_NAV";
      if (action.type === "CLICK_JOURNAL") return "JOURNAL_OPEN";
      return state;

    case "PAGE_NAV":
      if (action.type === "NAV_COMPLETE") return "ZOOM_OUT";
      return state;

    case "JOURNAL_SLIDE":
      if (action.type === "JOURNAL_SLIDE_COMPLETE") return "DESK_IDLE";
      return state;

    case "JOURNAL_OPEN":
      if (action.type === "CLOSE_JOURNAL") return action.returnTo ?? "DESK_IDLE";
      return state;
  }
}

// True while the camera should be zoomed onto the page (ZOOM_IN springs in,
// WRITING holds, PAGE_TURN stays zoomed). ZOOM_OUT and PAGE_NAV stay pulled
// back at the desk.
export function isCameraZoomed(state: AppState): boolean {
  return state === "ZOOM_IN" || state === "WRITING" || state === "PAGE_TURN";
}
