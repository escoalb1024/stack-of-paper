// RES-7 — Page stack static visual (3 pages with offsets/shadows).
// Centered, bottom-aligned on the desk. PageActive (top) is clickable.

"use client";

import {
  PAGE_ACTIVE_LEFT,
  PAGE_ACTIVE_TOP,
  PAGE_HEIGHT,
  PAGE_WIDTH,
} from "@/lib/scene";

type PageStackProps = {
  onClick: () => void;
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

export function PageStack({ onClick }: PageStackProps) {
  // Back pages offset 1–2px each behind the active page, with tiny rotations
  // for an organic pile feel.
  return (
    <>
      <Page offsetX={-2} offsetY={2} rotate={-0.6} zIndex={1} />
      <Page offsetX={1} offsetY={1} rotate={0.4} zIndex={2} />
      <Page offsetX={0} offsetY={0} rotate={0} zIndex={3} active onClick={onClick} />
    </>
  );
}
