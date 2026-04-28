// RES-23 — JOURNAL_SLIDE animation.
//
// When the user hits "Add to Journal" we slide the on-desk page stack across
// to the journal in the corner: each paper translates + rotates from the
// PageStack footprint to the journal book footprint, scaling down a touch and
// fading as it tucks into the cover. Renders during `mode === JOURNAL_SLIDE`
// in place of PageStack (which is hidden by the parent during this state).
//
// The animation is intentionally short and deterministic — a fixed-duration
// tween rather than a spring — so the parent can rely on a single onComplete
// fire to advance the FSM and reset state without racing setTimeouts.

"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import {
  JOURNAL_BOOK_WIDTH,
  JOURNAL_LEFT,
  JOURNAL_ROTATION_DEG,
  JOURNAL_TOP,
} from "./JournalClosed";
import { doneSlotOffset, MAX_DONE_VISIBLE } from "./PageStack";
import {
  PAGE_ACTIVE_LEFT,
  PAGE_ACTIVE_TOP,
  PAGE_HEIGHT,
  PAGE_WIDTH,
} from "@/lib/scene";

const SLIDE_DURATION_S = 0.95;
// Match the JournalClosed cover size; the slide lands the pages roughly
// centered on the cover so they read as being tucked between the boards.
const TARGET_SCALE = 0.7;
// Center the (already-rotated) page footprint on the cover.
const TARGET_CENTER_X =
  JOURNAL_LEFT + JOURNAL_BOOK_WIDTH / 2 - (PAGE_WIDTH * TARGET_SCALE) / 2;
const TARGET_CENTER_Y =
  JOURNAL_TOP + 60;

type JournalSlideAnimationProps = {
  doneCount: number;
  onComplete: () => void;
};

export function JournalSlideAnimation({
  doneCount,
  onComplete,
}: JournalSlideAnimationProps) {
  // Single timer drives the FSM transition. We avoid relying on Framer's
  // onAnimationComplete here because each paper has its own animation and
  // staggered delay; a single source-of-truth timeout keeps the handoff
  // predictable.
  useEffect(() => {
    const t = setTimeout(onComplete, SLIDE_DURATION_S * 1000 + 80);
    return () => clearTimeout(t);
  }, [onComplete]);

  // Render the same pile shape PageStack uses: capped done slices behind the
  // active paper, each at its accumulating offset. This way the slide reads
  // as the entire pile moving, not just one sheet.
  const shownDone = Math.min(doneCount, MAX_DONE_VISIBLE);
  const papers: {
    key: string;
    fromX: number;
    fromY: number;
    fromRotate: number;
    zIndex: number;
    delay: number;
  }[] = [];
  for (let i = 0; i < shownDone; i++) {
    const slot = doneSlotOffset(i);
    papers.push({
      key: `slide-done-${i}`,
      fromX: PAGE_ACTIVE_LEFT + slot.offsetX,
      fromY: PAGE_ACTIVE_TOP + slot.offsetY,
      fromRotate: slot.rotate,
      zIndex: 10 - i,
      delay: 0,
    });
  }
  // Active paper sits on top and trails the pile by a beat so the eye reads
  // the cover (active sheet) sliding last, like skimming the stack across.
  papers.push({
    key: "slide-active",
    fromX: PAGE_ACTIVE_LEFT,
    fromY: PAGE_ACTIVE_TOP,
    fromRotate: 0,
    zIndex: 20,
    delay: 0.04,
  });

  return (
    <>
      {papers.map((p) => (
        <motion.div
          key={p.key}
          initial={{
            x: p.fromX,
            y: p.fromY,
            rotate: p.fromRotate,
            scale: 1,
            opacity: 1,
          }}
          animate={{
            x: TARGET_CENTER_X,
            y: TARGET_CENTER_Y,
            rotate: JOURNAL_ROTATION_DEG,
            scale: TARGET_SCALE,
            opacity: 0,
          }}
          transition={{
            duration: SLIDE_DURATION_S,
            ease: [0.4, 0.0, 0.2, 1],
            delay: p.delay,
            opacity: {
              duration: SLIDE_DURATION_S * 0.55,
              delay: p.delay + SLIDE_DURATION_S * 0.45,
              ease: "easeIn",
            },
          }}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: PAGE_WIDTH,
            height: PAGE_HEIGHT,
            background: "#fbf7ef",
            borderRadius: 2,
            boxShadow:
              "0 1px 1px rgba(0,0,0,0.08), 0 6px 14px rgba(0,0,0,0.12), 0 18px 36px rgba(0,0,0,0.10)",
            transformOrigin: "50% 50%",
            zIndex: p.zIndex,
          }}
        />
      ))}
    </>
  );
}
