// RES-19 — Page count indicator.
//
// Subtle "N / M" readout shown while the user is writing. Lives in viewport
// space (fixed), NOT inside the zooming CameraContainer — we want it to stay
// readable at a constant size regardless of the desk scale.
//
// Visibility: only shown while actually writing (WRITING or PAGE_TURN). During
// DESK_IDLE / JOURNAL_OPEN the pile on the desk communicates progress on its
// own; a floating counter would feel like UI chrome. Hidden entirely when
// there's only a single page so the first-page experience stays uncluttered.

"use client";

type Props = {
  /** 1-indexed current page number. */
  current: number;
  /** Total number of pages in the entry. */
  total: number;
  /** When false, render nothing. */
  visible: boolean;
};

export function PageCountIndicator({ current, total, visible }: Props) {
  if (!visible || total <= 1) return null;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 top-4 -translate-x-1/2 select-none rounded-full bg-black/25 px-3 py-1 font-mono text-xs tracking-wide text-white/70 backdrop-blur-sm"
    >
      {current} / {total}
    </div>
  );
}
