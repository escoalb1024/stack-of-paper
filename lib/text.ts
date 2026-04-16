// Morning Pages — text data model + reducer (RES-9, RES-15).
//
// Kept separate from the mode FSM in lib/state.ts. The FSM is about
// transitions between DESK_IDLE/ZOOM/WRITING/etc; this reducer is about the
// content being written. RES-10 jitter is populated at character-creation
// time using an absolute-index-seeded PRNG (see lib/jitter.ts) so values are
// stable across re-renders. RES-15 adds WRAP_LINE for soft-wrap driven by
// the layout-time measurer (see lib/measure.ts + app/page.tsx).

// Relative (not "@/lib/jitter") so the node:test runner can load this file
// directly without a bundler resolving the path alias.
import { jitterFor } from "./jitter.ts";

export interface CharData {
  char: string;
  rotation: number;
  offsetX: number;
  offsetY: number;
}

export interface Line {
  chars: CharData[];
}

export interface Page {
  lines: Line[];
}

export interface TextState {
  pages: Page[];
  // Active page index. Phase 1 only uses 0; Phase 2 will append pages on fill.
  pageIndex: number;
}

export type TextAction =
  | { type: "APPEND_CHAR"; char: string }
  | { type: "NEWLINE" }
  | { type: "BACKSPACE" }
  // Soft-wrap: split the active (last) line at `breakAt`, moving chars at
  // indices [breakAt, end) to a fresh trailing line. Dispatched by the
  // layout-time measurer in app/page.tsx when the rendered line exceeds the
  // writable area. No-op if breakAt is out of range.
  | { type: "WRAP_LINE"; breakAt: number };

export const emptyPage = (): Page => ({ lines: [{ chars: [] }] });

export const initialTextState: TextState = {
  pages: [emptyPage()],
  pageIndex: 0,
};

// Factory for a CharData. `index` is the character's absolute position on
// its page — the PRNG seed — so the same slot always gets the same jitter.
export function makeChar(char: string, index: number): CharData {
  const { rotation, offsetX, offsetY } = jitterFor(index);
  return { char, rotation, offsetX, offsetY };
}

// Count characters across all lines of a page. Used to compute the absolute
// index of the next appended character.
function pageCharCount(page: Page): number {
  let n = 0;
  for (const line of page.lines) n += line.chars.length;
  return n;
}

function mutateActivePage(
  state: TextState,
  fn: (page: Page) => Page,
): TextState {
  const pages = state.pages.slice();
  pages[state.pageIndex] = fn(pages[state.pageIndex]);
  return { ...state, pages };
}

export function textReducer(state: TextState, action: TextAction): TextState {
  switch (action.type) {
    case "APPEND_CHAR":
      return mutateActivePage(state, (page) => {
        const lines = page.lines.slice();
        const last = lines[lines.length - 1];
        const index = pageCharCount(page);
        lines[lines.length - 1] = {
          chars: [...last.chars, makeChar(action.char, index)],
        };
        return { lines };
      });

    case "NEWLINE":
      return mutateActivePage(state, (page) => ({
        lines: [...page.lines, { chars: [] }],
      }));

    case "BACKSPACE":
      return mutateActivePage(state, (page) => {
        const lines = page.lines.slice();
        const last = lines[lines.length - 1];
        if (last.chars.length > 0) {
          lines[lines.length - 1] = { chars: last.chars.slice(0, -1) };
        } else if (lines.length > 1) {
          // Empty line: pop the line itself, merging back to the previous one.
          lines.pop();
        }
        return { lines };
      });

    case "WRAP_LINE":
      return mutateActivePage(state, (page) => {
        const lines = page.lines.slice();
        const lastIdx = lines.length - 1;
        const last = lines[lastIdx];
        const { breakAt } = action;
        if (breakAt <= 0 || breakAt >= last.chars.length) return page;
        lines[lastIdx] = { chars: last.chars.slice(0, breakAt) };
        lines.push({ chars: last.chars.slice(breakAt) });
        return { lines };
      });
  }
}

// Active page accessor — handy for consumers that only care about "now".
export function activePage(state: TextState): Page {
  return state.pages[state.pageIndex];
}
