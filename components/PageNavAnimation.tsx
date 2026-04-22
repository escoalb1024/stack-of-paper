// RES-34 — Arrow-key page navigation animation.
// RES-35 — Mirrors the simplified page-turn metaphor: only one paper moves
// per navigation, and it's always the one on top of the stack.
//   • next: the incoming page rises from below the desk and covers the
//     current page. Outgoing (current) sits still underneath.
//   • prev: the outgoing page slides down off the desk, revealing the
//     previous page already sitting underneath. Incoming (previous) is
//     static.
// This avoids the "paper appears from behind the pile" motion that reads as
// unnatural — a page never travels to or from the back of the stack in this
// animation.
//
// Rendered while the FSM is in PAGE_NAV. Plays at the desk-view scale (no
// camera zoom) so the user can thumb through what they've written.
//
// Coordinates are desk-space. The overlay covers the whole desk and the
// paper + PageSurface inside keep their usual desk coordinates; only the
// moving overlay's wrapper transform animates.
//
// The static PageSurface beneath is hidden while this is mounted (see
// app/page.tsx) so the overlays are the only visible papers during the
// animation.

"use client";

import { motion } from "motion/react";
import { PAGE_HEIGHT } from "@/lib/scene";
import { Page } from "@/lib/text";
import { PageSurface } from "./PageSurface";
import {
  OVERLAY_STYLE,
  PAPER_STYLE,
  TRANSFORM_ORIGIN,
} from "./PageTurnAnimation";

// Faster than the full PAGE_TURN_DURATION (1.2s) — the page turn is a
// deliberate, one-way physical action, whereas flipping through to review
// happens repeatedly and benefits from a snappier beat. Slower than a pure
// UI "slide" (~0.3s) so it still reads as paper moving rather than a panel
// sliding.
const PAGE_NAV_DURATION = 0.7;

// Off-desk resting spot for the moving paper. Matches the page-turn's
// below-desk start/end so both animations share the same "below" position.
const BELOW_Y = PAGE_HEIGHT + 60;

// Motion curves. Forward uses a long decelerate so the rising incoming
// page settles into the slot. Backward uses a gentle ease so the outgoing
// page accelerates as it slides off.
const RISE_EASE = [0.2, 0.7, 0.2, 1] as const;
const FALL_EASE = [0.4, 0, 0.6, 1] as const;

type Props = {
  outgoingPage: Page;
  incomingPage: Page;
  /**
   * Direction of navigation. "next" raises the incoming page from below
   * into the active slot over the static outgoing. "prev" slides the
   * outgoing page down off the desk, revealing the static incoming
   * underneath.
   */
  direction: "next" | "prev";
  onComplete: () => void;
};

export function PageNavAnimation({
  outgoingPage,
  incomingPage,
  direction,
  onComplete,
}: Props) {
  // The paper that moves (and therefore owns onAnimationComplete) depends on
  // direction. Whichever paper isn't moving renders as a static underlayer.
  if (direction === "next") {
    return (
      <>
        {/* Outgoing (current page): static underneath. */}
        <div aria-hidden style={{ ...OVERLAY_STYLE, zIndex: 4 }}>
          <div style={PAPER_STYLE} />
          <PageSurface page={outgoingPage} />
        </div>

        {/* Incoming (next page): rises from below and covers. */}
        <motion.div
          aria-hidden
          style={{ ...OVERLAY_STYLE, transformOrigin: TRANSFORM_ORIGIN, zIndex: 6 }}
          initial={{ x: 0, y: BELOW_Y, rotate: 0 }}
          animate={{ x: 0, y: 0, rotate: 0 }}
          transition={{ duration: PAGE_NAV_DURATION, ease: RISE_EASE }}
          onAnimationComplete={onComplete}
        >
          <div style={PAPER_STYLE} />
          <PageSurface page={incomingPage} />
        </motion.div>
      </>
    );
  }

  // "prev": incoming (previous page) sits still; outgoing slides down off
  // the desk to reveal it.
  return (
    <>
      {/* Incoming (previous page): static underneath. */}
      <div aria-hidden style={{ ...OVERLAY_STYLE, zIndex: 4 }}>
        <div style={PAPER_STYLE} />
        <PageSurface page={incomingPage} />
      </div>

      {/* Outgoing (current page): slides down off the desk. */}
      <motion.div
        aria-hidden
        style={{ ...OVERLAY_STYLE, transformOrigin: TRANSFORM_ORIGIN, zIndex: 6 }}
        initial={{ x: 0, y: 0, rotate: 0 }}
        animate={{ x: 0, y: BELOW_Y, rotate: 0 }}
        transition={{ duration: PAGE_NAV_DURATION, ease: FALL_EASE }}
        onAnimationComplete={onComplete}
      >
        <div style={PAPER_STYLE} />
        <PageSurface page={outgoingPage} />
      </motion.div>
    </>
  );
}
