// RES-23 — "Add to Journal" affordance shown during ZOOM_OUT.
//
// Sits on the desk just to the right of the page stack so it reads as part
// of the scene rather than a generic UI button: cream paper-tone background,
// handwriting label, soft drop-shadow. Fades in when the camera settles into
// ZOOM_OUT and out again as it leaves; pointer-events follow visibility so
// clicks don't leak through during transitions.

"use client";

import { motion } from "motion/react";
import {
  PAGE_ACTIVE_LEFT,
  PAGE_ACTIVE_TOP,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  rs,
} from "@/lib/scene";

const BUTTON_LEFT = PAGE_ACTIVE_LEFT + PAGE_WIDTH + rs(80);
// Sit beside the top of the page rather than near its bottom — at typical
// viewport sizes the desk is centered with its lower half clipped, so a
// bottom-aligned button ends up off-screen. Top-aligned keeps it well
// inside the visible area in ZOOM_OUT.
const BUTTON_TOP = PAGE_ACTIVE_TOP + rs(80);

type AddToJournalButtonProps = {
  visible: boolean;
  onClick: () => void;
};

export function AddToJournalButton({
  visible,
  onClick,
}: AddToJournalButtonProps) {
  return (
    <motion.button
      type="button"
      aria-label="Add to journal"
      initial={false}
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : rs(8) }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      whileHover={
        visible
          ? { y: rs(-2), transition: { type: "spring", stiffness: 300, damping: 20 } }
          : undefined
      }
      whileTap={visible ? { scale: 0.97 } : undefined}
      onClick={visible ? onClick : undefined}
      className="focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-100/40"
      style={{
        position: "absolute",
        left: BUTTON_LEFT,
        top: BUTTON_TOP,
        pointerEvents: visible ? "auto" : "none",
        background:
          "linear-gradient(180deg, #f8efd6 0%, #f1e4be 100%)",
        color: "#3a2516",
        fontFamily: "var(--font-caveat), Caveat, cursive",
        // RES-38 — font/padding/radius/border/shadow scaled with the scene.
        fontSize: rs(30),
        lineHeight: 1,
        padding: `${rs(14)}px ${rs(26)}px`,
        borderRadius: rs(4),
        border: `${rs(1)}px solid rgba(70,45,20,0.3)`,
        boxShadow: `0 ${rs(1)}px 0 rgba(255,255,255,0.6) inset, 0 ${rs(4)}px ${rs(10)}px rgba(0,0,0,0.18), 0 ${rs(14)}px ${rs(28)}px rgba(0,0,0,0.16)`,
        cursor: visible ? "pointer" : "default",
        whiteSpace: "nowrap",
        zIndex: 30,
      }}
    >
      Add to Journal →
    </motion.button>
  );
}
