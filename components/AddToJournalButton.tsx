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
} from "@/lib/scene";

const BUTTON_LEFT = PAGE_ACTIVE_LEFT + PAGE_WIDTH + 80;
// Sit beside the top of the page rather than near its bottom — at typical
// viewport sizes the desk is centered with its lower half clipped, so a
// bottom-aligned button ends up off-screen. Top-aligned keeps it well
// inside the visible area in ZOOM_OUT.
const BUTTON_TOP = PAGE_ACTIVE_TOP + 80;

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
      animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 8 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      whileHover={
        visible
          ? { y: -2, transition: { type: "spring", stiffness: 300, damping: 20 } }
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
        fontSize: 30,
        lineHeight: 1,
        padding: "14px 26px",
        borderRadius: 4,
        border: "1px solid rgba(70,45,20,0.3)",
        boxShadow:
          "0 1px 0 rgba(255,255,255,0.6) inset, 0 4px 10px rgba(0,0,0,0.18), 0 14px 28px rgba(0,0,0,0.16)",
        cursor: visible ? "pointer" : "default",
        whiteSpace: "nowrap",
        zIndex: 30,
      }}
    >
      Add to Journal →
    </motion.button>
  );
}
