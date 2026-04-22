// RES-18 — Page turn animation.
// RES-35 — Only the incoming page moves. The outgoing (just-filled) page
// sits still at the active slot showing its text; the new page rises from
// below the desk and covers it. The physical metaphor is "reach for a fresh
// sheet and lay it on top of what you just wrote," not "pick up the filled
// page, move it to the pile, and replace it" — the latter reads as two
// separate actions and feels unnatural.
//
// Rendered only during the PAGE_TURN state. Overlays:
//   • outgoing: static copy of the just-filled page at the active slot so
//     its text stays visible until the rising incoming paper covers it.
//   • incoming: the new blank (or post-split) page, slides up from below
//     the desk into the active slot.
// Both carry their page's text so content travels with the paper rather
// than popping. When the incoming animation settles we call onComplete,
// which dispatches PAGE_TURN_COMPLETE and hands control back to WRITING —
// at that point PageStack renders a new done paper behind the back pages.
// Because the outgoing overlay is covered by the incoming by the time we
// unmount, the handoff is not visible to the user.
//
// See AGENTS.md — this is not the Next.js you know; keep APIs aligned with
// the installed framer-motion.
//
// Coordinates are desk-space. The overlay motion.divs cover the whole desk so
// the nested absolutely-positioned paper + PageSurface keep their usual desk
// coordinates; the transform on the wrapper translates the incoming as a
// unit.
//
// IMPORTANT: this layer is purely visual. The mode FSM has already advanced
// pageIndex when PAGE_TURN begins, so the underlying PageSurface in app/page
// is already bound to the incoming page (hidden during the turn) — we render
// a second copy here for the slide-in so cursorRef measurement against the
// real PageSurface stays coherent.

"use client";

import { motion } from "motion/react";
import { useState } from "react";
import {
  DESK_HEIGHT,
  DESK_WIDTH,
  PAGE_ACTIVE_LEFT,
  PAGE_ACTIVE_TOP,
  PAGE_HEIGHT,
  PAGE_WIDTH,
} from "@/lib/scene";
import { getSlowMultiplier } from "@/lib/debug";
import { Page } from "@/lib/text";
import { PageSurface } from "./PageSurface";

export const PAPER_STYLE = {
  position: "absolute" as const,
  left: PAGE_ACTIVE_LEFT,
  top: PAGE_ACTIVE_TOP,
  width: PAGE_WIDTH,
  height: PAGE_HEIGHT,
  background: "#fbf7ef",
  boxShadow:
    "0 1px 1px rgba(0,0,0,0.08), 0 6px 14px rgba(0,0,0,0.12), 0 18px 36px rgba(0,0,0,0.10)",
  borderRadius: 2,
};

export const OVERLAY_STYLE = {
  position: "absolute" as const,
  left: 0,
  top: 0,
  width: DESK_WIDTH,
  height: DESK_HEIGHT,
  pointerEvents: "none" as const,
  // Promote each overlay to its own compositor layer so the transform
  // animation runs on the GPU as a single layer instead of asking the
  // browser to recomposite the entire subtree each frame. Pairs with the
  // decision to NOT layer-promote individual char spans in PageSurface
  // (Framer Motion will set `transform` on this div, which is what actually
  // triggers GPU layer creation).
  willChange: "transform" as const,
  backfaceVisibility: "hidden" as const,
};

const CENTER_X = PAGE_ACTIVE_LEFT + PAGE_WIDTH / 2;
const CENTER_Y = PAGE_ACTIVE_TOP + PAGE_HEIGHT / 2;
export const TRANSFORM_ORIGIN = `${CENTER_X}px ${CENTER_Y}px`;

// Total turn duration. Longer than the spec's 600–800ms target to read as a
// more deliberate, physical paper slide.
export const PAGE_TURN_DURATION = 1.2;

type Props = {
  outgoingPage: Page;
  incomingPage: Page;
  // Ordinal of the page just completed (0-based). Retained in the signature
  // for parity with callers and for the PageStack handoff semantics, though
  // it's no longer used here — the outgoing paper doesn't travel to the pile
  // as part of this animation.
  doneIndex: number;
  onComplete: () => void;
};

export function PageTurnAnimation({
  outgoingPage,
  incomingPage,
  onComplete,
}: Props) {
  // Read once on mount — the slow knob is a dev affordance, not meant to
  // react to URL changes mid-session.
  const [slow] = useState(() => getSlowMultiplier());
  const duration = PAGE_TURN_DURATION * slow;

  return (
    <>
      {/* Outgoing: static at the active slot so the user's text stays
          visible until the incoming paper covers it. zIndex sits above the
          decorative back pages (1/2) and below the incoming (6). */}
      <div aria-hidden style={{ ...OVERLAY_STYLE, zIndex: 4 }}>
        <div style={PAPER_STYLE} />
        <PageSurface page={outgoingPage} />
      </div>

      {/* Incoming: slides up from below into the active slot, covering the
          outgoing paper. Long decelerate so the new page settles rather
          than snaps into the slot. */}
      <motion.div
        aria-hidden
        style={{ ...OVERLAY_STYLE, transformOrigin: TRANSFORM_ORIGIN, zIndex: 6 }}
        initial={{ x: 0, y: PAGE_HEIGHT + 60, rotate: 0 }}
        animate={{ x: 0, y: 0, rotate: 0 }}
        transition={{ duration, ease: [0.2, 0.7, 0.2, 1] }}
        onAnimationComplete={onComplete}
      >
        <div style={PAPER_STYLE} />
        <PageSurface page={incomingPage} />
      </motion.div>
    </>
  );
}
