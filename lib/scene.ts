// Shared scene geometry. The desk is a fixed 1920×1200 canvas (RES-6 spec).
// Coordinates here are in desk space; CameraContainer scales/translates the
// whole thing into viewport space.

export const DESK_WIDTH = 1920;
export const DESK_HEIGHT = 1200;

// Paper — 8.5×11 proportions, scaled to a comfortable on-desk size.
export const PAGE_WIDTH = 520;
export const PAGE_HEIGHT = Math.round(PAGE_WIDTH * (11 / 8.5)); // 673

// Bottom-centered on the desk with breathing room underneath.
export const PAGE_BOTTOM_MARGIN = 90;
export const PAGE_ACTIVE_LEFT = Math.round((DESK_WIDTH - PAGE_WIDTH) / 2);
export const PAGE_ACTIVE_TOP =
  DESK_HEIGHT - PAGE_HEIGHT - PAGE_BOTTOM_MARGIN;

// Writing area insets on the active page. The cursor origin lives inside
// these margins; the camera (RES-13) tracks the live pen position rather
// than a fixed point on the page.
export const WRITING_MARGIN_X = 56;
export const WRITING_MARGIN_Y = 72;

// Writable interior — used by RES-15 soft-wrap to know when a line overflows
// and (once RES-16/17 land) when a page fills. Kept in desk-space px so the
// layout-time measurer can compare raw offsetWidth against it directly.
export const WRITING_WIDTH = PAGE_WIDTH - WRITING_MARGIN_X * 2;
export const WRITING_HEIGHT = PAGE_HEIGHT - WRITING_MARGIN_Y * 2;

// Zoom target — about 3.5× per the RES-8 spec. CameraContainer (RES-13)
// computes the translate so the pen lands at a configured viewport fraction.
export const ZOOM_SCALE = 3.5;
