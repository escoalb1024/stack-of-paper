// RES-6 — Desk component with grain background.
// Fixed 1920×1200 canvas, warm muted background, static SVG grain overlay.

import { ReactNode } from "react";
import { DESK_HEIGHT, DESK_WIDTH } from "@/lib/scene";
import { GrainOverlay } from "./GrainOverlay";

type DeskProps = {
  children?: ReactNode;
};

export function Desk({ children }: DeskProps) {
  return (
    <>
      {/* Warm muted desk surface. Receding — the page is the focus. */}
      <div
        className="relative overflow-hidden"
        style={{
          width: DESK_WIDTH,
          height: DESK_HEIGHT,
          // Warm gray with a whisper of brown. Sits under the page without
          // competing with it.
          background:
            "radial-gradient(ellipse at 50% 55%, #88806f 0%, #6f6656 55%, #544b3d 100%)",
        }}
      >
        {children}
      </div>
      <GrainOverlay />
    </>
  );
}
