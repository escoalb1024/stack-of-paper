// RES-9 — Renders the active page's text as individual per-character spans
// in a handwriting font.
//
// Positioned in desk-space, so it sits on top of the PageActive inside the
// scene and zooms along with everything else via CameraContainer. Each char
// gets its own transform so RES-10 jitter can drop in without changing the
// DOM structure.

import { CSSProperties, RefObject } from "react";
import {
  PAGE_ACTIVE_LEFT,
  PAGE_ACTIVE_TOP,
  WRITING_HEIGHT,
  WRITING_MARGIN_X,
  WRITING_MARGIN_Y,
  WRITING_WIDTH,
} from "@/lib/scene";
import { Page } from "@/lib/text";

const CHAR_SPAN: CSSProperties = {
  display: "inline-block",
  // Each char is positioned statically in flow, then nudged by its own
  // transform (offset + rotation). RES-10 populates non-zero values. Note:
  // we deliberately do NOT set `willChange: transform` here — the per-char
  // transforms are static (set at character creation, never animated), and
  // promoting 1000+ spans to their own compositor layers makes the RES-18
  // page-turn animation stutter badly every other turn.
};

// Font metrics — exported for cursor position calculation (RES-11) and the
// RES-15 soft-wrap measurer (lib/measure.ts reproduces these exactly).
// Sized so that when the camera zooms 3.5×, ~4–5 lines and ~8–10 words are
// visible (per the RES-9 visible-area spec).
export const TEXT_FONT_SIZE = 26;
export const TEXT_LINE_HEIGHT = 1.85;
export const TEXT_FONT_FAMILY = "var(--font-caveat), Caveat, 'Kalam', cursive";
export const LINE_HEIGHT_PX = Math.round(TEXT_FONT_SIZE * TEXT_LINE_HEIGHT);

// Lines that fit inside the writable area of a single page. RES-15 exposes
// this so RES-17 (page-fill detection) has an accurate threshold — at
// PAGE_WIDTH 520 / font 26 × 1.85, this is ~11 lines ≈ 250 words per page
// at double-spacing, matching the spec.
export const MAX_LINES_PER_PAGE = Math.max(
  1,
  Math.floor(WRITING_HEIGHT / LINE_HEIGHT_PX),
);

export function PageSurface({
  page,
  cursorRef,
}: {
  page: Page;
  cursorRef?: RefObject<HTMLSpanElement | null>;
}) {
  const lastLineIndex = page.lines.length - 1;
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: PAGE_ACTIVE_LEFT + WRITING_MARGIN_X,
        top: PAGE_ACTIVE_TOP + WRITING_MARGIN_Y,
        width: WRITING_WIDTH,
        fontFamily: TEXT_FONT_FAMILY,
        fontSize: TEXT_FONT_SIZE,
        lineHeight: TEXT_LINE_HEIGHT,
        color: "#1b1712", // warm near-black ink
        zIndex: 4,
        userSelect: "none",
        pointerEvents: "none",
        // Keep each line on one row internally — RES-15 soft-wrap splits
        // overflowed lines by mutating state, not by CSS word-wrap, so that
        // the per-character jitter transforms stay coherent across wraps.
        whiteSpace: "nowrap",
      }}
    >
      {page.lines.map((line, li) => (
        <div
          key={li}
          style={{
            // Keep empty lines tall so the pen (RES-11) can track blank lines.
            minHeight: LINE_HEIGHT_PX,
          }}
        >
          {line.chars.map((c, ci) => (
            <span
              key={ci}
              style={{
                ...CHAR_SPAN,
                transform: `translate(${c.offsetX}px, ${c.offsetY}px) rotate(${c.rotation}deg)`,
              }}
            >
              {/* Preserve spaces: inline-block spans collapse literal " ". */}
              {c.char === " " ? "\u00a0" : c.char}
            </span>
          ))}
          {/* RES-11: zero-width marker at the insertion point so PenHand can
              measure cursor x via offsetLeft. Only on the last (active) line. */}
          {li === lastLineIndex && (
            <span ref={cursorRef} style={{ display: "inline-block", width: 0 }} />
          )}
        </div>
      ))}
    </div>
  );
}
