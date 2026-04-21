// RES-34 — Arrow-key page navigation animation.
//
// Rendered while the FSM is in PAGE_NAV. Animates between two pages of the
// entry at the desk-view scale (no camera zoom) so the user can thumb
// through what they've written. Mirrors the physical feel of RES-18 page
// turns but is bidirectional: forward flips look like a page turn, backward
// flips look like its reverse (pulling the prior page off the done stack).
//
// Coordinates are desk-space. The overlay covers the whole desk and the
// paper + PageSurface inside keep their usual desk coordinates; only the
// wrapper transform moves.
//
// The static PageSurface beneath is hidden while this is mounted (see
// app/page.tsx) so the overlays are the only visible papers during the
// animation.

"use client";

import { motion } from "motion/react";
import { PAGE_HEIGHT } from "@/lib/scene";
import { Page } from "@/lib/text";
import { doneSlotOffset } from "./PageStack";
import { PageSurface } from "./PageSurface";
import {
  OVERLAY_STYLE,
  PAPER_STYLE,
  TRANSFORM_ORIGIN,
} from "./PageTurnAnimation";

// Faster than the full PAGE_NAV_DURATION (1.2s) — the page turn is a
// deliberate, one-way physical action, whereas flipping through to review
// happens repeatedly and benefits from a snappier beat. Slower than a pure
// UI "slide" (~0.3s) so it still reads as paper moving rather than a panel
// sliding.
const PAGE_NAV_DURATION = 0.7;

type Props = {
  outgoingPage: Page;
  incomingPage: Page;
  /**
   * Direction of navigation. "next" plays the RES-18 forward choreography:
   * outgoing settles onto the done stack, incoming rises from below. "prev"
   * mirrors it: outgoing slides down off-desk, incoming is lifted from the
   * done stack into the active slot.
   */
  direction: "next" | "prev";
  /**
   * Index used to compute the done-stack landing/source offset. For "next":
   * the outgoing page's ordinal (where it lands). For "prev": the incoming
   * page's ordinal (where it comes from). Kept consistent with PageStack so
   * the paper reads as the same physical sheet in both cases.
   */
  doneIndex: number;
  onComplete: () => void;
};

const FORWARD_EASE = [0.4, 0, 0.2, 1] as const;
const INCOMING_EASE = [0.2, 0.7, 0.2, 1] as const;

export function PageNavAnimation({
  outgoingPage,
  incomingPage,
  direction,
  doneIndex,
  onComplete,
}: Props) {
  const { offsetX: slotX, offsetY: slotY, rotate: slotRot } =
    doneSlotOffset(doneIndex);

  // Forward: outgoing → done slot, incoming ← below.
  // Backward: outgoing → below, incoming ← done slot. Mirror of the forward
  // motion so a prev-then-next feels like flipping one sheet back and
  // forward again.
  const BELOW = { x: 0, y: PAGE_HEIGHT + 60, rotate: 0 };
  const DONE = { x: slotX, y: slotY, rotate: slotRot };
  const ACTIVE = { x: 0, y: 0, rotate: 0 };

  const outgoingInitial = ACTIVE;
  const outgoingAnimate = direction === "next" ? DONE : BELOW;
  const incomingInitial = direction === "next" ? BELOW : DONE;
  const incomingAnimate = ACTIVE;

  // Match RES-18 easings so a forward nav looks indistinguishable from a
  // page turn. Backward swaps which overlay gets which curve — the paper
  // that "lifts off the stack" uses the slower settle; the one that slides
  // away uses the quicker ease.
  const outgoingEase = direction === "next" ? FORWARD_EASE : INCOMING_EASE;
  const incomingEase = direction === "next" ? INCOMING_EASE : FORWARD_EASE;

  return (
    <>
      <motion.div
        aria-hidden
        style={{ ...OVERLAY_STYLE, transformOrigin: TRANSFORM_ORIGIN, zIndex: 5 }}
        initial={outgoingInitial}
        animate={outgoingAnimate}
        transition={{ duration: PAGE_NAV_DURATION, ease: outgoingEase }}
      >
        <div style={PAPER_STYLE} />
        <PageSurface page={outgoingPage} />
      </motion.div>

      <motion.div
        aria-hidden
        style={{ ...OVERLAY_STYLE, transformOrigin: TRANSFORM_ORIGIN, zIndex: 6 }}
        initial={incomingInitial}
        animate={incomingAnimate}
        transition={{ duration: PAGE_NAV_DURATION, ease: incomingEase }}
        onAnimationComplete={onComplete}
      >
        <div style={PAPER_STYLE} />
        <PageSurface page={incomingPage} />
      </motion.div>
    </>
  );
}
