// RES-6 — Desk component (transparent clip-container for the in-scene
// children). RES-38: the desk's radial gradient lives on <main> instead
// of on this div now — at RENDER_SCALE × ZOOM_SCALE, the camera's
// compositor layer texture can exceed Chrome's per-tile limit, so any
// gradient painted onto that layer would get split across tiles and
// show a visible seam at the boundary. Painting the gradient on the
// fixed-position viewport background (computed once per frame, single
// tile) sidesteps that entirely. The desk div here keeps its desk-space
// dimensions and overflow:hidden so children still clip to the
// 1920×1200 (× RENDER_SCALE) surface.

import { ReactNode } from "react";
import { DESK_HEIGHT, DESK_WIDTH } from "@/lib/scene";
import { GrainOverlay } from "./GrainOverlay";

type DeskProps = {
  children?: ReactNode;
};

export function Desk({ children }: DeskProps) {
  return (
    <>
      <div
        className="relative overflow-hidden"
        style={{
          width: DESK_WIDTH,
          height: DESK_HEIGHT,
        }}
      >
        {children}
      </div>
      <GrainOverlay />
    </>
  );
}
