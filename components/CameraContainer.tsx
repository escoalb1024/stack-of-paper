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
import { DESK_HEIGHT, DESK_WIDTH, deskViewScale, ZOOM_SCALE } from "@/lib/scene";
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

// Physical spring — not snappy. Used for live pen-tracking and the
// rubber-band gaze during WRITING so following the cursor feels smooth
// and gentle rather than darting.
const SPRING = { type: "spring" as const, stiffness: 70, damping: 18, mass: 1 };

// RES-38 — Snappier spring reserved for FSM state transitions (ZOOM_IN,
// ZOOM_OUT, PAGE_TURN, etc.). At ZOOM_SCALE = 1.8 the scale jump is larger
// than at the previous 1.0 baseline, which made the zoom-in feel laggy on
// the standard SPRING. Shorter settle time keeps the transition crisp
// without affecting in-WRITING pen tracking, which continues to use
// SPRING. Damping ratio (~1.07) matches SPRING's so both feel like the
// same physical material, just stiffer.
const TRANSITION_SPRING = {
  type: "spring" as const,
  stiffness: 180,
  damping: 27,
  mass: 1,
};

// RES-27 — rubber-band tuning.
// MAX_GAZE_FRAC: cap on how far (as a fraction of viewport size) the gaze
// can drift from the pen. The rubber-band saturates at this value, so a
// mouse parked at the screen edge can't tear the camera off the page.
const MAX_GAZE_FRAC_X = 0.28;
const MAX_GAZE_FRAC_Y = 0.22;
// Settle delay — once the mouse has been idle this long, target collapses
// back to the pen and the spring carries the camera home.
const MOUSE_IDLE_MS = 1500;

// Saturating rubber-band: f(0)=0, f(±max)=±max/2, asymptote at ±max.
// The shape mirrors the iOS scroll rubber-band — easy entry near the pen,
// stiffer the further you reach.
function rubberband(delta: number, max: number) {
  if (max <= 0) return 0;
  const sign = delta < 0 ? -1 : 1;
  const x = Math.abs(delta);
  return sign * (max * x) / (x + max);
}

// RES-38 — CameraContainer is gated by a `cameraMounted` flag in
// app/page.tsx so it only mounts on the client AFTER the first paint.
// That guarantees `window` is defined when this component first runs,
// which lets us lazy-init viewport state and motion values directly from
// the real viewport — no SSR fallback, no transform mismatch, no jump,
// no boot animation. Browser's first paint of the scene is already at the
// correct size.

export function CameraContainer({
  state,
  penX,
  penY,
  keystrokeCount,
  onZoomInComplete,
  onZoomOutComplete,
  children,
}: CameraContainerProps) {
  // Lazy-init from window. Safe because the parent only mounts this
  // component on the client (post-hydration); SSR/hydration paths never
  // hit this code. The fallback branch is defensive — if a future caller
  // ever renders this server-side, we degrade to a 1920×1080 baseline
  // instead of throwing on `window.innerWidth`.
  const [viewport, setViewport] = useState(() => {
    if (typeof window === "undefined") return { w: 1920, h: 1080 };
    return { w: window.innerWidth, h: window.innerHeight };
  });

  // Motion values seeded from the real viewport — the first render's
  // transform string is the correct target. No .set() snap, no spring,
  // no visibility gate needed.
  const initialDeskScale = deskViewScale(viewport.w, viewport.h);
  const initialDeskX = (viewport.w - DESK_WIDTH * initialDeskScale) / 2;
  const initialDeskY = (viewport.h - DESK_HEIGHT * initialDeskScale) / 2;

  // Motion values drive the transform directly — no React state means no
  // re-render storm when the rubber-band updates 60 times a second. Each
  // value is animated imperatively from effects below.
  const xMV = useMotionValue(initialDeskX);
  const yMV = useMotionValue(initialDeskY);
  const scaleMV = useMotionValue(initialDeskScale);

  // Latest gaze offset (viewport pixels). Lives in a ref so the high-rate
  // mousemove path can update it without triggering React renders.
  const gazeRef = useRef({ x: 0, y: 0 });
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // RES-38 — Track previous FSM state so the retarget effect can pick the
  // snappy TRANSITION_SPRING on the run where `state` actually flipped,
  // and the gentle SPRING on the subsequent re-runs that fire for pen
  // movement / viewport changes while WRITING.
  const prevStateRef = useRef(state);

  // Resize listener — animated retargets via the spring (handled by the
  // retarget useEffect below) are the right UX for a user-driven resize.
  useEffect(() => {
    const onResize = () =>
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const tetherActive = state === "WRITING";

  // Re-target whenever the inputs to the pen-anchored translate change:
  // app state (zoomed vs desk), pen position, or viewport size. Keystrokes
  // also flow through here because the snap-back effect below clears the
  // gaze ref and bumps a key, but the gaze is read here on each retarget
  // so a moving pen + non-zero gaze still composes correctly.
  useEffect(() => {
    const deskScale = deskViewScale(viewport.w, viewport.h);
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
      : {
          scale: deskScale,
          // Center the desk in the viewport. With cover-fit, exactly one axis
          // (the limiting one) lands flush at 0; the other gets a negative
          // offset because the desk is larger than the viewport on that side.
          x: (viewport.w - DESK_WIDTH * deskScale) / 2,
          y: (viewport.h - DESK_HEIGHT * deskScale) / 2,
        };

    // Pick the spring: state-change retargets use the snappier TRANSITION_SPRING
    // so the zoom / page-turn / etc. visual handoff feels crisp. Continuous
    // retargets while in the same state (pen-tracking during WRITING,
    // viewport resize) stay on the gentle SPRING.
    const isTransition = state !== prevStateRef.current;
    prevStateRef.current = state;
    const spring = isTransition ? TRANSITION_SPRING : SPRING;

    const ax = animate(xMV, target.x, spring);
    const ay = animate(yMV, target.y, spring);
    const as = animate(scaleMV, target.scale, spring);

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
