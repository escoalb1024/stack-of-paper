// RES-18 — Page turn animation.
//
// Rendered only during the PAGE_TURN state. Overlays two animated papers on
// top of the (hidden) active paper slot:
//   • outgoing: the just-filled page, slides down/back toward the "done"
//     stack behind the active slot.
//   • incoming: the new blank (or post-split) page, slides up from below the
//     desk into the active slot.
// Both carry their page's text so content travels with the paper rather than
// popping. When the incoming animation settles we call onComplete, which
// dispatches PAGE_TURN_COMPLETE and hands control back to WRITING.
//
// Total duration ~700ms per the spec (600–800ms).
// See AGENTS.md — this is not the Next.js you know; keep APIs aligned with
// the installed framer-motion.
//
// Coordinates are desk-space. The overlay motion.divs cover the whole desk so
// the nested absolutely-positioned paper + PageSurface keep their usual desk
// coordinates; the transform on the wrapper translates/rotates the pair as a
// unit.
//
// IMPORTANT: this layer is purely visual. The mode FSM has already advanced
// pageIndex when PAGE_TURN begins, so the underlying PageSurface in app/page
// is already bound to the incoming page (hidden during the turn) — we render
// a second copy here for the slide-in so cursorRef measurement against the
// real PageSurface stays coherent.

"use client";

import { motion } from "motion/react";
import {
  DESK_HEIGHT,
  DESK_WIDTH,
  PAGE_ACTIVE_LEFT,
  PAGE_ACTIVE_TOP,
  PAGE_HEIGHT,
  PAGE_WIDTH,
} from "@/lib/scene";
import { Page } from "@/lib/text";
import { doneSlotOffset } from "./PageStack";
import { PageSurface } from "./PageSurface";

const PAPER_STYLE = {
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

const OVERLAY_STYLE = {
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
const TRANSFORM_ORIGIN = `${CENTER_X}px ${CENTER_Y}px`;

// Total turn duration. Longer than the spec's 600–800ms target to read as a
// more deliberate, physical paper slide.
export const PAGE_TURN_DURATION = 1.2;

type Props = {
  outgoingPage: Page;
  incomingPage: Page;
  // Ordinal of the page just completed (0-based). Used to compute a landing
  // spot behind the active slot so successive turns stagger naturally.
  doneIndex: number;
  onComplete: () => void;
};

export function PageTurnAnimation({
  outgoingPage,
  incomingPage,
  doneIndex,
  onComplete,
}: Props) {
  // Where the outgoing page settles in the "done" stack. Matches the offsets
  // used by PageStack for finished pages so there's no pop on handoff. RES-19:
  // doneSlotOffset clamps past MAX_DONE_VISIBLE, so beyond the cap the outgoing
  // page lands on the deepest visible slot (stacking on top of the existing
  // paper there) rather than drifting further off.
  const { offsetX: landX, offsetY: landY, rotate: landRot } =
    doneSlotOffset(doneIndex);

  return (
    <>
      {/* Outgoing: slides down/back toward the done stack. */}
      <motion.div
        aria-hidden
        style={{ ...OVERLAY_STYLE, transformOrigin: TRANSFORM_ORIGIN, zIndex: 5 }}
        initial={{ x: 0, y: 0, rotate: 0 }}
        animate={{ x: landX, y: landY, rotate: landRot }}
        // Gentle ease-in-out so the outgoing page lingers briefly at the
        // start (as if being set aside) before settling into the stack.
        transition={{ duration: PAGE_TURN_DURATION, ease: [0.4, 0, 0.2, 1] }}
      >
        <div style={PAPER_STYLE} />
        <PageSurface page={outgoingPage} />
      </motion.div>

      {/* Incoming: slides up from below into the active slot. */}
      <motion.div
        aria-hidden
        style={{ ...OVERLAY_STYLE, transformOrigin: TRANSFORM_ORIGIN, zIndex: 6 }}
        initial={{ x: 0, y: PAGE_HEIGHT + 60, rotate: 0 }}
        animate={{ x: 0, y: 0, rotate: 0 }}
        // Softer landing than the outgoing curve — a long decelerate so the
        // new page settles rather than snaps into the slot.
        transition={{ duration: PAGE_TURN_DURATION, ease: [0.2, 0.7, 0.2, 1] }}
        onAnimationComplete={onComplete}
      >
        <div style={PAPER_STYLE} />
        <PageSurface page={incomingPage} />
      </motion.div>
    </>
  );
}
