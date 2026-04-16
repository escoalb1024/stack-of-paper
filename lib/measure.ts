// RES-15 — Offscreen text-width measurer.
//
// The spec calls for a hidden offscreen element rendered in the same font
// as PageSurface so line widths can be tested independently of the visible
// DOM. The element is created once and reused across calls (font setup is
// idempotent; innerHTML is rewritten per measurement).
//
// Rendering parity with PageSurface:
//   • same fontFamily / fontSize / lineHeight
//   • each char in an inline-block span, spaces preserved via nbsp
//   • transforms (translate + rotate) are omitted — they don't affect
//     offsetWidth anyway. The last char's positive offsetX IS added as a
//     right-edge correction, because that's the only jitter component that
//     can push the rendered ink past the writable-area boundary.
//
// SSR-safe: callers only invoke this from layout effects / event handlers.
// A guard still early-returns 0 if document is missing so unit tests (or a
// hypothetical SSR invocation) don't crash.

import type { CharData } from "@/lib/text";

export interface MeasureOpts {
  fontFamily: string;
  fontSize: number; // px
  lineHeight: number; // unitless multiplier, to match PageSurface
  letterSpacing?: string; // optional CSS value; defaults to "normal"
}

const MEASURE_ID = "__morning-pages-measure";

function ensureElement(): HTMLDivElement | null {
  if (typeof document === "undefined") return null;
  let el = document.getElementById(MEASURE_ID) as HTMLDivElement | null;
  if (el) return el;
  el = document.createElement("div");
  el.id = MEASURE_ID;
  el.setAttribute("aria-hidden", "true");
  Object.assign(el.style, {
    position: "absolute",
    left: "-99999px",
    top: "-99999px",
    visibility: "hidden",
    pointerEvents: "none",
    whiteSpace: "nowrap",
    margin: "0",
    padding: "0",
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(el);
  return el;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Returns the rendered width of `chars` in px, or 0 if DOM is unavailable
// or the input is empty.
export function measureLineWidth(
  chars: readonly CharData[],
  opts: MeasureOpts,
): number {
  if (chars.length === 0) return 0;
  const el = ensureElement();
  if (!el) return 0;

  el.style.fontFamily = opts.fontFamily;
  el.style.fontSize = `${opts.fontSize}px`;
  el.style.lineHeight = String(opts.lineHeight);
  el.style.letterSpacing = opts.letterSpacing ?? "normal";

  let html = "";
  for (const c of chars) {
    const txt = c.char === " " ? "\u00a0" : escapeHtml(c.char);
    html += `<span style="display:inline-block">${txt}</span>`;
  }
  el.innerHTML = html;

  // Per-character jitter translates don't affect offsetWidth. The only
  // component that can push the visible ink past the right margin is a
  // positive offsetX on the trailing character, so add that as a boost.
  const lastOffsetX = chars[chars.length - 1].offsetX;
  const rightEdgeBoost = lastOffsetX > 0 ? lastOffsetX : 0;

  return el.offsetWidth + rightEdgeBoost;
}

// Decide where to wrap an overflowing line. Word-aware first (break after
// the last space so the trailing word moves cleanly to the next line),
// with character-level fallback when no interior space exists (e.g., a
// single word longer than the writable area).
//
// Assumes `chars` overflows by exactly one appended character — the effect
// runs after every APPEND_CHAR, so earlier state already fit. Returning 0
// means "don't wrap" (degenerate input).
export function pickWrapPoint(chars: readonly CharData[]): number {
  if (chars.length < 2) return 0;

  // Find the last interior space (exclude the trailing char — if it's a
  // space, it's the new word boundary we want to break past).
  let lastSpace = -1;
  for (let i = chars.length - 2; i > 0; i--) {
    if (chars[i].char === " ") {
      lastSpace = i;
      break;
    }
  }

  if (lastSpace > 0) {
    // Break right after the space so it stays on the completed line.
    return lastSpace + 1;
  }
  // No interior space — char-level break moves just the last char down.
  return chars.length - 1;
}
