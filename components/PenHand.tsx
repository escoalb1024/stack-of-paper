// RES-11 — Pen/hand SVG that tracks the current character insertion point.
// RES-12 — Keystroke jitter: additive micro-animation on each keystroke.
//
// Absolutely positioned in desk-space inside the Desk component. The pen tip
// (nib) aligns with the cursor coordinates passed via props. A subtle idle
// sway animation gives the hand a natural at-rest feel.
//
// On each keystroke a nested motion.div applies a quick rotation wobble (±2°)
// and tiny x/y shake that eases back over ~150ms, simulating the physical
// motion of writing.
//
// RES-16 — Line break: when the active page grows a new line, the pen
// performs a short "lift" (upward translate + subtle rotation) while the
// outer x/y spring carries it left+down to the new line start. The lift
// lives on a nested motion.div so it composes additively with keystroke
// jitter and the cursor-tracking spring.
//
// Page turn pen animation is a later ticket.

"use client";

import { useEffect, useRef } from "react";
import { motion, useAnimate } from "motion/react";

// The SVG viewBox is 0 0 787 681. The pen nib (small gray square) sits at
// approximately (11, 459) in SVG space. We scale the SVG down so it looks
// natural next to 26px desk-space text at 3.5x zoom.
const SVG_WIDTH = 787;
const SVG_HEIGHT = 681;

// Desk-space width for the rendered hand. At 3.5x zoom this becomes ~525
// viewport pixels — a comfortable hand size next to ~91px rendered text.
const HAND_WIDTH = 150;
const SCALE = HAND_WIDTH / SVG_WIDTH;
const HAND_HEIGHT = Math.round(SVG_HEIGHT * SCALE);

// Pen nib position in SVG space (center of the small #929292 rect).
const NIB_SVG_X = 11;
const NIB_SVG_Y = 459;

// Nib offset in desk-space after scaling.
const NIB_OFFSET_X = Math.round(NIB_SVG_X * SCALE);
const NIB_OFFSET_Y = Math.round(NIB_SVG_Y * SCALE);

type PenHandProps = {
  /** Cursor x in desk-space. */
  cursorX: number;
  /** Cursor y in desk-space. */
  cursorY: number;
  /** Whether the hand is visible (true during WRITING state). */
  visible: boolean;
  /** Incremented on each keystroke to trigger jitter animation. */
  keystrokeCount?: number;
  /** Incremented on each line break (NEWLINE or WRAP_LINE) to trigger lift. */
  lineBreakCount?: number;
};

export function PenHand({
  cursorX,
  cursorY,
  visible,
  keystrokeCount = 0,
  lineBreakCount = 0,
}: PenHandProps) {
  // Position the SVG so the nib lands on the cursor coordinates.
  const x = cursorX - NIB_OFFSET_X;
  const y = cursorY - NIB_OFFSET_Y;

  // RES-12: imperative jitter animation on each keystroke.
  const [jitterScope, jitterAnimate] = useAnimate();
  const prevKeystroke = useRef(keystrokeCount);

  // RES-16: imperative lift animation on each line break. Lives on its
  // own scope so it stacks cleanly with the keystroke jitter layer.
  const [liftScope, liftAnimate] = useAnimate();
  const prevLineBreak = useRef(lineBreakCount);

  useEffect(() => {
    if (keystrokeCount === prevKeystroke.current) return;
    prevKeystroke.current = keystrokeCount;

    // Random direction each keystroke for organic feel.
    // Range spans a full character cell but values are halved for subtlety.
    const angle = (Math.random() - 0.5) * 5;  // ±2.5°
    const dx = (Math.random() - 0.5) * 10;    // ±5px (~char width)
    const dy = (Math.random() - 0.5) * 16;    // ±8px (~char height)

    jitterAnimate(
      jitterScope.current,
      { rotate: [0, angle, 0], x: [0, dx, 0], y: [0, dy, 0] },
      { duration: 0.25, ease: [0.22, 1, 0.36, 1] },
    );
  }, [keystrokeCount, jitterAnimate, jitterScope]);

  useEffect(() => {
    if (lineBreakCount === prevLineBreak.current) return;
    prevLineBreak.current = lineBreakCount;

    // Lift fast, hang briefly while the outer x/y spring carries the hand
    // left+down, then drop. Asymmetric keyframe times (fast rise, held
    // peak, softer drop) make the arc read as a real lift rather than a
    // symmetric bounce — noticeably bigger than the per-keystroke jitter.
    liftAnimate(
      liftScope.current,
      { y: [0, -28, -24, 0], rotate: [0, -10, -8, 0] },
      { duration: 0.28, times: [0, 0.25, 0.6, 1], ease: "easeOut" },
    );
  }, [lineBreakCount, liftAnimate, liftScope]);

  return (
    <motion.div
      aria-hidden
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: HAND_WIDTH,
        height: HAND_HEIGHT,
        zIndex: 10,
        pointerEvents: "none",
        transformOrigin: `${NIB_OFFSET_X}px ${NIB_OFFSET_Y}px`,
      }}
      initial={{ x, y, opacity: 0, rotate: 0 }}
      animate={{
        x,
        y,
        opacity: visible ? 1 : 0,
        rotate: visible ? [0, 0.4, 0, -0.4, 0] : 0,
      }}
      transition={{
        x: { type: "spring", stiffness: 300, damping: 30, mass: 0.5 },
        y: { type: "spring", stiffness: 300, damping: 30, mass: 0.5 },
        opacity: { duration: 0.3 },
        rotate: {
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        },
      }}
    >
      {/* RES-16: lift layer — runs during line-break travel. */}
      <motion.div ref={liftScope} style={{ transformOrigin: `${NIB_OFFSET_X}px ${NIB_OFFSET_Y}px` }}>
        {/* RES-12: nested div for additive keystroke jitter */}
        <motion.div ref={jitterScope} style={{ transformOrigin: `${NIB_OFFSET_X}px ${NIB_OFFSET_Y}px` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/hand.svg"
            alt=""
            width={HAND_WIDTH}
            height={HAND_HEIGHT}
            draggable={false}
          />
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
