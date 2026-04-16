// RES-8 — CameraContainer: Framer Motion spring zoom between desk and page.
// RES-13 — Camera tracks the pen position during WRITING.
//
// The child scene is positioned in desk-space (1920×1200). This wrapper
// applies a scale+translate to frame either the whole desk or a zoomed view
// anchored to the pen's current position on the active page.

"use client";

import { ReactNode, useEffect, useState } from "react";
import { motion } from "motion/react";
import { ZOOM_SCALE } from "@/lib/scene";
import { AppState, isCameraZoomed } from "@/lib/state";

type CameraContainerProps = {
  state: AppState;
  /** Pen/cursor position in desk-space — the camera follows this point. */
  penX: number;
  penY: number;
  onZoomInComplete: () => void;
  onZoomOutComplete: () => void;
  children: ReactNode;
};

// Where the pen should land in the viewport, as fractions of window
// dimensions. 0.65 from the left keeps ~8-10 words of text visible to the
// pen's left (spec: pen sits 60-70% from the left edge). 0.55 from the top
// leaves room for a couple of previously-written lines above the pen.
const PEN_VIEWPORT_X_FRAC = 0.65;
const PEN_VIEWPORT_Y_FRAC = 0.55;

const RESTING = { scale: 1, x: 0, y: 0 };

// Physical spring — not snappy. Slightly underdamped for a natural settle.
const SPRING = { type: "spring" as const, stiffness: 70, damping: 18, mass: 1 };

// SSR-safe viewport size: desk dimensions as the initial fallback, real
// values arrive on mount; resize listener keeps them fresh.
function useViewportSize() {
  const [size, setSize] = useState({ w: 1920, h: 1080 });
  useEffect(() => {
    const update = () =>
      setSize({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return size;
}

export function CameraContainer({
  state,
  penX,
  penY,
  onZoomInComplete,
  onZoomOutComplete,
  children,
}: CameraContainerProps) {
  const viewport = useViewportSize();

  // With transformOrigin "0 0", a point (x,y) in the child maps to
  // (scale*x + tx, scale*y + ty) in the viewport. Solve for (tx, ty) so
  // the pen lands at the configured viewport fraction.
  const zoomed = {
    scale: ZOOM_SCALE,
    x: viewport.w * PEN_VIEWPORT_X_FRAC - ZOOM_SCALE * penX,
    y: viewport.h * PEN_VIEWPORT_Y_FRAC - ZOOM_SCALE * penY,
  };

  const target = isCameraZoomed(state) ? zoomed : RESTING;

  return (
    <motion.div
      style={{ transformOrigin: "0 0", willChange: "transform" }}
      initial={RESTING}
      animate={target}
      transition={SPRING}
      onAnimationComplete={() => {
        if (state === "ZOOM_IN") onZoomInComplete();
        else if (state === "ZOOM_OUT") onZoomOutComplete();
      }}
    >
      {children}
    </motion.div>
  );
}
