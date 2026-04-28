// RES-24 — Journal closed state visual.
//
// A small leather-bound notebook sitting on the top-left of the desk. Rendered
// in desk-space (inside CameraContainer) so it shares the camera's scale and
// translate with the rest of the scene. Clickable from DESK_IDLE to transition
// into JOURNAL_OPEN (RES-25 will fill in what the open state actually shows).
//
// The visual thickness grows with the number of journaled entries: each entry
// adds a cream page-edge slice on the book's right side, up to a soft cap, and
// the spine quietly deepens. On hover the book lifts slightly and its shadow
// pools, like picking it up a couple millimeters off the desk.

"use client";

import { useState } from "react";
import { motion } from "motion/react";

// Desk-space placement (top-left corner area). Kept well inside the desk
// bounds so the camera can pan toward it without clipping into the frame.
// Placed so the spine-corner bleeds off the top-left of the desk — reads as a
// journal sitting at the edge of the work surface, not neatly centered on it.
export const JOURNAL_LEFT = 20;
export const JOURNAL_TOP = -80;

// Sized to match a single page (PAGE_WIDTH × PAGE_HEIGHT from lib/scene) so
// the journal reads as the same scale as the paper on the desk. Exported so
// the RES-23 slide animation can land its papers on the same footprint.
export const JOURNAL_BOOK_WIDTH = 520;
export const JOURNAL_BOOK_HEIGHT = 673;
const BOOK_WIDTH = JOURNAL_BOOK_WIDTH;
const BOOK_HEIGHT = JOURNAL_BOOK_HEIGHT;
// Clockwise tilt so the spine faces up-left and the fore-edge faces down-right.
export const JOURNAL_ROTATION_DEG = 32;
const BOOK_ROTATION_DEG = JOURNAL_ROTATION_DEG;

// Each journaled entry contributes one cream slice on the book's fore-edge up
// to this cap. Beyond it the book's "fullness" plateaus — matches PageStack's
// MAX_DONE_VISIBLE philosophy.
const MAX_PAGE_SLICES = 24;
const SLICE_THICKNESS = 0.8;

// Hover affordance: on hover/focus a few pages slide out from the book's
// top-right corner, as if being tugged by the corner. Each page uses a
// different translate/rotate/rest-offset so the fan-out reads as a loose
// stack of sheets — similar to the organic offsets on PageStack — instead
// of three uniform copies. Local to the rotated book frame: +x is toward
// the fore-edge, -y is toward the book's top. Indexed 0 (topmost / farthest
// out) to 2 (deepest / barely peeking).
type PageTransform = { x: number; y: number; rotate: number };

// Subtle asymmetry even at rest — each page sits a hair off-square inside
// the book so the pile feels hand-stacked. These baselines are added into
// both rest and hover targets below.
const PAGE_REST_OFFSETS: readonly PageTransform[] = [
  { x: 0, y: 0, rotate: 0.6 },
  { x: -1, y: 1, rotate: -0.4 },
  { x: 2, y: -1, rotate: 0.2 },
] as const;

// Per-page pull-out direction — differing x/y ratios (not proportional) and
// mixed rotation signs so the sheets don't move in lockstep.
const PAGE_HOVER_DELTAS: readonly PageTransform[] = [
  { x: 44, y: -22, rotate: 5.2 },
  { x: 22, y: -30, rotate: -1.8 },
  { x: 32, y: -10, rotate: 2.6 },
] as const;

function addTransforms(a: PageTransform, b: PageTransform): PageTransform {
  return { x: a.x + b.x, y: a.y + b.y, rotate: a.rotate + b.rotate };
}

type JournalClosedProps = {
  entryCount: number;
  onClick: () => void;
  interactive: boolean;
};

export function JournalClosed({
  entryCount,
  onClick,
  interactive,
}: JournalClosedProps) {
  const slices = Math.min(entryCount, MAX_PAGE_SLICES);
  // Book body grows subtly with fullness — a nearly-empty journal reads as
  // thin; a well-used one as chunky. Capped so the silhouette stays stable.
  const fullnessPx = slices * SLICE_THICKNESS;

  // Tracks hover and keyboard-focus as a single "active" signal so the
  // page-fan-out animation triggers consistently for both. Pointer leave and
  // blur collapse it back.
  const [active, setActive] = useState(false);
  const showPagesOut = interactive && active;

  return (
    <motion.div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? "Open journal" : undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      onHoverStart={interactive ? () => setActive(true) : undefined}
      onHoverEnd={interactive ? () => setActive(false) : undefined}
      onFocus={interactive ? () => setActive(true) : undefined}
      onBlur={interactive ? () => setActive(false) : undefined}
      initial={false}
      style={{
        position: "absolute",
        left: JOURNAL_LEFT,
        top: JOURNAL_TOP,
        width: BOOK_WIDTH + fullnessPx,
        height: BOOK_HEIGHT,
        cursor: interactive ? "pointer" : "default",
        transform: `rotate(${BOOK_ROTATION_DEG}deg)`,
        transformOrigin: "50% 50%",
        filter:
          "drop-shadow(0 4px 6px rgba(0,0,0,0.25)) drop-shadow(0 14px 28px rgba(0,0,0,0.28))",
      }}
      // Using CSS focus ring via outline — focus visible in keyboard nav
      // without overriding the leather styling.
      className={
        interactive
          ? "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-100/40"
          : undefined
      }
    >
      {/* Page edges stacked on the right ("fore-edge"). Sits behind the cover
          so only the sliver peeks out. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 6,
          right: 0,
          width: Math.max(6, fullnessPx + 4),
          height: BOOK_HEIGHT - 12,
          background:
            "repeating-linear-gradient(to right, #f3ead4 0px, #f3ead4 1px, #d8ccac 1px, #d8ccac 2px)",
          borderTopRightRadius: 2,
          borderBottomRightRadius: 2,
          boxShadow: "inset 0 0 3px rgba(80,60,30,0.3)",
        }}
      />

      {/* Back cover — shows on the fore-edge side as a thin warm-dark rim. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 4,
          background:
            "linear-gradient(90deg, #3a2516 0%, #2e1c10 45%, #241509 100%)",
        }}
      />

      {/* Hover pages — sandwiched between back cover and front cover so they
          are hidden at rest and only reveal themselves as they translate out
          past the front cover's top-right corner. Rendered deepest-first so
          index 0 (the most-extended page on hover) ends up on top, reading
          naturally as the topmost sheet being tugged. */}
      {[2, 1, 0].map((i) => {
        const rest = PAGE_REST_OFFSETS[i];
        const target = showPagesOut
          ? addTransforms(rest, PAGE_HOVER_DELTAS[i])
          : rest;
        // Per-page spring tuning — slightly different stiffness/damping so
        // sheets don't land in sync. Different stagger per page too.
        const stiffness = 220 + i * 18;
        const damping = 22 + i * 2;
        return (
          <motion.div
            key={`hover-page-${i}`}
            aria-hidden
            animate={target}
            transition={{
              type: "spring",
              stiffness,
              damping,
              delay: showPagesOut ? i * 0.04 : (2 - i) * 0.02,
            }}
            style={{
              position: "absolute",
              top: 8,
              left: 10,
              width: BOOK_WIDTH - 20,
              height: BOOK_HEIGHT - 16,
              background: "#fbf7ef",
              borderRadius: 2,
              boxShadow:
                "0 1px 1px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.08)",
              // Pivot near the top-right corner so rotation feels like the
              // corner is the handle being pulled.
              transformOrigin: "95% 10%",
            }}
          />
        );
      })}

      {/* Front cover — leather surface with soft highlight and edge darkening. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: BOOK_WIDTH,
          borderRadius: 4,
          background:
            "radial-gradient(ellipse at 35% 30%, #6a412a 0%, #4b2c1b 55%, #301a0d 100%)",
          boxShadow:
            "inset 0 1px 0 rgba(255,220,180,0.08), inset 0 -2px 4px rgba(0,0,0,0.5), inset 2px 0 6px rgba(0,0,0,0.35)",
        }}
      />

      {/* Spine shadow — a darker band along the left edge to sell the binding. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: 14,
          borderTopLeftRadius: 4,
          borderBottomLeftRadius: 4,
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 70%, rgba(0,0,0,0) 100%)",
        }}
      />

      {/* Embossed frame on the cover — a faint inset rectangle for character. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 16,
          bottom: 16,
          left: 22,
          width: BOOK_WIDTH - 40,
          borderRadius: 2,
          border: "1px solid rgba(255,220,180,0.08)",
          boxShadow:
            "inset 0 0 0 1px rgba(0,0,0,0.35), 0 1px 0 rgba(255,220,180,0.04)",
        }}
      />

      {/* Subtle grain streaks on the leather. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: BOOK_WIDTH,
          borderRadius: 4,
          opacity: 0.15,
          background:
            "repeating-linear-gradient(100deg, transparent 0px, transparent 5px, rgba(0,0,0,0.25) 5px, rgba(0,0,0,0.25) 6px)",
          mixBlendMode: "multiply",
          pointerEvents: "none",
        }}
      />
    </motion.div>
  );
}
