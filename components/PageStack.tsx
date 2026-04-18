// RES-7 — Page stack static visual (3 pages with offsets/shadows).
// RES-18 — The stack grows as pages fill: every completed page adds a "done"
// paper behind the active slot at a small accumulating offset, so the pile
// reads as thicker over time.
//
// Centered, bottom-aligned on the desk. The top (active) paper is clickable
// to trigger ZOOM_IN from DESK_IDLE — during PAGE_TURN we hide it so the
// incoming paper in PageTurnAnimation can slide into an empty slot.

"use client";

import {
  PAGE_ACTIVE_LEFT,
  PAGE_ACTIVE_TOP,
  PAGE_HEIGHT,
  PAGE_WIDTH,
} from "@/lib/scene";

type PageStackProps = {
  onClick: () => void;
  /**
   * Number of finished pages to render behind the active slot. Each one adds
   * a small accumulating offset so the pile visibly thickens over time.
   */
  doneCount?: number;
  /**
   * When false, the active paper is not drawn (used during PAGE_TURN so the
   * incoming page can slide into an empty slot).
   */
  showActive?: boolean;
};

type PageProps = {
  offsetX: number;
  offsetY: number;
  rotate: number;
  zIndex: number;
  active?: boolean;
  onClick?: () => void;
};

function Page({ offsetX, offsetY, rotate, zIndex, active, onClick }: PageProps) {
  return (
    <div
      role={active ? "button" : undefined}
      tabIndex={active ? 0 : undefined}
      onClick={active ? onClick : undefined}
      onKeyDown={
        active
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={active ? "cursor-pointer focus:outline-none" : undefined}
      style={{
        position: "absolute",
        left: PAGE_ACTIVE_LEFT + offsetX,
        top: PAGE_ACTIVE_TOP + offsetY,
        width: PAGE_WIDTH,
        height: PAGE_HEIGHT,
        transform: `rotate(${rotate}deg)`,
        transformOrigin: "50% 50%",
        zIndex,
        // Soft cream paper; very subtle drop shadow so the stack reads as a
        // pile without looking heavy.
        background: "#fbf7ef",
        boxShadow:
          "0 1px 1px rgba(0,0,0,0.08), 0 6px 14px rgba(0,0,0,0.12), 0 18px 36px rgba(0,0,0,0.10)",
        borderRadius: 2,
      }}
    />
  );
}

export function PageStack({
  onClick,
  doneCount = 0,
  showActive = true,
}: PageStackProps) {
  // Done pages accumulate behind the two decorative back pages. Offsets stay
  // small (sub-pixel rotation, ~1px per page) so the pile thickens organically
  // rather than fanning out. Must match PageTurnAnimation's landing spot for
  // doneIndex so the handoff is seamless.
  const donePages = Array.from({ length: doneCount }, (_, i) => ({
    key: `done-${i}`,
    offsetX: -5 - i * 0.6,
    offsetY: 4 + i * 0.9,
    rotate: i % 2 === 0 ? -0.9 : 0.7,
    // Behind the decorative back pages (zIndex 1–2) so they truly live at the
    // bottom of the pile.
    zIndex: -10 - i,
  }));

  return (
    <>
      {donePages.map((p) => (
        <Page
          key={p.key}
          offsetX={p.offsetX}
          offsetY={p.offsetY}
          rotate={p.rotate}
          zIndex={p.zIndex}
        />
      ))}
      {/* Back pages offset 1–2px each behind the active page, with tiny
          rotations for an organic pile feel. */}
      <Page offsetX={-2} offsetY={2} rotate={-0.6} zIndex={1} />
      <Page offsetX={1} offsetY={1} rotate={0.4} zIndex={2} />
      {showActive && (
        <Page offsetX={0} offsetY={0} rotate={0} zIndex={3} active onClick={onClick} />
      )}
    </>
  );
}
