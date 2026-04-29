// RES-28 — Toast notification.
//
// Subtle, viewport-fixed message that fades in, holds, and fades out without
// stealing focus or blocking input. Sits above the writing area (bottom-center)
// so it stays clear of the page-count indicator at the top and doesn't cover
// the pen/hand.
//
// Lives outside the CameraContainer — like PageCountIndicator — so its size
// is constant regardless of desk scale. pointer-events:none keeps it out of
// the click path entirely.

"use client";

import { AnimatePresence, motion } from "motion/react";

type Props = {
  /** When true, the toast is mounted and visible. Parent controls auto-dismiss. */
  visible: boolean;
  /** Toast body. Plain string — keep it short. */
  message: string;
};

export function Toast({ visible, message }: Props) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="toast"
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="pointer-events-none fixed bottom-10 left-1/2 z-20 -translate-x-1/2 select-none rounded-full bg-black/35 px-4 py-2 text-sm tracking-wide text-white/85 backdrop-blur-sm"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
