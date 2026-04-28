// RES-8 — CameraContainer: Framer Motion spring zoom between desk and page.
// RES-13 — Camera tracks the pen position during WRITING.
// RES-27 — Gravity tether: while WRITING, the camera rubber-bands toward
// the mouse so the user can look around the page; it springs back to the
// pen when the mouse is idle, and snaps back on the next keystroke.
//
// The child scene is positioned in desk-space (1920×1200). This wrapper
// drives a scale + translate via motion values so the pen-anchor target,
// zoom transitions, and the rubber-band gaze offset can all share one
// spring without React state ping-ponging.

"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue } from "motion/react";
import { ZOOM_SCALE } from "@/lib/scene";
import { AppState, isCameraZoomed } from "@/lib/state";

type CameraContainerProps = {
  state: AppState;
  /** Pen/cursor position in desk-space — the camera follows this point. */
  penX: number;
  penY: number;
  /**
   * Monotonic counter bumped on every keystroke. RES-27: any change snaps
   * the rubber-band gaze offset back to the pen so the next character lands
   * in view.
   */
  keystrokeCount: number;
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

// Physical spring — not snappy. Slightly underdamped for a natural settle.
const SPRING = { type: "spring" as const, stiffness: 70, damping: 18, mass: 1 };

// RES-27 — rubber-band tuning.
// MAX_GAZE_FRAC: cap on how far (as a fraction of viewport size) the gaze
// can drift from the pen. The rubber-band saturates at this value, so a
// mouse parked at the screen edge can't tear the camera off the page.
const MAX_GAZE_FRAC_X = 0.28;
const MAX_GAZE_FRAC_Y = 0.22;
// Settle delay — once the mouse has been idle this long, target collapses
// back to the pen and the spring carries the camera home.
const MOUSE_IDLE_MS = 350;

// Saturating rubber-band: f(0)=0, f(±max)=±max/2, asymptote at ±max.
// The shape mirrors the iOS scroll rubber-band — easy entry near the pen,
// stiffer the further you reach.
function rubberband(delta: number, max: number) {
  if (max <= 0) return 0;
  const sign = delta < 0 ? -1 : 1;
  const x = Math.abs(delta);
  return sign * (max * x) / (x + max);
}

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
  keystrokeCount,
  onZoomInComplete,
  onZoomOutComplete,
  children,
}: CameraContainerProps) {
  const viewport = useViewportSize();

  // Motion values drive the transform directly — no React state means no
  // re-render storm when the rubber-band updates 60 times a second. Each
  // value is animated imperatively from effects below.
  const xMV = useMotionValue(0);
  const yMV = useMotionValue(0);
  const scaleMV = useMotionValue(1);

  // Latest gaze offset (viewport pixels). Lives in a ref so the high-rate
  // mousemove path can update it without triggering React renders.
  const gazeRef = useRef({ x: 0, y: 0 });
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tetherActive = state === "WRITING";

  // Re-target whenever the inputs to the pen-anchored translate change:
  // app state (zoomed vs desk), pen position, or viewport size. Keystrokes
  // also flow through here because the snap-back effect below clears the
  // gaze ref and bumps a key, but the gaze is read here on each retarget
  // so a moving pen + non-zero gaze still composes correctly.
  useEffect(() => {
    const target = isCameraZoomed(state)
      ? {
          scale: ZOOM_SCALE,
          x:
            viewport.w * PEN_VIEWPORT_X_FRAC +
            gazeRef.current.x -
            ZOOM_SCALE * penX,
          y:
            viewport.h * PEN_VIEWPORT_Y_FRAC +
            gazeRef.current.y -
            ZOOM_SCALE * penY,
        }
      : { scale: 1, x: 0, y: 0 };

    const ax = animate(xMV, target.x, SPRING);
    const ay = animate(yMV, target.y, SPRING);
    const as = animate(scaleMV, target.scale, SPRING);

    // ZOOM_IN/ZOOM_OUT transitions wait on the spring settling. Other
    // states (WRITING, PAGE_TURN, etc.) re-target continuously and don't
    // need a completion callback.
    if (state === "ZOOM_IN" || state === "ZOOM_OUT") {
      const cb = state === "ZOOM_IN" ? onZoomInComplete : onZoomOutComplete;
      let cancelled = false;
      Promise.all([ax, ay, as]).then(() => {
        if (!cancelled) cb();
      });
      return () => {
        cancelled = true;
        ax.stop();
        ay.stop();
        as.stop();
      };
    }
    return () => {
      ax.stop();
      ay.stop();
      as.stop();
    };
  }, [
    state,
    penX,
    penY,
    viewport.w,
    viewport.h,
    xMV,
    yMV,
    scaleMV,
    onZoomInComplete,
    onZoomOutComplete,
  ]);

  // Mouse tracking. Listener is only mounted while WRITING so the desk
  // states aren't perturbed. The handler updates the gaze ref and animates
  // the x/y motion values directly to the new pen + gaze target — bypassing
  // React's render cycle entirely for this 60 Hz path.
  useEffect(() => {
    if (!tetherActive) return;
    const onMove = (e: MouseEvent) => {
      const penVpX = window.innerWidth * PEN_VIEWPORT_X_FRAC;
      const penVpY = window.innerHeight * PEN_VIEWPORT_Y_FRAC;
      const maxX = window.innerWidth * MAX_GAZE_FRAC_X;
      const maxY = window.innerHeight * MAX_GAZE_FRAC_Y;
      const dx = e.clientX - penVpX;
      const dy = e.clientY - penVpY;
      // Negative because shifting the scene opposite to the look direction
      // brings the looked-at point into the centre of the frame.
      gazeRef.current = {
        x: -rubberband(dx, maxX),
        y: -rubberband(dy, maxY),
      };
      const tx = penVpX + gazeRef.current.x - ZOOM_SCALE * penX;
      const ty = penVpY + gazeRef.current.y - ZOOM_SCALE * penY;
      animate(xMV, tx, SPRING);
      animate(yMV, ty, SPRING);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        gazeRef.current = { x: 0, y: 0 };
        animate(xMV, penVpX - ZOOM_SCALE * penX, SPRING);
        animate(yMV, penVpY - ZOOM_SCALE * penY, SPRING);
        idleTimerRef.current = null;
      }, MOUSE_IDLE_MS);
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };
  }, [tetherActive, penX, penY, xMV, yMV]);

  // Keystroke snap: any new character pulls focus back to the pen so the
  // text being written is guaranteed visible. The retarget effect above
  // will pick up the cleared gaze on the next render — but we also clear
  // the idle timer here so a stale callback doesn't immediately re-zero.
  useEffect(() => {
    if (!tetherActive) return;
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    gazeRef.current = { x: 0, y: 0 };
    const penVpX = window.innerWidth * PEN_VIEWPORT_X_FRAC;
    const penVpY = window.innerHeight * PEN_VIEWPORT_Y_FRAC;
    animate(xMV, penVpX - ZOOM_SCALE * penX, SPRING);
    animate(yMV, penVpY - ZOOM_SCALE * penY, SPRING);
  }, [keystrokeCount, tetherActive, penX, penY, xMV, yMV]);

  return (
    <motion.div
      style={{
        transformOrigin: "0 0",
        willChange: "transform",
        x: xMV,
        y: yMV,
        scale: scaleMV,
      }}
    >
      {children}
    </motion.div>
  );
}
